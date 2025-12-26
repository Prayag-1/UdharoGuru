from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from .models import BusinessKYC, BusinessPayment


@admin.register(BusinessPayment)
class BusinessPaymentAdmin(admin.ModelAdmin):
  list_display = ("user", "transaction_code", "provider", "amount", "is_verified", "created_at")
  list_filter = ("is_verified", "provider")
  search_fields = ("user__email", "transaction_code")
  readonly_fields = ("screenshot_preview", "created_at", "updated_at")
  actions = ["mark_payment_verified"]

  def screenshot_preview(self, obj):
    if obj.screenshot:
      return format_html('<a href="{}" target="_blank">View screenshot</a>', obj.screenshot.url)
    return "-"
  screenshot_preview.short_description = "Screenshot"

  def mark_payment_verified(self, request, queryset):
    updated = queryset.update(is_verified=True)
    self.message_user(request, f"Marked {updated} payment(s) as verified.")
  mark_payment_verified.short_description = "Mark Payment Verified"


@admin.register(BusinessKYC)
class BusinessKYCAdmin(admin.ModelAdmin):
  list_display = ("user", "is_approved", "business_status", "reviewed_by", "reviewed_at", "created_at")
  list_filter = ("is_approved", "country", "city")
  search_fields = ("user__email", "business_name", "registration_pan")
  readonly_fields = (
      "identity_document_preview",
      "payment_screenshot_preview",
      "created_at",
      "updated_at",
  )
  actions = ["approve_kyc", "reject_kyc"]

  def business_status(self, obj):
    return obj.user.business_status
  business_status.short_description = "Business Status"

  def identity_document_preview(self, obj):
    if obj.identity_document:
      return format_html('<a href="{}" target="_blank">View identity document</a>', obj.identity_document.url)
    return "-"
  identity_document_preview.short_description = "Identity Document"

  def payment_screenshot_preview(self, obj):
    if obj.payment_screenshot:
      return format_html('<a href="{}" target="_blank">View payment screenshot</a>', obj.payment_screenshot.url)
    return "-"
  payment_screenshot_preview.short_description = "Payment Screenshot"

  def approve_kyc(self, request, queryset):
    now = timezone.now()
    count = 0
    for kyc in queryset:
      kyc.is_approved = True
      kyc.reviewed_by = request.user
      kyc.reviewed_at = now
      kyc.rejection_reason = ""
      kyc.save(update_fields=["is_approved", "reviewed_by", "reviewed_at", "rejection_reason", "updated_at"])
      kyc.user.business_status = "APPROVED"
      kyc.user.save(update_fields=["business_status"])
      count += 1
    self.message_user(request, f"Approved {count} KYC record(s).")
  approve_kyc.short_description = "Approve KYC"

  def reject_kyc(self, request, queryset):
    now = timezone.now()
    count = 0
    for kyc in queryset:
      if not kyc.rejection_reason:
        kyc.rejection_reason = "Rejected via admin action."
      kyc.is_approved = False
      kyc.reviewed_by = request.user
      kyc.reviewed_at = now
      kyc.save(update_fields=["is_approved", "reviewed_by", "reviewed_at", "rejection_reason", "updated_at"])
      kyc.user.business_status = "REJECTED"
      kyc.user.save(update_fields=["business_status"])
      count += 1
    self.message_user(request, f"Rejected {count} KYC record(s).")
  reject_kyc.short_description = "Reject KYC"
