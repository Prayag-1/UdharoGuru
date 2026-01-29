from decimal import Decimal

from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBusinessAccount

from .ledger_serializers import (
    BusinessTransactionCreateSerializer,
    BusinessTransactionSerializer,
    CustomerBalanceSerializer,
)
from .models import BusinessTransaction, OCRDocument


def _normalize_customer(tx: BusinessTransaction):
    return tx.customer_name or tx.merchant or "Unknown"


class BusinessLedgerListView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def get(self, request):
        qs = BusinessTransaction.objects.filter(owner=request.user).order_by("is_settled", "-transaction_date", "-created_at")
        data = BusinessTransactionSerializer(qs, many=True).data
        return Response(data, status=200)


class BusinessLedgerCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def post(self, request):
        serializer = BusinessTransactionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        incoming_type = (data["transaction_type"] or "").upper()
        model_type = "CREDIT" if incoming_type in ("CREDIT", "LENT") else "DEBIT"
        tx = BusinessTransaction.objects.create(
            owner=request.user,
            customer_name=data["customer_name"],
            merchant=data["customer_name"],
            amount=data["amount"],
            transaction_type=model_type,
            transaction_date=data["transaction_date"],
            note=data.get("note") or "",
            source="MANUAL",
        )
        return Response(BusinessTransactionSerializer(tx).data, status=201)


class BusinessLedgerSettleView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def patch(self, request, pk: int):
        tx = get_object_or_404(BusinessTransaction, pk=pk, owner=request.user)
        if tx.is_settled:
            return Response({"detail": "Transaction already settled."}, status=400)

        tx.is_settled = True
        tx.settled_at = timezone.now()
        tx.save(update_fields=["is_settled", "settled_at"])

        return Response(BusinessTransactionSerializer(tx).data, status=200)


class BusinessLedgerSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def get(self, request):
        tx_qs = BusinessTransaction.objects.filter(owner=request.user, is_settled=False)
        aggregates = tx_qs.aggregate(
            receivable=Sum("amount", filter=Q(transaction_type="CREDIT")),
            payable=Sum("amount", filter=Q(transaction_type="DEBIT")),
        )
        receivable = aggregates.get("receivable") or Decimal("0")
        payable = aggregates.get("payable") or Decimal("0")
        net = receivable - payable
        draft_count = OCRDocument.objects.filter(owner=request.user, status=OCRDocument.DRAFT).count()
        return Response(
            {
                "receivable": receivable,
                "payable": payable,
                "net": net,
                "pending_ocr_drafts": draft_count,
            },
            status=200,
        )


class BusinessCustomerBalancesView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def get(self, request):
        qs = BusinessTransaction.objects.filter(owner=request.user, is_settled=False)
        rows = []
        for tx in qs:
            name = _normalize_customer(tx)
            credit = (tx.transaction_type or "").upper() in ("CREDIT", "LENT")
            signed = tx.amount if credit else -tx.amount
            rows.append((name, signed))

        balances = {}
        for name, val in rows:
            balances[name] = balances.get(name, Decimal("0")) + Decimal(val)

        payload = [{"customer_name": k, "balance": v} for k, v in balances.items()]
        serializer = CustomerBalanceSerializer(payload, many=True)
        return Response(serializer.data, status=200)


class BusinessCustomerDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def get(self, request, name):
        qs = (
            BusinessTransaction.objects.filter(owner=request.user)
            .filter(customer_name=name)
            .order_by("is_settled", "-transaction_date", "-created_at")
        )
        data = BusinessTransactionSerializer(qs, many=True).data
        return Response(data, status=200)
