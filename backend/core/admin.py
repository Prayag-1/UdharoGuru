from django.contrib import admin
from .models import Customer, Transaction

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "phone", "email", "created_at")
    search_fields = ("name", "phone", "email")


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
