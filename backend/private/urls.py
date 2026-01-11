from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    PrivateConnectView,
    PrivateItemLoanViewSet,
    PrivateItemReminderDueView,
    PrivateItemReturnView,
    PrivateMoneySummaryView,
    PrivateMoneyTransactionViewSet,
)

router = DefaultRouter()
router.register(r"transactions", PrivateMoneyTransactionViewSet, basename="private-transactions")
router.register(r"items", PrivateItemLoanViewSet, basename="private-items")

urlpatterns = [
    path("connect/", PrivateConnectView.as_view(), name="private-connect"),
    path("transactions/summary/", PrivateMoneySummaryView.as_view(), name="private-transaction-summary"),
    path("items/reminder-due/", PrivateItemReminderDueView.as_view(), name="private-item-reminder-due"),
    path("items/<int:pk>/return/", PrivateItemReturnView.as_view(), name="private-item-return"),
]

urlpatterns += router.urls
