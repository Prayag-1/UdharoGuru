from django.urls import path

from .invoice_views import InvoiceDetailView, InvoiceGenerateView, InvoiceListView

urlpatterns = [
    path("", InvoiceListView.as_view(), name="business-invoice-list"),
    path("<int:pk>/", InvoiceDetailView.as_view(), name="business-invoice-detail"),
    path("<int:transaction_id>/generate/", InvoiceGenerateView.as_view(), name="business-invoice-generate"),
]
