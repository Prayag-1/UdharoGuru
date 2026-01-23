from django.urls import include, path

from .views import BusinessKYCSubmitView, BusinessPaymentSubmitView, BusinessStatusView

urlpatterns = [
    path("payment/submit/", BusinessPaymentSubmitView.as_view(), name="business-payment-submit"),
    path("kyc/submit/", BusinessKYCSubmitView.as_view(), name="business-kyc-submit"),
    path("status/", BusinessStatusView.as_view(), name="business-status"),
    path("ocr/", include("ocr.business_urls")),
    path("ledger/", include("ocr.ledger_urls")),
]
