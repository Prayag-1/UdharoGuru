import os
from pathlib import Path

from django.conf import settings
from django.utils import timezone

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
except Exception:  # pragma: no cover
    canvas = None

try:
    import qrcode
except Exception:  # pragma: no cover
    qrcode = None


def _receipt_path(transaction_id):
    filename = f"receipt_{transaction_id}.pdf"
    receipts_dir = Path(settings.MEDIA_ROOT) / "receipts"
    receipts_dir.mkdir(parents=True, exist_ok=True)
    return receipts_dir / filename


def generate_settlement_receipt(transaction):
    if canvas is None:
        raise RuntimeError("reportlab is required to generate receipts")

    receipt_path = _receipt_path(transaction.id)

    settled_at = transaction.settled_at or timezone.now()
    payer = transaction.customer.name
    receiver = transaction.customer.owner.full_name or transaction.customer.owner.email

    c = canvas.Canvas(str(receipt_path), pagesize=A4)
    width, height = A4

    y = height - 30 * mm
    c.setFont("Helvetica-Bold", 16)
    c.drawString(30 * mm, y, "UdharoGuru Settlement Receipt")

    y -= 12 * mm
    c.setFont("Helvetica", 11)
    c.drawString(30 * mm, y, f"Receipt ID: RG-{transaction.id}")
    y -= 7 * mm
    c.drawString(30 * mm, y, f"Transaction ID: TX-{transaction.id}")

    y -= 12 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(30 * mm, y, f"Settled By: {payer}")
    y -= 7 * mm
    c.drawString(30 * mm, y, f"Settled With: {receiver}")

    y -= 12 * mm
    c.setFont("Helvetica", 11)
    c.drawString(30 * mm, y, f"Amount: Rs. {transaction.amount:,.2f}")
    y -= 7 * mm
    c.drawString(30 * mm, y, f"Date: {settled_at.date().isoformat()}")

    y -= 7 * mm
    c.drawString(30 * mm, y, "Status: Settled")

    if transaction.description:
        y -= 10 * mm
        c.setFont("Helvetica", 10)
        c.drawString(30 * mm, y, f"Note: {transaction.description}")

    if qrcode is not None:
        try:
            qr_data = f"transaction:{transaction.id}"
            qr_img = qrcode.make(qr_data)
            qr_path = receipt_path.with_suffix(".png")
            qr_img.save(qr_path)
            c.drawImage(str(qr_path), width - 55 * mm, height - 70 * mm, 35 * mm, 35 * mm)
            try:
                os.remove(qr_path)
            except OSError:
                pass
        except Exception:
            pass

    c.setFont("Helvetica-Oblique", 10)
    c.drawString(30 * mm, 20 * mm, "Thank you for using UdharoGuru")

    c.showPage()
    c.save()

    return receipt_path
