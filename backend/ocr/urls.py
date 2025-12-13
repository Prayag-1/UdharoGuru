from django.urls import path
from .views import OCRScanView

urlpatterns = [
    path("scan/", OCRScanView.as_view()),
]
