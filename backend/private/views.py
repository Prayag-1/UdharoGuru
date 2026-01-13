from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Group, GroupMember, PrivateConnection, PrivateItemLoan, PrivateMoneyTransaction
from .permissions import IsPrivateAccount
from .serializers import (
    FriendSerializer,
    GroupListSerializer,
    GroupMemberActionSerializer,
    GroupSerializer,
    PrivateConnectionCreateSerializer,
    PrivateConnectionSerializer,
    PrivateFriendAddSerializer,
    PrivateMoneySummarySerializer,
    PrivateMoneyTransactionSerializer,
    PrivateItemLoanSerializer,
    PrivateItemReturnSerializer,
)

User = get_user_model()


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


class PrivateFriendAddView(APIView):
    permission_classes = [IsPrivateAccount]

    def post(self, request):
        serializer = PrivateFriendAddSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        friend = serializer.save()
        return Response(serializer.to_representation(friend), status=status.HTTP_201_CREATED)


class PrivateFriendsListView(APIView):
    permission_classes = [IsPrivateAccount]

    def get(self, request):
        user = request.user
        qs = PrivateConnection.objects.filter(models.Q(owner=user) | models.Q(connected_user=user)).select_related(
            "owner", "connected_user"
        )
        seen = {}
        for conn in qs:
            counterpart = conn.connected_user if conn.owner_id == user.id else conn.owner
            if counterpart.id not in seen:
                seen[counterpart.id] = {
                    "id": counterpart.id,
                    "email": counterpart.email,
                    "invite_code": counterpart.invite_code,
                    "connected_at": conn.created_at,
                }
            else:
                if conn.created_at < seen[counterpart.id]["connected_at"]:
                    seen[counterpart.id]["connected_at"] = conn.created_at
        serializer = FriendSerializer(seen.values(), many=True)
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


class GroupView(APIView):
    permission_classes = [IsPrivateAccount]

    def get(self, request):
        memberships = GroupMember.objects.filter(user=request.user).select_related("group")
        results = []
        for membership in memberships:
            results.append(
                {
                    "id": membership.group.id,
                    "name": membership.group.name,
                    "member_count": membership.group.memberships.count(),
                    "role": membership.role,
                    "created_at": membership.group.created_at,
                }
            )
        serializer = GroupListSerializer(results, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = GroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save(owner=request.user)
        GroupMember.objects.create(group=group, user=request.user, role=GroupMember.ADMIN)
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)


class GroupMemberAddView(APIView):
    permission_classes = [IsPrivateAccount]

    def post(self, request, group_id):
        group = get_object_or_404(Group, pk=group_id)
        membership = get_object_or_404(GroupMember, group=group, user=request.user)
        if membership.role != GroupMember.ADMIN:
            return Response({"detail": "Admin only."}, status=status.HTTP_403_FORBIDDEN)

        serializer = GroupMemberActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_id = serializer.validated_data["user_id"]
        target = get_object_or_404(User, pk=user_id, account_type="PRIVATE")

        if GroupMember.objects.filter(group=group, user=target).exists():
            return Response({"detail": "User already in group."}, status=status.HTTP_400_BAD_REQUEST)

        connected = PrivateConnection.objects.filter(
            models.Q(owner=request.user, connected_user=target)
            | models.Q(owner=target, connected_user=request.user)
        ).exists()
        if not connected:
            return Response({"detail": "User must be your friend."}, status=status.HTTP_400_BAD_REQUEST)

        GroupMember.objects.create(group=group, user=target, role=GroupMember.MEMBER)
        return Response({"detail": "Member added."}, status=status.HTTP_201_CREATED)


class GroupMemberRemoveView(APIView):
    permission_classes = [IsPrivateAccount]

    def post(self, request, group_id):
        group = get_object_or_404(Group, pk=group_id)
        membership = get_object_or_404(GroupMember, group=group, user=request.user)
        if membership.role != GroupMember.ADMIN:
            return Response({"detail": "Admin only."}, status=status.HTTP_403_FORBIDDEN)

        serializer = GroupMemberActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_id = serializer.validated_data["user_id"]
        target_member = get_object_or_404(GroupMember, group=group, user__id=user_id)
        if target_member.user_id == group.owner_id:
            return Response({"detail": "Cannot remove owner."}, status=status.HTTP_400_BAD_REQUEST)

        target_member.delete()
        return Response({"detail": "Member removed."}, status=status.HTTP_200_OK)
