from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import CustomerViewSet, TransactionViewSet

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customers')
router.register(r'transactions', TransactionViewSet, basename='transactions')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]
