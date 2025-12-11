from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum

from .models import Customer, Transaction
from .serializers import CustomerSerializer, TransactionSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer

    def get_queryset(self):
        queryset = Transaction.objects.all()
        customer_id = self.request.query_params.get("customer")

        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        return queryset

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """
        URL: /api/transactions/summary/?customer=<id>
        Returns credit total, debit total and balance
        """
        customer_id = request.query_params.get("customer")
        if not customer_id:
            return Response({"error": "customer parameter is required"}, status=400)

        qs = Transaction.objects.filter(customer_id=customer_id)

        credit_total = qs.filter(transaction_type="CREDIT").aggregate(total=Sum("amount"))["total"] or 0
        debit_total = qs.filter(transaction_type="DEBIT").aggregate(total=Sum("amount"))["total"] or 0

        balance = credit_total - debit_total

        return Response({
            "customer_id": int(customer_id),
            "credit_total": credit_total,
            "debit_total": debit_total,
            "balance": balance
        })
