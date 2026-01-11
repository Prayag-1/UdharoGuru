from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PrivateConnection, PrivateItemLoan, PrivateMoneyTransaction
from .permissions import IsPrivateAccount
from .serializers import (
    PrivateConnectionCreateSerializer,
    PrivateConnectionSerializer,
    PrivateMoneySummarySerializer,
    PrivateMoneyTransactionSerializer,
    PrivateItemLoanSerializer,
    PrivateItemReturnSerializer,
)


class PrivateConnectView(APIView):
    permission_classes = [IsPrivateAccount]

    def post(self, request):
        serializer = PrivateConnectionCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        connection = serializer.save()
        return Response(serializer.to_representation(connection), status=status.HTTP_201_CREATED)


class PrivateConnectionListView(APIView):
    permission_classes = [IsPrivateAccount]

    def get(self, request):
        qs = PrivateConnection.objects.filter(owner=request.user).select_related("connected_user")
        serializer = PrivateConnectionSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PrivateMoneyTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = PrivateMoneyTransactionSerializer
    permission_classes = [IsPrivateAccount]

    def get_queryset(self):
        return PrivateMoneyTransaction.objects.filter(owner=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class PrivateMoneySummaryView(APIView):
    permission_classes = [IsPrivateAccount]

    def get(self, request):
        qs = PrivateMoneyTransaction.objects.filter(owner=request.user)
        total_receivable = qs.filter(transaction_type=PrivateMoneyTransaction.LENT).aggregate(sum=Sum("amount"))["sum"]
        total_payable = qs.filter(transaction_type=PrivateMoneyTransaction.BORROWED).aggregate(sum=Sum("amount"))["sum"]
        total_receivable = total_receivable or Decimal("0")
        total_payable = total_payable or Decimal("0")
        net_balance = total_receivable - total_payable

        serializer = PrivateMoneySummarySerializer(
            {"total_receivable": total_receivable, "total_payable": total_payable, "net_balance": net_balance}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class PrivateItemLoanViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PrivateItemLoanSerializer
    permission_classes = [IsPrivateAccount]

    def get_queryset(self):
        return PrivateItemLoan.objects.filter(owner=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class PrivateItemReturnView(APIView):
    permission_classes = [IsPrivateAccount]

    def post(self, request, pk):
        loan = get_object_or_404(PrivateItemLoan, pk=pk, owner=request.user)
        serializer = PrivateItemReturnSerializer(
            data={"status": request.data.get("status", PrivateItemLoan.RETURNED)},
            context={"loan": loan},
        )
        serializer.is_valid(raise_exception=True)
        loan = serializer.save()
        return Response(PrivateItemLoanSerializer(loan).data, status=status.HTTP_200_OK)


class PrivateItemReminderDueView(APIView):
    permission_classes = [IsPrivateAccount]

    def get(self, request):
        now = timezone.now()
        loans = PrivateItemLoan.objects.filter(
            owner=request.user,
            status=PrivateItemLoan.ACTIVE,
            reminder_enabled=True,
        )

        due_items = []
        for loan in loans:
            if loan.last_reminder_sent_at is None:
                due_items.append(loan)
                continue
            next_due_at = loan.last_reminder_sent_at + timedelta(days=loan.reminder_interval_days)
            if now >= next_due_at:
                due_items.append(loan)

        data = [
            {
                "id": loan.id,
                "item_name": loan.item_name,
                "owner_email": loan.owner.email,
                "borrower_email": loan.borrower.email,
                "expected_return_date": loan.expected_return_date,
                "reminder_interval_days": loan.reminder_interval_days,
            }
            for loan in due_items
        ]
        return Response(data, status=status.HTTP_200_OK)
