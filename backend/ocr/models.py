from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class OCRScan(models.Model):
    """
    Legacy scan model retained for backward compatibility.
    New OCR flows should use OCRDocument instead.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to="ocr/")
    extracted_text = models.TextField(blank=True)
    detected_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"OCRScan {self.id} by {self.user}"


class OCRDocument(models.Model):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    STATUS_CHOICES = (
        (DRAFT, "Draft"),
        (CONFIRMED, "Confirmed"),
    )

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="ocr_documents")
    image = models.ImageField(upload_to="ocr/documents/")
    raw_text = models.TextField(blank=True)
    extracted_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    extracted_date = models.DateField(null=True, blank=True)
    extracted_merchant = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "status"]),
            models.Index(fields=["owner", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=["DRAFT", "CONFIRMED"]),
                name="ocr_document_status_valid",
            ),
        ]

    def __str__(self):
        return f"OCRDocument {self.id} ({self.status})"


class BusinessTransaction(models.Model):
    CREDIT = "CREDIT"
    DEBIT = "DEBIT"
    TRANSACTION_TYPES = (
        (CREDIT, "Credit"),
        (DEBIT, "Debit"),
    )

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="business_transactions")
    ocr_document = models.OneToOneField(
        OCRDocument, on_delete=models.SET_NULL, null=True, blank=True, related_name="business_transaction"
    )
    merchant = models.CharField(max_length=255)
    customer_name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    transaction_date = models.DateField()
    note = models.TextField(blank=True, null=True)
    source = models.CharField(
        max_length=10,
        choices=(("MANUAL", "Manual"), ("OCR", "OCR")),
        default="MANUAL",
    )
    is_settled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "transaction_date"]),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(amount__gt=0), name="business_money_amount_gt_zero"),
            models.CheckConstraint(
                check=models.Q(transaction_type__in=["CREDIT", "DEBIT"]),
                name="business_transaction_type_valid",
            ),
        ]

    def __str__(self):
        return f"{self.owner.email} - {self.transaction_type} {self.amount} for {self.merchant}"
