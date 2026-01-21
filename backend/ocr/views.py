from django.db.models import Case, IntegerField, Value, When
from django.shortcuts import get_object_or_404
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBusinessAccount

from .models import BusinessTransaction, OCRDocument, OCRScan
from .serializers import OCRConfirmSerializer, OCRDocumentSerializer
from .utils import extract_amount, extract_date, extract_merchant, run_ocr


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

        transaction = BusinessTransaction.objects.create(
            owner=request.user,
            ocr_document=document,
            merchant=data["merchant"],
            amount=data["amount"],
            transaction_type=data["transaction_type"],
            transaction_date=data["date"],
            note=data.get("note") or "",
        )

        response_data = serialize_document(document)
        response_data["transaction_id"] = transaction.id
        return Response(response_data, status=201)

