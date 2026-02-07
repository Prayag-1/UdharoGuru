import uuid

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBusinessAccount

from .ledger_serializers import InvoiceSerializer
from .models import BusinessTransaction, Invoice


class InvoiceGenerateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def post(self, request, transaction_id: int):
        tx = get_object_or_404(
            BusinessTransaction.objects.select_related("invoice"),
            pk=transaction_id,
            owner=request.user,
        )

        if not tx.is_settled:
            return Response({"detail": "Transaction must be settled before invoicing."}, status=400)

        if getattr(tx, "invoice", None):
            return Response({"detail": "Invoice already exists for this transaction."}, status=400)

        invoice_number = self._generate_invoice_number(request.user.id)
        invoice = Invoice.objects.create(
            business=request.user,
            transaction=tx,
            invoice_number=invoice_number,
            total_amount=tx.amount,
            customer_name=tx.customer_name or tx.merchant,
        )
        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data, status=201)

    def _generate_invoice_number(self, user_id: int) -> str:
        # Simple per-business unique number with timestamp + random tail
        timestamp = timezone.now().strftime("%Y%m%d%H%M%S%f")
        random_tail = uuid.uuid4().hex[:6].upper()
        return f"INV-{user_id}-{timestamp}-{random_tail}"


class InvoiceListView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def get(self, request):
        qs = Invoice.objects.filter(business=request.user).select_related("transaction").order_by("-issued_at", "-id")
        serializer = InvoiceSerializer(qs, many=True)
        return Response(serializer.data, status=200)


class InvoiceDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def get(self, request, pk: int):
        invoice = get_object_or_404(
            Invoice.objects.select_related("transaction"),
            pk=pk,
            business=request.user,
        )
        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data, status=200)
