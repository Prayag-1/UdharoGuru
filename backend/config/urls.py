from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.views import (
    CustomerViewSet,
    MonthlySummaryView,
    ProductViewSet,
    CreditSaleViewSet,
    PaymentViewSet,
    TopDebtorsView,
    TotalOutstandingView,
    TransactionViewSet,
    BusinessDashboardView,
)
from core.payment_request_views import PaymentRequestViewSet

router = DefaultRouter()
router.register(r"customers", CustomerViewSet, basename="customers")
router.register(r"transactions", TransactionViewSet, basename="transactions")
router.register(r"products", ProductViewSet, basename="products")
router.register(r"credit-sales", CreditSaleViewSet, basename="credit-sales")
router.register(r"payments", PaymentViewSet, basename="payments")
router.register(r"payment-requests", PaymentRequestViewSet, basename="payment-requests")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/business/dashboard/", BusinessDashboardView.as_view()),
    path("api/business/", include("accounts.business_urls")),
    path("api/private/", include("private.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include(router.urls)),
    path("api/ocr/", include("ocr.urls")),
    path("api/analytics/total-outstanding/", TotalOutstandingView.as_view()),
    path("api/analytics/top-debtors/", TopDebtorsView.as_view()),
    path("api/analytics/monthly-summary/", MonthlySummaryView.as_view()),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
