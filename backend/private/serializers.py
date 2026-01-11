from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import PrivateConnection, PrivateItemLoan, PrivateMoneyTransaction

User = get_user_model()


class PrivateConnectionCreateSerializer(serializers.Serializer):
    invite_code = serializers.CharField(required=True)

    def validate_invite_code(self, value):
        code = value.strip().upper()
        if not code:
            raise serializers.ValidationError("invite_code is required.")
        return code

    def validate(self, attrs):
        request = self.context["request"]
        owner = request.user
        if owner.account_type != "PRIVATE":
            raise serializers.ValidationError("Only private users can create connections.")

        invite_code = attrs["invite_code"]
        try:
            target = User.objects.get(invite_code=invite_code, account_type="PRIVATE")
        except User.DoesNotExist:
            raise serializers.ValidationError({"invite_code": "Invalid invite code."})

        if target.id == owner.id:
            raise serializers.ValidationError({"invite_code": "You cannot connect to yourself."})

        if PrivateConnection.objects.filter(owner=owner, connected_user=target).exists():
            raise serializers.ValidationError({"invite_code": "Connection already exists."})

        attrs["connected_user"] = target
        return attrs

    def create(self, validated_data):
        owner = self.context["request"].user
        target = validated_data["connected_user"]
        connection = PrivateConnection.objects.create(owner=owner, connected_user=target)
        return connection

    def to_representation(self, instance):
        target = instance.connected_user
        return {
            "connected_user": {
                "id": target.id,
                "email": target.email,
                "invite_code": target.invite_code,
            }
        }


class PrivateMoneyTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivateMoneyTransaction
        fields = ("id", "person_name", "amount", "transaction_type", "transaction_date", "note", "created_at")
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        if user.account_type != "PRIVATE":
            raise serializers.ValidationError("Only private users can manage transactions.")
        if attrs.get("amount") is not None and attrs["amount"] <= 0:
            raise serializers.ValidationError({"amount": "Amount must be greater than zero."})
        return attrs


class PrivateMoneySummarySerializer(serializers.Serializer):
    total_receivable = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_payable = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_balance = serializers.DecimalField(max_digits=12, decimal_places=2)


class PrivateItemLoanSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivateItemLoan
        fields = (
            "id",
            "borrower",
            "item_name",
            "item_description",
            "lent_date",
            "expected_return_date",
            "status",
            "reminder_enabled",
            "reminder_interval_days",
            "created_at",
        )
        read_only_fields = ("id", "status", "created_at")

    def validate(self, attrs):
        request = self.context["request"]
        owner = request.user
        if getattr(owner, "account_type", None) != "PRIVATE":
            raise serializers.ValidationError("Only private users can lend items.")

        borrower = attrs.get("borrower")
        if borrower is None:
            raise serializers.ValidationError({"borrower": "Borrower is required."})
        if borrower.id == owner.id:
            raise serializers.ValidationError({"borrower": "You cannot lend items to yourself."})
        if getattr(borrower, "account_type", None) != "PRIVATE":
            raise serializers.ValidationError({"borrower": "Borrower must be a private user."})
        if not PrivateConnection.objects.filter(owner=owner, connected_user=borrower).exists():
            raise serializers.ValidationError({"borrower": "Borrower must be connected to you."})
        if attrs.get("status") == PrivateItemLoan.RETURNED:
            raise serializers.ValidationError({"status": "Cannot create a returned item. Use return endpoint."})
        return attrs


class PrivateItemReturnSerializer(serializers.Serializer):
    status = serializers.CharField()

    def validate(self, attrs):
        loan = self.context["loan"]
        status = attrs.get("status", "").upper()
        if status != PrivateItemLoan.RETURNED:
            raise serializers.ValidationError({"status": "Status must be RETURNED."})
        if loan.status != PrivateItemLoan.ACTIVE:
            raise serializers.ValidationError("Item is not active.")
        return attrs

    def save(self, **kwargs):
        loan = self.context["loan"]
        loan.status = PrivateItemLoan.RETURNED
        loan.reminder_enabled = False
        loan.last_reminder_sent_at = None
        loan.save(update_fields=["status", "reminder_enabled", "last_reminder_sent_at"])
        return loan
