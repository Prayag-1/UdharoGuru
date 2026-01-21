from django.contrib import admin

from .models import BusinessTransaction, OCRDocument, OCRScan


@admin.register(OCRDocument)
class OCRDocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "status", "created_at", "extracted_amount", "extracted_date", "extracted_merchant")
    list_filter = ("status", "created_at")
    search_fields = ("owner__email", "extracted_merchant", "raw_text")
    readonly_fields = ("created_at",)


@admin.register(BusinessTransaction)
class BusinessTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "merchant", "amount", "transaction_type", "transaction_date", "created_at")
    list_filter = ("transaction_type", "transaction_date")
    search_fields = ("owner__email", "merchant", "note")
    readonly_fields = ("created_at",)


@admin.register(OCRScan)
class OCRScanAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "created_at")
