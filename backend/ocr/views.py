from django.db.models import Case, IntegerField, Value, When
from django.shortcuts import get_object_or_404
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import tempfile
import os

from accounts.permissions import IsBusinessAccount
from accounts.models import ensure_business_profile

from .models import BusinessTransaction, OCRDocument, OCRScan
from .serializers import OCRConfirmSerializer, OCRDocumentSerializer
from .utils import extract_amount, extract_date, extract_merchant, parse_ocr_text_to_credit_sale, run_ocr


def serialize_document(document: OCRDocument):
    transaction = getattr(document, "business_transaction", None) if hasattr(document, "business_transaction") else None
    serializer = OCRDocumentSerializer(
        {
            "id": document.id,
            "raw_text": document.raw_text,
            "extracted_amount": document.extracted_amount,
            "extracted_date": document.extracted_date,
            "extracted_merchant": document.extracted_merchant,
            "status": document.status,
            "created_at": document.created_at,
            "image": document.image.url if document.image else None,
            "business_transaction_id": getattr(transaction, "id", None),
            "transaction_type": getattr(transaction, "transaction_type", None),
            "transaction_note": getattr(transaction, "note", None),
        }
    )
    return serializer.data


class OCRScanView(APIView):
    """
    Legacy endpoint kept for backward compatibility with earlier prototypes.
    Restricted to business accounts to avoid private exposure.
    """

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

        document = OCRDocument.objects.create(owner=request.user, image=image, status=OCRDocument.DRAFT)

        raw_text = run_ocr(document.image.path) or ""
        parsed = parse_ocr_text_to_credit_sale(raw_text)
        document.raw_text = raw_text
        document.extracted_amount = parsed.get("total_amount") or extract_amount(raw_text)
        document.extracted_date = extract_date(raw_text)
        document.extracted_merchant = parsed.get("vendor") or extract_merchant(raw_text)
        document.save(
            update_fields=["raw_text", "extracted_amount", "extracted_date", "extracted_merchant", "status"]
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

        incoming_type = (data.get("transaction_type") or "").upper()
        normalized_type = "CREDIT" if incoming_type in ("CREDIT", "LENT") else "DEBIT"

        document.extracted_amount = data["amount"]
        document.extracted_date = data["date"]
        document.extracted_merchant = data["merchant"]

        transaction = getattr(document, "business_transaction", None) if hasattr(document, "business_transaction") else None

        if transaction is None:
            document.status = OCRDocument.CONFIRMED
            document.save(update_fields=["extracted_amount", "extracted_date", "extracted_merchant", "status"])
            transaction = BusinessTransaction.objects.create(
                owner=request.user,
                ocr_document=document,
                merchant=data["merchant"],
                customer_name=data["merchant"],
                amount=data["amount"],
                transaction_type=normalized_type,
                transaction_date=data["date"],
                note=data.get("note") or "",
                source="OCR",
            )
        else:
            document.save(update_fields=["extracted_amount", "extracted_date", "extracted_merchant"])
            transaction.merchant = data["merchant"]
            transaction.customer_name = data["merchant"]
            transaction.amount = data["amount"]
            transaction.transaction_type = normalized_type
            transaction.transaction_date = data["date"]
            transaction.note = data.get("note") or ""
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

        response_data = serialize_document(document)
        response_data["transaction_id"] = transaction.id
        return Response(response_data, status=200)

    def delete(self, request, pk):
        if getattr(request.user, "account_type", "").upper() != "BUSINESS":
            return Response({"detail": "Business account required."}, status=403)

        document = get_object_or_404(OCRDocument, pk=pk, owner=request.user)
        transaction = getattr(document, "business_transaction", None) if hasattr(document, "business_transaction") else None
        transaction_id = getattr(transaction, "id", None)

        if transaction is not None:
            transaction.delete()

        document.delete()

        return Response(
            {
                "success": True,
                "deleted_document_id": pk,
                "deleted_transaction_id": transaction_id,
            },
            status=200,
        )


class BusinessOCRConfirmView(APIView):
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

        document.extracted_amount = data["amount"]
        document.extracted_date = data["date"]
        document.extracted_merchant = data["merchant"]
        document.status = OCRDocument.CONFIRMED
        document.save(update_fields=["extracted_amount", "extracted_date", "extracted_merchant", "status"])

        incoming_type = (data.get("transaction_type") or "").upper()
        normalized_type = "CREDIT" if incoming_type in ("CREDIT", "LENT") else "DEBIT"

        transaction = BusinessTransaction.objects.create(
            owner=request.user,
            ocr_document=document,
            merchant=data["merchant"],
            customer_name=data["merchant"],
            amount=data["amount"],
            transaction_type=normalized_type,
            transaction_date=data["date"],
            note=data.get("note") or "",
            source="OCR",
        )

        response_data = serialize_document(document)
        response_data["transaction_id"] = transaction.id
        return Response(response_data, status=201)


class CreditSaleOCRProcessView(APIView):
    """
    LAYER 3 — OCR Processing for Credit Sales
    
    Endpoint: POST /api/ocr/process-credit-sale/
    
    Flow:
    1. User uploads image
    2. Extract text (Layer 1)
    3. Parse into structured data (Layer 2)
    4. Return for user confirmation (Layer 3 UI)
    
    IMPORTANT: OCR does NOT create credit sales.
    User must confirm in frontend form and then POST to /api/credit-sales/
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        # Verify business user
        if getattr(request.user, "account_type", "").upper() != "BUSINESS":
            return Response(
                {"detail": "Business account required. Only business users can upload receipts."},
                status=403
            )

        # Get image from request
        image = request.FILES.get("image")
        if not image:
            return Response(
                {"detail": "Image file is required. Please upload a bill or receipt image."},
                status=400
            )

        ensure_business_profile(request.user)

        temp_path = None
        try:
            # Save uploaded image to temporary file since run_ocr expects a file path
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                for chunk in image.chunks():
                    tmp_file.write(chunk)
                tmp_file.flush()
                temp_path = tmp_file.name
            
            # Extract text with error handling
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
                    status=400
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
                    status=500
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
                status=200
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
                status=500
            )
        finally:
            # Clean up temporary file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception as e:
                    print(f"Warning: Failed to clean up temp file: {e}")
