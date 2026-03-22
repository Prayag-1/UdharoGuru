from django.urls import path
from .views import OCRScanView, CreditSaleOCRProcessView

urlpatterns = [
    path("scan/", OCRScanView.as_view()),
    path("process-credit-sale/", CreditSaleOCRProcessView.as_view(), name="process-credit-sale-ocr"),
]
