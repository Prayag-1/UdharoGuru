from rest_framework import serializers
from .models import Customer, Transaction


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "address",
            "notes",
            "created_at",
        ]


class TransactionSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source="customer.name")

    class Meta:
        model = Transaction
        fields = [
            "id",
            "customer",
            "customer_name",
            "amount",
            "transaction_type",
            "description",
            "due_date",
            "status",
            "created_at",
        ]
