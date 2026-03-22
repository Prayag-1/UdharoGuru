from django.db.models import Case, IntegerField, Value, When
from django.shortcuts import get_object_or_404
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBusinessAccount
from accounts.models import BusinessProfile
from core.models import Customer

from .models import BusinessTransaction, OCRDocument, OCRScan
from .serializers import OCRConfirmSerializer, OCRDocumentSerializer
from .utils import extract_amount, extract_date, extract_merchant, run_ocr, parse_ocr_text_to_credit_sale


def serialize_document(document: OCRDocument):
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
            "business_transaction_id": getattr(document.business_transaction, "id", None)
            if hasattr(document, "business_transaction")
            else None,
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
        amount = extract_amount(text)

        scan.extracted_text = text
        scan.detected_amount = amount
        scan.save()

        return Response(
            {
                "scan_id": scan.id,
                "extracted_text": text,
                "detected_amount": amount,
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
        document.raw_text = raw_text
        document.extracted_amount = extract_amount(raw_text)
        document.extracted_date = extract_date(raw_text)
        document.extracted_merchant = extract_merchant(raw_text)
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
            amount=data["amount"],
            transaction_type=normalized_type,
            transaction_date=data["date"],
            note=data.get("note") or "",
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

        # Get business profile
        profile = BusinessProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response(
                {"detail": "Business profile not found. Complete your profile setup first."},
                status=404
            )

        try:
            # LAYER 1 — Text Extraction
            raw_text = run_ocr(image)
            if not raw_text or not raw_text.strip():
                return Response(
                    {
                        "status": "error",
                        "message": "Could not extract text from image. Try a clearer image.",
                        "raw_text": "",
                        "parsed_data": None
                    },
                    status=400
                )

            # LAYER 2 — Data Parsing
            parsed_data = parse_ocr_text_to_credit_sale(raw_text)

            # LAYER 3 — Return for User Confirmation
            return Response(
                {
                    "status": "success",
                    "message": "OCR processing complete. Review and confirm the data below.",
                    "raw_text": raw_text,
                    "parsed_data": parsed_data,
                    "confidence": parsed_data.get("confidence", "medium"),
                    "next_step": "Edit fields if needed, then submit via credit sale form"
                },
                status=200
            )

        except Exception as e:
            return Response(
                {
                    "status": "error",
                    "message": f"Error processing image: {str(e)}",
                    "parsed_data": None
                },
                status=500
            )


