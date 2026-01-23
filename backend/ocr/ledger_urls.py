from django.urls import path

from .ledger_views import (
    BusinessCustomerBalancesView,
    BusinessCustomerDetailView,
    BusinessLedgerCreateView,
    BusinessLedgerListView,
)

urlpatterns = [
    path("", BusinessLedgerListView.as_view(), name="business-ledger-list"),
    path("add/", BusinessLedgerCreateView.as_view(), name="business-ledger-add"),
    path("customers/", BusinessCustomerBalancesView.as_view(), name="business-ledger-customers"),
    path("customers/<str:name>/", BusinessCustomerDetailView.as_view(), name="business-ledger-customer-detail"),
]
