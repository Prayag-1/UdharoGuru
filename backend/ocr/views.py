from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .models import OCRScan
from .utils import run_ocr, extract_amount


class OCRScanView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        image = request.FILES.get("image")

        if not image:
            return Response(
                {"error": "Image file is required"},
                status=400
            )

        scan = OCRScan.objects.create(
            user=request.user,
            image=image
        )

        text = run_ocr(scan.image.path)
        amount = extract_amount(text)

        scan.extracted_text = text
        scan.detected_amount = amount
        scan.save()

        return Response({
            "scan_id": scan.id,
            "extracted_text": text,
            "detected_amount": amount,
        })

