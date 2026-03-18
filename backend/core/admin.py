from django.contrib import admin
from .models import Customer, Transaction, Product, CreditSale, CreditSaleItem, Payment

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "phone", "business", "opening_balance", "created_at")
    search_fields = ("name", "phone", "business__business_name", "business__owner_name")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer",
        "amount",
        "transaction_type",
        "status",
        "due_date",
        "created_at",
    )
    list_filter = ("transaction_type", "status")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "business",
        "sku",
        "stock_quantity",
        "low_stock_threshold",
        "selling_price",
        "updated_at",
    )
    search_fields = ("name", "sku", "business__business_name", "business__owner_name")
    list_filter = ("business",)


@admin.register(CreditSale)
class CreditSaleAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number",
        "customer",
        "business",
        "total_amount",
        "amount_paid",
        "amount_due",
        "status",
        "created_at",
    )
    list_filter = ("status", "business", "created_at")
    search_fields = ("invoice_number", "customer__name", "business__business_name")
    date_hierarchy = "created_at"


@admin.register(CreditSaleItem)
class CreditSaleItemAdmin(admin.ModelAdmin):
    list_display = ("credit_sale", "product", "quantity", "unit_price", "subtotal")
    list_filter = ("credit_sale__business",)
    search_fields = ("credit_sale__invoice_number", "product__name")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer",
        "credit_sale",
        "amount",
        "payment_method",
        "payment_date",
        "created_at",
    )
    list_filter = ("payment_method", "business", "payment_date", "created_at")
    search_fields = ("customer__name", "credit_sale__invoice_number", "reference_number")
    date_hierarchy = "payment_date"
