from decimal import Decimal

from rest_framework import serializers

from .models import BusinessTransaction


class OCRDocumentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    document_type = serializers.CharField()
    raw_text = serializers.CharField()
    extracted_amount = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    extracted_date = serializers.DateField(allow_null=True)
    extracted_merchant = serializers.CharField(allow_null=True)
    extracted_phone = serializers.CharField(allow_null=True, required=False)
    extracted_address = serializers.CharField(allow_null=True, required=False)
    extracted_id_number = serializers.CharField(allow_null=True, required=False)
    extracted_dob = serializers.CharField(allow_null=True, required=False)
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    business_transaction_id = serializers.IntegerField(allow_null=True)
    linked_customer_id = serializers.IntegerField(allow_null=True, required=False)
    linked_credit_sale_id = serializers.IntegerField(allow_null=True, required=False)
    transaction_type = serializers.CharField(allow_null=True, required=False)
    transaction_note = serializers.CharField(allow_null=True, required=False)
    image = serializers.CharField(allow_null=True, required=False)


class OCRConfirmSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=False)
    date = serializers.DateField(required=False)
    merchant = serializers.CharField(max_length=255, required=False, allow_blank=True)
    note = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    customer_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    customer_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    customer_address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    transaction_type = serializers.ChoiceField(
        choices=(
            ("CREDIT", "CREDIT"),
            ("DEBIT", "DEBIT"),
            ("LENT", "LENT"),
            ("BORROWED", "BORROWED"),
        ),
        required=False,
    )
