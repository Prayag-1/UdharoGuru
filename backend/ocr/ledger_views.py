from decimal import Decimal

from django.db.models import F, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBusinessAccount

from .ledger_serializers import (
    BusinessTransactionCreateSerializer,
    BusinessTransactionSerializer,
    CustomerBalanceSerializer,
)
from .models import BusinessTransaction


def _normalize_customer(tx: BusinessTransaction):
    return tx.customer_name or tx.merchant or "Unknown"


class BusinessLedgerListView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def get(self, request):
        qs = BusinessTransaction.objects.filter(owner=request.user).order_by("-transaction_date", "-created_at")
        data = BusinessTransactionSerializer(qs, many=True).data
        return Response(data, status=200)


class BusinessLedgerCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def post(self, request):
        serializer = BusinessTransactionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        incoming_type = (data["transaction_type"] or "").upper()
        model_type = "LENT" if incoming_type in ("CREDIT", "LENT") else "BORROWED"
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


class BusinessCustomerBalancesView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessAccount]

    def get(self, request):
        qs = BusinessTransaction.objects.filter(owner=request.user)
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
        qs = BusinessTransaction.objects.filter(owner=request.user).filter(
            customer_name=name
        )
        data = BusinessTransactionSerializer(qs, many=True).data
        return Response(data, status=200)
