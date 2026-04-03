import io
import os
import tempfile
from datetime import date
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image, ImageDraw, ImageFont
from rest_framework.test import APIClient

from accounts.models import BusinessProfile, User
from ocr.models import BusinessTransaction, Invoice, OCRDocument
from ocr.utils import parse_ocr_text_to_credit_sale, run_ocr
from private.models import Group, GroupMember


def create_png_bytes():
    # Tiny 1x1 black png
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02"
        b"\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\xd7c```\x00\x00\x00\x04\x00\x01"
        b"\x0bm\x0b\xef\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def create_receipt_image(lines):
    font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 34)
    width = 1200
    line_height = 54
    height = 120 + (len(lines) * line_height)
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    y = 40
    for line in lines:
        draw.text((40, y), line, fill="black", font=font)
        y += line_height
    handle = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    image.save(handle.name)
    return handle.name


class BusinessOCRTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.approved_user = User.objects.create_user(
            email="biz@example.com",
            full_name="Biz",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.approved_user.kyc_status = "APPROVED"
        self.approved_user.business_status = "APPROVED"
        self.approved_user.save(update_fields=["kyc_status", "business_status"])

        self.unapproved_user = User.objects.create_user(
            email="pending@example.com",
            full_name="Pending Biz",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.unapproved_user.kyc_status = "PENDING"
        self.unapproved_user.business_status = "KYC_PENDING"
        self.unapproved_user.save(update_fields=["kyc_status", "business_status"])

        BusinessProfile.objects.create(
            user=self.approved_user,
            business_name="Biz Store",
            owner_name="Biz",
            phone="9800000000",
            email="biz@example.com",
            address="Kathmandu",
            business_type="Retail",
            pan_vat_number="PAN123",
            kyc_status="APPROVED",
        )

    def test_business_gate_blocks_unapproved(self):
        self.client.force_authenticate(self.unapproved_user)
        res = self.client.get("/api/business/ocr/")
        self.assertEqual(res.status_code, 403)

    def test_confirm_creates_transaction_and_updates_document(self):
        self.client.force_authenticate(self.approved_user)
        img = SimpleUploadedFile("tiny.png", create_png_bytes(), content_type="image/png")
        doc = OCRDocument.objects.create(owner=self.approved_user, image=img, raw_text="Test", status=OCRDocument.DRAFT)

        payload = {
            "merchant": "Test Store",
            "amount": "12.50",
            "date": date.today().isoformat(),
            "transaction_type": "CREDIT",
            "note": "OCR confirm test",
        }
        res = self.client.post(f"/api/business/ocr/{doc.id}/confirm/", data=payload, format="json")
        self.assertEqual(res.status_code, 201)

        doc.refresh_from_db()
        self.assertEqual(doc.status, OCRDocument.CONFIRMED)

        tx = BusinessTransaction.objects.get(ocr_document=doc)
        self.assertEqual(str(tx.amount), "12.50")
        self.assertEqual(tx.merchant, "Test Store")
        self.assertEqual(tx.customer_name, "Test Store")
        self.assertEqual(tx.source, "OCR")

    def test_patch_confirmed_ocr_updates_linked_transaction(self):
        self.client.force_authenticate(self.approved_user)
        img = SimpleUploadedFile("tiny.png", create_png_bytes(), content_type="image/png")
        doc = OCRDocument.objects.create(
            owner=self.approved_user,
            image=img,
            raw_text="Test",
            extracted_amount="12.50",
            extracted_merchant="Old Store",
            extracted_date=date.today(),
            status=OCRDocument.CONFIRMED,
        )
        tx = BusinessTransaction.objects.create(
            owner=self.approved_user,
            ocr_document=doc,
            merchant="Old Store",
            customer_name="Old Store",
            amount="12.50",
            transaction_type="CREDIT",
            transaction_date=date.today(),
            note="Old note",
            source="OCR",
        )

        payload = {
            "merchant": "New Store",
            "amount": "15.75",
            "date": date.today().isoformat(),
            "transaction_type": "BORROWED",
            "note": "Updated note",
        }
        res = self.client.patch(f"/api/business/ocr/{doc.id}/", data=payload, format="json")

        self.assertEqual(res.status_code, 200)
        doc.refresh_from_db()
        tx.refresh_from_db()
        self.assertEqual(doc.extracted_merchant, "New Store")
        self.assertEqual(str(doc.extracted_amount), "15.75")
        self.assertEqual(tx.merchant, "New Store")
        self.assertEqual(tx.customer_name, "New Store")
        self.assertEqual(str(tx.amount), "15.75")
        self.assertEqual(tx.transaction_type, "DEBIT")
        self.assertEqual(tx.note, "Updated note")

    def test_delete_ocr_document_also_deletes_linked_transaction(self):
        self.client.force_authenticate(self.approved_user)
        img = SimpleUploadedFile("tiny.png", create_png_bytes(), content_type="image/png")
        doc = OCRDocument.objects.create(owner=self.approved_user, image=img, raw_text="Test", status=OCRDocument.CONFIRMED)
        tx = BusinessTransaction.objects.create(
            owner=self.approved_user,
            ocr_document=doc,
            merchant="Delete Store",
            customer_name="Delete Store",
            amount="20.00",
            transaction_type="CREDIT",
            transaction_date=date.today(),
            source="OCR",
        )

        res = self.client.delete(f"/api/business/ocr/{doc.id}/")

        self.assertEqual(res.status_code, 200)
        self.assertFalse(OCRDocument.objects.filter(id=doc.id).exists())
        self.assertFalse(BusinessTransaction.objects.filter(id=tx.id).exists())

    def test_retail_bill_parser_extracts_total_and_payment_details(self):
        text = "\n".join(
            [
                "Corner Mart",
                "CASH RECEIPT",
                "Date: 2026-04-03",
                "Description Price",
                "Milk 2.50",
                "Bread 3.21",
                "Total 5.71",
                "Cash 10.00",
                "Change 4.29",
            ]
        )

        parsed = parse_ocr_text_to_credit_sale(text)

        self.assertEqual(parsed["bill_type"], "retail")
        self.assertEqual(parsed["vendor"], "Corner Mart")
        self.assertEqual(parsed["date"], "2026-04-03")
        self.assertEqual(parsed["total_amount"], 5.71)
        self.assertEqual(parsed["payment_details"]["cash"], 10.0)
        self.assertEqual(parsed["payment_details"]["change"], 4.29)
        self.assertEqual(parsed["confidence"], "high")
        self.assertFalse(parsed["manual_review_required"])

    def test_restaurant_bill_parser_extracts_total_subtotal_tax_and_items(self):
        text = "\n".join(
            [
                "Cafe One",
                "Date 03/04/2026",
                "Table 12",
                "Server Mira",
                "1 Americano $2.99",
                "2 Croissant $3.50",
                "Subtotal $9.99",
                "Tax $0.80",
                "Total $10.79",
            ]
        )

        parsed = parse_ocr_text_to_credit_sale(text)

        self.assertEqual(parsed["bill_type"], "restaurant")
        self.assertEqual(parsed["vendor"], "Cafe One")
        self.assertEqual(parsed["total_amount"], 10.79)
        self.assertEqual(parsed["subtotal"], 9.99)
        self.assertEqual(parsed["tax"], 0.8)
        self.assertEqual(parsed["confidence"], "high")
        self.assertEqual(len(parsed["items"]), 2)
        self.assertEqual(parsed["items"][0]["name"], "Americano")
        self.assertEqual(parsed["items"][0]["quantity"], 1)

    def test_ocr_pipeline_extracts_total_from_restaurant_sample_image(self):
        image_path = create_receipt_image(
            [
                "Cafe One",
                "Table 12",
                "Server Mira",
                "1 Americano $2.99",
                "2 Croissant $3.50",
                "Subtotal $9.99",
                "Tax $0.80",
                "Total $10.79",
            ]
        )
        try:
            raw_text = run_ocr(image_path)
            parsed = parse_ocr_text_to_credit_sale(raw_text)
        finally:
            os.unlink(image_path)

        self.assertEqual(parsed["bill_type"], "restaurant")
        self.assertEqual(parsed["total_amount"], 10.79)
        self.assertEqual(parsed["subtotal"], 9.99)
        self.assertEqual(parsed["tax"], 0.8)

    def test_ocr_pipeline_extracts_total_from_retail_sample_image(self):
        image_path = create_receipt_image(
            [
                "Corner Mart",
                "CASH RECEIPT",
                "Description Price",
                "Milk 2.50",
                "Bread 3.21",
                "Total 5.71",
                "Cash 10.00",
                "Change 4.29",
            ]
        )
        try:
            raw_text = run_ocr(image_path)
            parsed = parse_ocr_text_to_credit_sale(raw_text)
        finally:
            os.unlink(image_path)

        self.assertEqual(parsed["bill_type"], "retail")
        self.assertEqual(parsed["total_amount"], 5.71)
        self.assertEqual(parsed["payment_details"]["cash"], 10.0)
        self.assertEqual(parsed["payment_details"]["change"], 4.29)

    @patch("ocr.views.run_ocr")
    def test_credit_sale_ocr_endpoint_returns_partial_data_instead_of_crashing(self, mock_run_ocr):
        mock_run_ocr.return_value = "12345\n67.89"
        self.client.force_authenticate(self.approved_user)

        img = SimpleUploadedFile("tiny.png", create_png_bytes(), content_type="image/png")
        res = self.client.post("/api/ocr/process-credit-sale/", data={"image": img})

        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["confidence"], "low")
        self.assertTrue(payload["manual_review_required"])
        self.assertEqual(payload["parsed_data"]["bill_type"], "unknown")


class BusinessLedgerSettlementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.owner.kyc_status = "APPROVED"
        self.owner.business_status = "APPROVED"
        self.owner.save(update_fields=["kyc_status", "business_status"])

        self.other_owner = User.objects.create_user(
            email="other@example.com",
            full_name="Other Owner",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.other_owner.kyc_status = "APPROVED"
        self.other_owner.business_status = "APPROVED"
        self.other_owner.save(update_fields=["kyc_status", "business_status"])

        self.private_user = User.objects.create_user(
            email="private@example.com",
            full_name="Private",
            account_type="PRIVATE",
            password="pass12345",
        )

    def create_tx(self, **kwargs):
        defaults = {
            "owner": self.owner,
            "merchant": "Test Store",
            "customer_name": "John Doe",
            "amount": "25.00",
            "transaction_type": "CREDIT",
            "transaction_date": date.today(),
            "source": "MANUAL",
        }
        defaults.update(kwargs)
        return BusinessTransaction.objects.create(**defaults)

    def test_owner_can_settle_once(self):
        tx = self.create_tx()
        self.client.force_authenticate(self.owner)

        res = self.client.patch(f"/api/business/ledger/{tx.id}/settle/")
        self.assertEqual(res.status_code, 200)

        tx.refresh_from_db()
        self.assertTrue(tx.is_settled)
        self.assertIsNotNone(tx.settled_at)

        # second attempt should fail with 400
        res_repeat = self.client.patch(f"/api/business/ledger/{tx.id}/settle/")
        self.assertEqual(res_repeat.status_code, 400)

    def test_cannot_settle_other_users_transaction(self):
        tx = self.create_tx(owner=self.other_owner)
        self.client.force_authenticate(self.owner)

        res = self.client.patch(f"/api/business/ledger/{tx.id}/settle/")
        self.assertEqual(res.status_code, 404)

    def test_private_user_blocked(self):
        tx = self.create_tx()
        self.client.force_authenticate(self.private_user)

        res = self.client.patch(f"/api/business/ledger/{tx.id}/settle/")
        self.assertEqual(res.status_code, 403)


class InvoiceGenerationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email="invoice@example.com",
            full_name="Invoicing Biz",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.owner.kyc_status = "APPROVED"
        self.owner.business_status = "APPROVED"
        self.owner.save(update_fields=["kyc_status", "business_status"])

        self.other_owner = User.objects.create_user(
            email="other-invoice@example.com",
            full_name="Other Biz",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.other_owner.kyc_status = "APPROVED"
        self.other_owner.business_status = "APPROVED"
        self.other_owner.save(update_fields=["kyc_status", "business_status"])

        self.private_user = User.objects.create_user(
            email="private-invoice@example.com",
            full_name="Private Person",
            account_type="PRIVATE",
            password="pass12345",
        )

    def create_tx(self, **kwargs):
        defaults = {
            "owner": self.owner,
            "merchant": "Invoice Store",
            "customer_name": "Jane Customer",
            "amount": "55.00",
            "transaction_type": "CREDIT",
            "transaction_date": date.today(),
            "source": "MANUAL",
            "is_settled": True,
        }
        defaults.update(kwargs)
        return BusinessTransaction.objects.create(**defaults)

    def test_generate_invoice_for_settled_transaction(self):
        tx = self.create_tx()
        self.client.force_authenticate(self.owner)

        res = self.client.post(f"/api/business/invoices/{tx.id}/generate/")
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertTrue(Invoice.objects.filter(transaction=tx).exists())
        self.assertEqual(data["transaction_id"], tx.id)
        self.assertEqual(str(data["total_amount"]), "55.00")

    def test_cannot_generate_for_unsettled(self):
        tx = self.create_tx(is_settled=False)
        self.client.force_authenticate(self.owner)

        res = self.client.post(f"/api/business/invoices/{tx.id}/generate/")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Invoice.objects.filter(transaction=tx).exists())

    def test_cannot_generate_twice(self):
        tx = self.create_tx()
        Invoice.objects.create(
            business=self.owner,
            transaction=tx,
            invoice_number="INV-1",
            total_amount=tx.amount,
            customer_name=tx.customer_name,
        )
        self.client.force_authenticate(self.owner)

        res = self.client.post(f"/api/business/invoices/{tx.id}/generate/")
        self.assertEqual(res.status_code, 400)

    def test_cannot_generate_for_other_owner(self):
        tx = self.create_tx(owner=self.other_owner)
        self.client.force_authenticate(self.owner)

        res = self.client.post(f"/api/business/invoices/{tx.id}/generate/")
        self.assertEqual(res.status_code, 404)

    def test_private_user_blocked(self):
        tx = self.create_tx()
        self.client.force_authenticate(self.private_user)

        res = self.client.post(f"/api/business/invoices/{tx.id}/generate/")
        self.assertEqual(res.status_code, 403)

    def test_invoice_list_only_own(self):
        mine = self.create_tx()
        theirs = self.create_tx(owner=self.other_owner, customer_name="Other Cust")
        Invoice.objects.create(
            business=self.owner,
            transaction=mine,
            invoice_number="INV-MINE",
            total_amount=mine.amount,
            customer_name=mine.customer_name,
        )
        Invoice.objects.create(
            business=self.other_owner,
            transaction=theirs,
            invoice_number="INV-THEIRS",
            total_amount=theirs.amount,
            customer_name=theirs.customer_name,
        )

        self.client.force_authenticate(self.owner)
        res = self.client.get("/api/business/invoices/")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["invoice_number"], "INV-MINE")


class GroupPersistenceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            account_type="PRIVATE",
            password="pass12345",
        )
        self.member = User.objects.create_user(
            email="member@example.com",
            full_name="Member",
            account_type="PRIVATE",
            password="pass12345",
        )

    def test_group_and_membership_persist(self):
        group = Group.objects.create(owner=self.owner, name="Test Group")
        GroupMember.objects.create(group=group, user=self.owner, role=GroupMember.ADMIN)
        GroupMember.objects.create(group=group, user=self.member, role=GroupMember.MEMBER)

        self.assertEqual(Group.objects.count(), 1)
        self.assertEqual(group.memberships.count(), 2)
        self.assertTrue(group.memberships.filter(user=self.owner, role=GroupMember.ADMIN).exists())
        self.assertTrue(group.memberships.filter(user=self.member, role=GroupMember.MEMBER).exists())
