import re
from urllib.parse import quote

from rest_framework import serializers
from .models import Customer, Transaction, Product, CreditSale, CreditSaleItem, Payment, PaymentRequest


class CustomerSerializer(serializers.ModelSerializer):
    outstanding_balance = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "business",
            "name",
            "phone",
            "address",
            "notes",
            "opening_balance",
            "outstanding_balance",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("id", "business", "created_at", "updated_at", "outstanding_balance")

    def get_outstanding_balance(self, obj):
        return obj.outstanding_balance


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
            "settled_at",
            "created_at",
        ]


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "business",
            "name",
            "sku",
            "category",
            "cost_price",
            "selling_price",
            "stock_quantity",
            "low_stock_threshold",
            "unit",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("id", "business", "created_at", "updated_at")

    def validate(self, attrs):
        stock = attrs.get("stock_quantity")
        low_stock = attrs.get("low_stock_threshold")
        cost = attrs.get("cost_price")
        selling = attrs.get("selling_price")
        if stock is not None and stock < 0:
            raise serializers.ValidationError({"stock_quantity": "Stock quantity cannot be negative."})
        if low_stock is not None and low_stock < 0:
            raise serializers.ValidationError({"low_stock_threshold": "Low stock threshold cannot be negative."})
        if cost is not None and cost < 0:
            raise serializers.ValidationError({"cost_price": "Cost price cannot be negative."})
        if selling is not None and selling < 0:
            raise serializers.ValidationError({"selling_price": "Selling price cannot be negative."})
        return attrs


class CreditSaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source="product.name")
    product_sku = serializers.ReadOnlyField(source="product.sku")
    available_stock = serializers.SerializerMethodField()

    class Meta:
        model = CreditSaleItem
        fields = [
            "id",
            "product",
            "product_name",
            "product_sku",
            "quantity",
            "unit_price",
            "subtotal",
            "available_stock",
        ]
        read_only_fields = ("id", "subtotal", "available_stock")

    def get_available_stock(self, obj):
        if obj.product:
            return obj.product.stock_quantity
        return 0

    def validate(self, attrs):
        quantity = attrs.get("quantity")
        unit_price = attrs.get("unit_price")
        product = attrs.get("product")

        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({"quantity": "Quantity must be greater than zero."})
        if unit_price is not None and unit_price < 0:
            raise serializers.ValidationError({"unit_price": "Unit price cannot be negative."})
        
        # Check stock if updating existing item
        if product:
            instance = self.instance
            if instance and instance.product == product:
                # Same product, check if new quantity is available
                if quantity and product.stock_quantity + instance.quantity < quantity:
                    raise serializers.ValidationError(
                        {"quantity": f"Insufficient stock. Available: {product.stock_quantity + instance.quantity}"}
                    )
            else:
                # New product or different product
                if quantity and product.stock_quantity < quantity:
                    raise serializers.ValidationError(
                        {"quantity": f"Insufficient stock. Available: {product.stock_quantity}"}
                    )
        
        return attrs


class CreditSaleSerializer(serializers.ModelSerializer):
    items = CreditSaleItemSerializer(many=True, read_only=True)
    customer_name = serializers.ReadOnlyField(source="customer.name")
    customer_balance = serializers.SerializerMethodField()

    class Meta:
        model = CreditSale
        fields = [
            "id",
            "business",
            "customer",
            "customer_name",
            "customer_balance",
            "invoice_number",
            "total_amount",
            "amount_paid",
            "amount_due",
            "due_date",
            "status",
            "notes",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = (
            "id",
            "business",
            "total_amount",
            "amount_due",
            "status",
            "items",
            "created_at",
            "updated_at",
            "customer_name",
            "customer_balance",
        )

    def get_customer_balance(self, obj):
        return obj.customer.outstanding_balance

    def validate(self, attrs):
        amount_paid = attrs.get("amount_paid", 0)
        if amount_paid < 0:
            raise serializers.ValidationError({"amount_paid": "Amount paid cannot be negative."})
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source="customer.name")
    sale_invoice = serializers.ReadOnlyField(source="credit_sale.invoice_number")
    sale_total = serializers.ReadOnlyField(source="credit_sale.total_amount")
    sale_amount_due = serializers.ReadOnlyField(source="credit_sale.amount_due")
    sale_status = serializers.ReadOnlyField(source="credit_sale.status")

    class Meta:
        model = Payment
        fields = [
            "id",
            "business",
            "customer",
            "customer_name",
            "credit_sale",
            "sale_invoice",
            "sale_total",
            "sale_amount_due",
            "sale_status",
            "amount",
            "payment_method",
            "reference_number",
            "notes",
            "payment_date",
            "created_at",
        ]
        read_only_fields = (
            "id",
            "business",
            "customer_name",
            "sale_invoice",
            "sale_total",
            "sale_amount_due",
            "sale_status",
            "created_at",
        )
        extra_kwargs = {
            "customer": {"required": False},
        }

    def validate(self, attrs):
        amount = attrs.get("amount")
        credit_sale = attrs.get("credit_sale")
        customer = attrs.get("customer") or getattr(credit_sale, "customer", None)

        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Payment amount must be greater than zero."})

        if credit_sale and amount:
            if amount > credit_sale.amount_due:
                raise serializers.ValidationError(
                    {"amount": f"Payment exceeds outstanding amount. Outstanding: Rs. {credit_sale.amount_due}"}
                )

        if customer and credit_sale:
            if customer.id != credit_sale.customer_id:
                raise serializers.ValidationError(
                    {"customer": "Payment customer must match sale customer."}
                )

        return attrs

    def create(self, validated_data):
        credit_sale = validated_data["credit_sale"]
        validated_data.setdefault("customer", credit_sale.customer)
        return super().create(validated_data)


class LedgerEntrySerializer(serializers.Serializer):
    """Serializer for ledger entries combining sales and payments."""
    
    date = serializers.DateField()
    type = serializers.CharField()  # 'CREDIT_SALE', 'PAYMENT'
    description = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    running_balance = serializers.DecimalField(max_digits=12, decimal_places=2)


class PaymentRequestSerializer(serializers.ModelSerializer):
    sender_email = serializers.ReadOnlyField(source="sender.email")
    sender_name = serializers.ReadOnlyField(source="sender.full_name")
    receiver_email = serializers.ReadOnlyField(source="receiver.email")
    receiver_name = serializers.ReadOnlyField(source="receiver.full_name")
    customer_name = serializers.ReadOnlyField(source="customer.name")
    customer_phone = serializers.ReadOnlyField(source="customer.phone")
    is_expired = serializers.SerializerMethodField()
    whatsapp_url = serializers.SerializerMethodField()
    whatsapp_message = serializers.SerializerMethodField()

    class Meta:
        model = PaymentRequest
        fields = [
            "id",
            "sender",
            "sender_email",
            "sender_name",
            "receiver",
            "receiver_email",
            "receiver_name",
            "customer",
            "customer_name",
            "customer_phone",
            "amount",
            "description",
            "request_type",
            "status",
            "stripe_session_id",
            "checkout_url",
            "qr_code_data",
            "credit_sale",
            "created_at",
            "paid_at",
            "expires_at",
            "is_expired",
            "whatsapp_url",
            "whatsapp_message",
        ]
        read_only_fields = (
            "id",
            "sender",
            "sender_email",
            "sender_name",
            "receiver_email",
            "receiver_name",
            "customer_name",
            "stripe_session_id",
            "checkout_url",
            "qr_code_data",
            "created_at",
            "paid_at",
            "is_expired",
            "whatsapp_url",
            "whatsapp_message",
        )

    def get_is_expired(self, obj):
        return obj.is_expired()

    def get_whatsapp_message(self, obj):
        if obj.request_type != "BUSINESS" or not obj.customer:
            return ""

        business_name = ""
        if getattr(obj.sender, "business_profile", None):
            business_name = obj.sender.business_profile.business_name
        business_name = business_name or obj.sender.full_name or obj.sender.email

        amount_display = f"{obj.amount:,.2f}"
        message_lines = [
            f"Hello {obj.customer.name},",
            f"This is a payment reminder from {business_name}.",
            f"Amount due: Rs. {amount_display}.",
        ]

        if obj.credit_sale:
            message_lines.append(f"Invoice: {obj.credit_sale.invoice_number}.")

        if obj.description:
            message_lines.append(f"Note: {obj.description}")

        if obj.checkout_url:
            message_lines.append(f"Pay here: {obj.checkout_url}")

        return "\n".join(message_lines)

    def get_whatsapp_url(self, obj):
        if obj.request_type != "BUSINESS" or not obj.customer:
            return ""

        phone = re.sub(r"\D", "", obj.customer.phone or "")
        if not phone:
            return ""

        message = self.get_whatsapp_message(obj)
        return f"https://wa.me/{phone}?text={quote(message)}"

    def validate(self, attrs):
        amount = attrs.get("amount")
        request_type = attrs.get("request_type")
        receiver = attrs.get("receiver")
        customer = attrs.get("customer")

        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Amount must be greater than zero."})

        if request_type == "PRIVATE" and not receiver:
            raise serializers.ValidationError({"receiver": "Receiver is required for private payment requests."})

        if request_type == "BUSINESS" and not customer:
            raise serializers.ValidationError({"customer": "Customer is required for business payment requests."})

        return attrs


class PaymentRequestCreateSerializer(serializers.Serializer):
    """Serializer for creating payment requests."""
    
    receiver_id = serializers.IntegerField(required=False)
    customer_id = serializers.IntegerField(required=False)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    description = serializers.CharField(required=False, allow_blank=True)
    request_type = serializers.ChoiceField(choices=["PRIVATE", "BUSINESS"])
    credit_sale_id = serializers.IntegerField(required=False)

    def validate(self, attrs):
        amount = attrs.get("amount")
        request_type = attrs.get("request_type")
        receiver_id = attrs.get("receiver_id")
        customer_id = attrs.get("customer_id")

        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Amount must be greater than zero."})

        if request_type == "PRIVATE" and not receiver_id:
            raise serializers.ValidationError({"receiver_id": "Receiver ID is required for private requests."})

        if request_type == "BUSINESS" and not customer_id:
            raise serializers.ValidationError({"customer_id": "Customer ID is required for business requests."})

        return attrs
