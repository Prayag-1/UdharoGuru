from django.urls import path

from .views import BusinessOCRConfirmView, BusinessOCRDetailView, BusinessOCRListView, BusinessOCRUploadView

urlpatterns = [
    path("", BusinessOCRListView.as_view(), name="business-ocr-list"),
    path("upload/", BusinessOCRUploadView.as_view(), name="business-ocr-upload"),
    path("<int:pk>/", BusinessOCRDetailView.as_view(), name="business-ocr-detail"),
    path("<int:pk>/confirm/", BusinessOCRConfirmView.as_view(), name="business-ocr-confirm"),
]
