from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import CustomerViewSet, TransactionViewSet
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from core.views import (
    TotalOutstandingView,
    TopDebtorsView,
    MonthlySummaryView,
)

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customers')
router.register(r'transactions', TransactionViewSet, basename='transactions')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include(router.urls)),
    path("api/ocr/", include("ocr.urls")),
    path("api/analytics/total-outstanding/", TotalOutstandingView.as_view()),
    path("api/analytics/top-debtors/", TopDebtorsView.as_view()),
    path("api/analytics/monthly-summary/", MonthlySummaryView.as_view()),


]
urlpatterns += static(
    settings.MEDIA_URL,
    document_root=settings.MEDIA_ROOT
)
