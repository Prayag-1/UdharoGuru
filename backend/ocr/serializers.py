from decimal import Decimal

from rest_framework import serializers

from .models import BusinessTransaction


class OCRDocumentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    raw_text = serializers.CharField()
    extracted_amount = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    extracted_date = serializers.DateField(allow_null=True)
    extracted_merchant = serializers.CharField(allow_null=True)
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    business_transaction_id = serializers.IntegerField(allow_null=True)
    image = serializers.CharField(allow_null=True, required=False)


class OCRConfirmSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    date = serializers.DateField()
    merchant = serializers.CharField(max_length=255)
    note = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    transaction_type = serializers.ChoiceField(choices=BusinessTransaction.TRANSACTION_TYPES)
