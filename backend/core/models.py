from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Customer(models.Model):
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="customers",
        null=True,
        blank=True,  # we’ll use this properly once auth is wired
    )
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Transaction(models.Model):
    CREDIT = "CREDIT"
    DEBIT = "DEBIT"

    TRANSACTION_TYPES = [
        (CREDIT, "Credit"),
        (DEBIT, "Debit"),
    ]

    PENDING = "PENDING"
    PAID = "PAID"

    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (PAID, "Paid"),
    ]

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(
        max_length=10,
        choices=TRANSACTION_TYPES,
    )
    description = models.CharField(max_length=255, blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.transaction_type} {self.amount} for {self.customer.name}"
