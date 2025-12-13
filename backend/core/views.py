from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from .models import Customer, Transaction
from .serializers import CustomerSerializer, TransactionSerializer
from django.db.models import Sum
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Customer.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
    @action(detail=True, methods=["get"])
    def balance(self, request, pk=None):
        customer = self.get_object()

        credit = customer.transactions.filter(
            transaction_type="CREDIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        debit = customer.transactions.filter(
            transaction_type="DEBIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        return Response({
            "customer_id": customer.id,
            "customer_name": customer.name,
            "credit_total": credit,
            "debit_total": debit,
            "balance": credit - debit,
        })


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Only allow users to see transactions
        linked to their own customers
        """
        queryset = Transaction.objects.filter(
            customer__owner=self.request.user
        )

        customer_id = self.request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        return queryset

    def perform_create(self, serializer):
        """
        Extra safety check to prevent users
        from creating transactions for
        other users' customers
        """
        customer = serializer.validated_data["customer"]

        if customer.owner != self.request.user:
            raise PermissionError("Not allowed to add transaction for this customer")

        serializer.save()

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """
        Secure summary endpoint
        URL: /api/transactions/summary/?customer=<id>
        """
        customer_id = request.query_params.get("customer")
        if not customer_id:
            return Response(
                {"error": "customer parameter is required"},
                status=400
            )

        qs = Transaction.objects.filter(
            customer_id=customer_id,
            customer__owner=request.user
        )

        credit_total = qs.filter(
            transaction_type="CREDIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        debit_total = qs.filter(
            transaction_type="DEBIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        balance = credit_total - debit_total

        return Response({
            "customer_id": int(customer_id),
            "credit_total": credit_total,
            "debit_total": debit_total,
            "balance": balance,
        })
class TotalOutstandingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        customers = Customer.objects.filter(owner=request.user)

        credit = Transaction.objects.filter(
            customer__in=customers,
            transaction_type="CREDIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        debit = Transaction.objects.filter(
            customer__in=customers,
            transaction_type="DEBIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        return Response({
            "total_credit": credit,
            "total_debit": debit,
            "total_outstanding": credit - debit,
        })
class TopDebtorsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        customers = Customer.objects.filter(owner=request.user)

        data = []

        for customer in customers:
            credit = customer.transactions.filter(
                transaction_type="CREDIT"
            ).aggregate(total=Sum("amount"))["total"] or 0

            debit = customer.transactions.filter(
                transaction_type="DEBIT"
            ).aggregate(total=Sum("amount"))["total"] or 0

            balance = credit - debit

            if balance > 0:
                data.append({
                    "customer_id": customer.id,
                    "customer_name": customer.name,
                    "balance": balance,
                })

        data.sort(key=lambda x: x["balance"], reverse=True)

        return Response(data[:5])
class MonthlySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Transaction.objects.filter(
            customer__owner=request.user
        ).annotate(
            month=TruncMonth("created_at")
        ).values("month", "transaction_type").annotate(
            total=Sum("amount")
        ).order_by("month")

        return Response(qs)
