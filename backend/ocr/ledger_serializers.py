from decimal import Decimal

from rest_framework import serializers

from .models import BusinessTransaction


class BusinessTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessTransaction
        fields = (
            "id",
            "customer_name",
            "merchant",
            "amount",
            "transaction_type",
            "transaction_date",
            "note",
            "source",
            "is_settled",
            "created_at",
        )
        read_only_fields = ("id", "source", "created_at", "is_settled", "merchant")


class BusinessTransactionCreateSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    transaction_type = serializers.ChoiceField(
        choices=(
            ("CREDIT", "CREDIT"),
            ("DEBIT", "DEBIT"),
            ("LENT", "LENT"),
            ("BORROWED", "BORROWED"),
        )
    )
    transaction_date = serializers.DateField()
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class CustomerBalanceSerializer(serializers.Serializer):
    customer_name = serializers.CharField()
    balance = serializers.DecimalField(max_digits=12, decimal_places=2)
