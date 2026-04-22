import os
import tempfile
from datetime import timedelta

from django.db.models import Case, IntegerField, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ensure_business_profile
from accounts.permissions import IsBusinessAccount
from core.models import CreditSale, CreditSaleItem, Customer, Product

from .models import BusinessTransaction, OCRDocument, OCRScan
from .serializers import OCRConfirmSerializer, OCRDocumentSerializer
from .utils import (
    extract_amount,
    extract_customer_name_from_id,
    extract_date,
    extract_merchant,
    extract_phone_number,
    parse_customer_id_text,
    parse_ocr_text_to_credit_sale,
    run_ocr,
)


def serialize_document(document: OCRDocument):
    transaction = getattr(document, "business_transaction", None) if hasattr(document, "business_transaction") else None
    id_parsed = parse_customer_id_text(document.raw_text) if document.document_type == OCRDocument.CUSTOMER_ID else {}
    serializer = OCRDocumentSerializer(
        {
            "id": document.id,
            "document_type": document.document_type,
            "raw_text": document.raw_text,
            "extracted_amount": document.extracted_amount,
            "extracted_date": document.extracted_date,
            "extracted_merchant": document.extracted_merchant,
            "extracted_phone": document.extracted_phone,
            "extracted_address": id_parsed.get("address"),
            "extracted_id_number": id_parsed.get("id_number"),
            "extracted_dob": id_parsed.get("dob"),
            "status": document.status,
            "created_at": document.created_at,
            "image": document.image.url if document.image else None,
            "business_transaction_id": getattr(transaction, "id", None),
            "linked_customer_id": getattr(document.linked_customer, "id", None),
            "linked_credit_sale_id": getattr(document.linked_credit_sale, "id", None),
            "transaction_type": getattr(transaction, "transaction_type", None),
            "transaction_note": getattr(transaction, "note", None),
        }
    )
    return serializer.data


def _generate_invoice_number():
    return f"INV-{int(timezone.now().timestamp() * 1000)}"


def _sync_customer(profile, name, phone="", address="", notes=""):
    lookup_name = (name or "").strip()
    if not lookup_name:
        raise ValueError("Customer name is required.")

    phone = (phone or "").strip()
    address = (address or "").strip()
    notes = (notes or "").strip()

    customer = None
    if phone:
        customer = Customer.objects.filter(business=profile, phone=phone).first()
    if customer is None:
        customer = Customer.objects.filter(business=profile, name__iexact=lookup_name).first()

    if customer is None:
        customer = Customer.objects.create(
            business=profile,
            name=lookup_name,
            phone=phone,
            address=address,
            notes=notes,
        )
        return customer

    changed = []
    if customer.name != lookup_name:
        customer.name = lookup_name
        changed.append("name")
    if phone and customer.phone != phone:
        customer.phone = phone
        changed.append("phone")
    if address and customer.address != address:
        customer.address = address
        changed.append("address")
    if notes and customer.notes != notes:
        customer.notes = notes
        changed.append("notes")
    if changed:
        customer.save(update_fields=changed + ["updated_at"])
    return customer


def _sync_credit_sale_from_ocr(document, owner, customer, merchant, amount, tx_date, note):
    product, _ = Product.objects.get_or_create(
        business=customer.business,
        name="OCR Receipt Import",
        defaults={
            "category": "OCR Import",
            "stock_quantity": 0,
            "selling_price": amount,
        },
    )

    sale = document.linked_credit_sale
    if sale is None:
        sale = CreditSale.objects.create(
            business=customer.business,
            customer=customer,
            invoice_number=_generate_invoice_number(),
            due_date=tx_date + timedelta(days=14) if tx_date else None,
            notes=note or f"OCR receipt import from {merchant}",
        )
        CreditSaleItem.objects.create(
            credit_sale=sale,
            product=product,
            quantity=1,
            unit_price=amount,
        )
    else:
        sale.customer = customer
        sale.due_date = tx_date + timedelta(days=14) if tx_date else sale.due_date
        sale.notes = note or sale.notes
        sale.save(update_fields=["customer", "due_date", "notes", "updated_at"])

        item = sale.items.first()
        if item is None:
            CreditSaleItem.objects.create(
                credit_sale=sale,
                product=product,
                quantity=1,
                unit_price=amount,
            )
        else:
            item.product = product
            item.quantity = 1
            item.unit_price = amount
            item.save(update_fields=["product", "quantity", "unit_price", "subtotal"])

    sale.calculate_totals()
    sale.save(update_fields=["total_amount", "amount_due", "status", "updated_at"])
    return sale


def _sync_income_transaction(document, owner, customer_name, merchant, amount, tx_date, note):
    transaction = getattr(document, "business_transaction", None) if hasattr(document, "business_transaction") else None
    if transaction is None:
        transaction = BusinessTransaction.objects.create(
            owner=owner,
            ocr_document=document,
            merchant=merchant,
            customer_name=customer_name or merchant,
            amount=amount,
            transaction_type="DEBIT",
            transaction_date=tx_date,
            note=note or "",
            source="OCR",
        )
    else:
        transaction.merchant = merchant
        transaction.customer_name = customer_name or merchant
        transaction.amount = amount
        transaction.transaction_type = "DEBIT"
        transaction.transaction_date = tx_date
        transaction.note = note or ""
        transaction.save(
            update_fields=[
                "merchant",
                "customer_name",
                "amount",
                "transaction_type",
                "transaction_date",
                "note",
            ]
        )
    return transaction


def _detach_linked_records(document):
    transaction = getattr(document, "business_transaction", None) if hasattr(document, "business_transaction") else None
    if transaction is not None:
        transaction.delete()
    if document.linked_credit_sale_id:
        document.linked_credit_sale.delete()
        document.linked_credit_sale = None


class OCRScanView(APIView):
    permission_classes = [IsBusinessAccount]
    parser_classes = [MultiPartParser]

    def post(self, request):
        if getattr(request.user, "account_type", "").upper() != "BUSINESS":
            return Response({"detail": "Business account required."}, status=403)
        image = request.FILES.get("image")
        if not image:
            return Response({"error": "Image file is required"}, status=400)

        scan = OCRScan.objects.create(user=request.user, image=image)
        text = run_ocr(scan.image.path)
        parsed = parse_ocr_text_to_credit_sale(text)
        amount = parsed.get("total_amount") or 0

        scan.extracted_text = text
        scan.detected_amount = amount or None
        scan.save()

        return Response(
            {
                "success": True,
                "scan_id": scan.id,
                "raw_text": text,
                "detected_amount": amount,
                "total_amount": parsed.get("total_amount"),
                "subtotal": parsed.get("subtotal"),
                "tax": parsed.get("tax"),
                "items": parsed.get("items", []),
                "vendor": parsed.get("vendor"),
                "date": parsed.get("date"),
                "bill_type": parsed.get("bill_type"),
                "confidence": parsed.get("confidence"),
                "manual_review_required": parsed.get("manual_review_required", True),
            }
        )


class BusinessOCRUploadView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if getattr(request.user, "account_type", "").upper() != "BUSINESS":
            return Response({"detail": "Business account required."}, status=403)
        image = request.FILES.get("image")
        if not image:
            return Response({"detail": "Image file is required."}, status=400)

        document_type = (request.data.get("document_type") or OCRDocument.RECEIPT).upper()
        if document_type not in {OCRDocument.RECEIPT, OCRDocument.CUSTOMER_ID}:
            return Response({"detail": "Unsupported OCR document type."}, status=400)

        document = OCRDocument.objects.create(
            owner=request.user,
            image=image,
            status=OCRDocument.DRAFT,
            document_type=document_type,
        )

        raw_text = run_ocr(document.image.path) or ""
        document.raw_text = raw_text

        if document_type == OCRDocument.CUSTOMER_ID:
            parsed = parse_customer_id_text(raw_text)
            document.extracted_merchant = parsed.get("customer_name") or extract_customer_name_from_id(raw_text)
            document.extracted_phone = parsed.get("phone") or extract_phone_number(raw_text)
            document.extracted_amount = None
            document.extracted_date = None
            document.save(
                update_fields=[
                    "raw_text",
                    "extracted_merchant",
                    "extracted_phone",
                    "extracted_amount",
                    "extracted_date",
                    "status",
                    "document_type",
                ]
            )
            return Response(serialize_document(document), status=201)

        parsed = parse_ocr_text_to_credit_sale(raw_text)
        document.extracted_amount = parsed.get("total_amount") or extract_amount(raw_text)
        document.extracted_date = extract_date(raw_text)
        document.extracted_merchant = parsed.get("vendor") or extract_merchant(raw_text)
        document.extracted_phone = None
        document.save(
            update_fields=[
                "raw_text",
                "extracted_amount",
                "extracted_date",
                "extracted_merchant",
                "extracted_phone",
                "status",
                "document_type",
            ]
        )

        return Response(serialize_document(document), status=201)


class BusinessOCRListView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def get(self, request):
        if getattr(request.user, "account_type", "").upper() != "BUSINESS":
            return Response({"detail": "Business account required."}, status=403)
        ordering = Case(
            When(status=OCRDocument.DRAFT, then=Value(0)),
            When(status=OCRDocument.CONFIRMED, then=Value(1)),
            default=Value(2),
            output_field=IntegerField(),
        )
        documents = (
            OCRDocument.objects.filter(owner=request.user)
            .select_related("linked_customer", "linked_credit_sale", "business_transaction")
            .annotate(_order=ordering)
            .order_by("_order", "-created_at")
        )
        data = [serialize_document(doc) for doc in documents]
        return Response(data, status=200)


class BusinessOCRDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def get(self, request, pk):
        if getattr(request.user, "account_type", "").upper() != "BUSINESS":
            return Response({"detail": "Business account required."}, status=403)
        document = get_object_or_404(OCRDocument, pk=pk, owner=request.user)
        return Response(serialize_document(document), status=200)

    def patch(self, request, pk):
        if getattr(request.user, "account_type", "").upper() != "BUSINESS":
            return Response({"detail": "Business account required."}, status=403)

        document = get_object_or_404(OCRDocument, pk=pk, owner=request.user)
        serializer = OCRConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return self._save_document(request.user, document, data, allow_existing=True)

    def delete(self, request, pk):
        if getattr(request.user, "account_type", "").upper() != "BUSINESS":
            return Response({"detail": "Business account required."}, status=403)

        document = get_object_or_404(OCRDocument, pk=pk, owner=request.user)
        transaction = getattr(document, "business_transaction", None) if hasattr(document, "business_transaction") else None
        transaction_id = getattr(transaction, "id", None)
        linked_credit_sale_id = document.linked_credit_sale_id

        if transaction is not None:
            transaction.delete()
        if document.linked_credit_sale_id:
            document.linked_credit_sale.delete()

        document.delete()

        return Response(
            {
                "success": True,
                "deleted_document_id": pk,
                "deleted_transaction_id": transaction_id,
                "deleted_credit_sale_id": linked_credit_sale_id,
            },
            status=200,
        )

    def _save_document(self, user, document, data, allow_existing):
        profile, _ = ensure_business_profile(user)

        if document.document_type == OCRDocument.CUSTOMER_ID:
            parsed_id = parse_customer_id_text(document.raw_text)
            customer_name = (data.get("customer_name") or document.extracted_merchant or "").strip()
            if not customer_name:
                return Response({"detail": "Customer name is required."}, status=400)

            customer = _sync_customer(
                profile=profile,
                name=customer_name,
                phone=data.get("customer_phone") or document.extracted_phone or "",
                address=data.get("customer_address") or parsed_id.get("address") or "",
                notes=data.get("note") or "",
            )

            document.extracted_merchant = customer.name
            document.extracted_phone = customer.phone
            document.linked_customer = customer
            document.status = OCRDocument.CONFIRMED
            document.save(
                update_fields=[
                    "extracted_merchant",
                    "extracted_phone",
                    "linked_customer",
                    "status",
                ]
            )
            response_data = serialize_document(document)
            response_data["customer_id"] = customer.id
            return Response(response_data, status=200 if allow_existing else 201)

        merchant = (data.get("merchant") or document.extracted_merchant or "").strip()
        amount = data.get("amount") or document.extracted_amount
        tx_date = data.get("date") or document.extracted_date
        incoming_type = (data.get("transaction_type") or "").upper()

        if not merchant:
            return Response({"detail": "Merchant name is required."}, status=400)
        if not amount:
            return Response({"detail": "Amount is required."}, status=400)
        if not tx_date:
            return Response({"detail": "Transaction date is required."}, status=400)
        if incoming_type not in {"CREDIT", "DEBIT", "LENT", "BORROWED"}:
            return Response({"detail": "Transaction type is required."}, status=400)

        customer_name = (data.get("customer_name") or merchant).strip()
        customer_phone = (data.get("customer_phone") or "").strip()
        note = data.get("note") or ""

        document.extracted_amount = amount
        document.extracted_date = tx_date
        document.extracted_merchant = merchant
        document.status = OCRDocument.CONFIRMED

        if incoming_type in {"CREDIT", "LENT"}:
            customer = _sync_customer(profile, customer_name, customer_phone, "", note)
            _detach_linked_records(document)
            sale = _sync_credit_sale_from_ocr(document, user, customer, merchant, amount, tx_date, note)
            document.linked_customer = customer
            document.linked_credit_sale = sale
            document.save(
                update_fields=[
                    "extracted_amount",
                    "extracted_date",
                    "extracted_merchant",
                    "status",
                    "linked_customer",
                    "linked_credit_sale",
                ]
            )
            response_data = serialize_document(document)
            response_data["credit_sale_id"] = sale.id
            response_data["customer_id"] = customer.id
            return Response(response_data, status=200 if allow_existing else 201)

        customer = _sync_customer(profile, customer_name, customer_phone, "", "")
        if document.linked_credit_sale_id:
            document.linked_credit_sale.delete()
            document.linked_credit_sale = None

        transaction = _sync_income_transaction(document, user, customer.name, merchant, amount, tx_date, note)
        document.linked_customer = customer
        document.save(
            update_fields=[
                "extracted_amount",
                "extracted_date",
                "extracted_merchant",
                "status",
                "linked_customer",
                "linked_credit_sale",
            ]
        )
        response_data = serialize_document(document)
        response_data["transaction_id"] = transaction.id
        response_data["customer_id"] = customer.id
        return Response(response_data, status=200 if allow_existing else 201)


class BusinessOCRConfirmView(BusinessOCRDetailView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def post(self, request, pk):
        if getattr(request.user, "account_type", "").upper() != "BUSINESS":
            return Response({"detail": "Business account required."}, status=403)
        document = get_object_or_404(OCRDocument, pk=pk, owner=request.user)
        if document.status != OCRDocument.DRAFT:
            return Response({"detail": "Only draft OCR documents can be confirmed."}, status=400)

        serializer = OCRConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return self._save_document(request.user, document, data, allow_existing=False)


class CreditSaleOCRProcessView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if getattr(request.user, "account_type", "").upper() != "BUSINESS":
            return Response(
                {"detail": "Business account required. Only business users can upload receipts."},
                status=403,
            )

        image = request.FILES.get("image")
        if not image:
            return Response(
                {"detail": "Image file is required. Please upload a bill or receipt image."},
                status=400,
            )

        ensure_business_profile(request.user)

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_file:
                for chunk in image.chunks():
                    tmp_file.write(chunk)
                tmp_file.flush()
                temp_path = tmp_file.name

            try:
                raw_text = run_ocr(temp_path)
            except Exception as e:
                return Response(
                    {
                        "success": False,
                        "status": "error",
                        "message": f"Failed to extract text from image: {str(e)}",
                        "raw_text": "",
                        "parsed_data": None,
                        "total_amount": None,
                        "subtotal": None,
                        "tax": None,
                        "items": [],
                        "vendor": None,
                        "date": None,
                        "confidence": "low",
                        "manual_review_required": True,
                    },
                    status=400,
                )

            try:
                parsed_data = parse_ocr_text_to_credit_sale(raw_text)
            except Exception as e:
                return Response(
                    {
                        "success": False,
                        "status": "error",
                        "message": f"Failed to parse OCR data: {str(e)}",
                        "raw_text": raw_text,
                        "parsed_data": None,
                        "total_amount": None,
                        "subtotal": None,
                        "tax": None,
                        "items": [],
                        "vendor": None,
                        "date": None,
                        "confidence": "low",
                        "manual_review_required": True,
                    },
                    status=500,
                )

            if not parsed_data:
                parsed_data = {
                    "customer_name": "",
                    "vendor": None,
                    "items": [],
                    "total_amount": 0.0,
                    "subtotal": None,
                    "tax": None,
                    "date": None,
                    "bill_type": "unknown",
                    "payment_details": {},
                    "confidence": "low",
                    "warning": "Failed to parse data",
                    "manual_review_required": True,
                }

            return Response(
                {
                    "success": True,
                    "status": "success",
                    "message": "OCR processing complete. Review the extracted values and correct anything uncertain.",
                    "raw_text": raw_text,
                    "total_amount": parsed_data.get("total_amount"),
                    "subtotal": parsed_data.get("subtotal"),
                    "tax": parsed_data.get("tax"),
                    "items": parsed_data.get("items", []),
                    "vendor": parsed_data.get("vendor"),
                    "date": parsed_data.get("date"),
                    "parsed_data": parsed_data,
                    "confidence": parsed_data.get("confidence", "medium"),
                    "bill_type": parsed_data.get("bill_type", "unknown"),
                    "manual_review_required": parsed_data.get("manual_review_required", True),
                    "next_step": "Review the extracted data, make any necessary edits, and submit the form to create a credit sale.",
                },
                status=200,
            )

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "status": "error",
                    "message": f"Unexpected error: {str(e)}",
                    "parsed_data": None,
                    "total_amount": None,
                    "subtotal": None,
                    "tax": None,
                    "items": [],
                    "vendor": None,
                    "date": None,
                    "confidence": "low",
                    "manual_review_required": True,
                },
                status=500,
            )
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass
