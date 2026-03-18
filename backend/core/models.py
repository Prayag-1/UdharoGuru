from django.db import models, transaction
from django.core.exceptions import ValidationError
from accounts.models import BusinessProfile


class Customer(models.Model):
    business = models.ForeignKey(
        BusinessProfile,
        on_delete=models.CASCADE,
        related_name="customers",
    )
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    @property
    def outstanding_balance(self):
        credit = self.transactions.filter(
            transaction_type=Transaction.CREDIT
        ).aggregate(total=models.Sum("amount"))["total"] or 0
        debit = self.transactions.filter(
            transaction_type=Transaction.DEBIT
        ).aggregate(total=models.Sum("amount"))["total"] or 0
        return (self.opening_balance or 0) + credit - debit


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
    settled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        if self.amount <= 0:
            raise ValidationError("Transaction amount must be greater than zero.")

    def __str__(self):
        return f"{self.transaction_type} {self.amount} for {self.customer.name}"


class Product(models.Model):
    business = models.ForeignKey(
        BusinessProfile,
        on_delete=models.CASCADE,
        related_name="products",
    )
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=100, blank=True)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock_quantity = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=0)
    unit = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["business", "name"]),
            models.Index(fields=["business", "sku"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.business.business_name})"

    def clean(self):
        if self.stock_quantity < 0:
            raise ValidationError("Stock quantity cannot be negative.")
        if self.low_stock_threshold < 0:
            raise ValidationError("Low stock threshold cannot be negative.")
        if self.cost_price < 0:
            raise ValidationError("Cost price cannot be negative.")
        if self.selling_price < 0:
            raise ValidationError("Selling price cannot be negative.")

    def adjust_stock(self, quantity: int):
        next_value = self.stock_quantity + int(quantity)
        if next_value < 0:
            raise ValidationError("Insufficient stock for this operation.")
        self.stock_quantity = next_value
        self.save(update_fields=["stock_quantity", "updated_at"])


class CreditSale(models.Model):
    """Represents a credit sale of products to a customer."""
    
    PENDING = "PENDING"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (PARTIAL, "Partial"),
        (PAID, "Paid"),
    ]
    
    business = models.ForeignKey(
        BusinessProfile,
        on_delete=models.CASCADE,
        related_name="credit_sales",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="credit_sales",
    )
    invoice_number = models.CharField(max_length=100, unique=True, db_index=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=PENDING,
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "-created_at"]),
            models.Index(fields=["customer", "-created_at"]),
            models.Index(fields=["status"]),
        ]
    
    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.customer.name}"
    
    def calculate_totals(self):
        """Calculate total_amount and amount_due from items."""
        total = self.items.aggregate(
            total=models.Sum(
                models.F("quantity") * models.F("unit_price"),
                output_field=models.DecimalField()
            )
        )["total"] or 0
        
        self.total_amount = total
        self.amount_due = total - self.amount_paid
        self._update_status()
    
    def _update_status(self):
        """Update status based on payment information."""
        if self.amount_due == 0:
            self.status = self.PAID
        elif self.amount_paid > 0 and self.amount_due > 0:
            self.status = self.PARTIAL
        else:
            self.status = self.PENDING
    
    def record_payment(self, amount):
        """Record a payment and update status."""
        if amount <= 0:
            raise ValidationError("Payment amount must be greater than zero.")
        
        self.amount_paid += amount
        self.amount_due = self.total_amount - self.amount_paid
        
        if self.amount_due < 0:
            raise ValidationError("Payment exceeds sale amount.")
        
        self._update_status()
    
    def clean(self):
        if self.amount_paid < 0:
            raise ValidationError("Amount paid cannot be negative.")
        if self.amount_paid > self.total_amount:
            raise ValidationError("Amount paid cannot exceed total amount.")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class CreditSaleItem(models.Model):
    """Represents an individual item/product in a credit sale."""
    
    credit_sale = models.ForeignKey(
        CreditSale,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        related_name="credit_sale_items",
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    class Meta:
        unique_together = [["credit_sale", "product"]]
    
    def __str__(self):
        product_name = self.product.name if self.product else "Deleted Product"
        return f"{product_name} x {self.quantity}"
    
    def calculate_subtotal(self):
        """Calculate subtotal for this item."""
        self.subtotal = self.quantity * self.unit_price
        return self.subtotal
    
    def save(self, *args, **kwargs):
        self.subtotal = self.calculate_subtotal()
        super().save(*args, **kwargs)


class Payment(models.Model):
    """Represents a payment received from a customer for a credit sale."""
    
    CASH = "CASH"
    BANK_TRANSFER = "BANK_TRANSFER"
    CHEQUE = "CHEQUE"
    MOBILE_MONEY = "MOBILE_MONEY"
    OTHER = "OTHER"
    
    PAYMENT_METHODS = [
        (CASH, "Cash"),
        (BANK_TRANSFER, "Bank Transfer"),
        (CHEQUE, "Cheque"),
        (MOBILE_MONEY, "Mobile Money"),
        (OTHER, "Other"),
    ]
    
    business = models.ForeignKey(
        BusinessProfile,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    credit_sale = models.ForeignKey(
        CreditSale,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHODS,
        default=CASH,
    )
    reference_number = models.CharField(max_length=100, blank=True, db_index=True)
    notes = models.TextField(blank=True)
    payment_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["-payment_date", "-created_at"]
        indexes = [
            models.Index(fields=["business", "-payment_date"]),
            models.Index(fields=["customer", "-payment_date"]),
            models.Index(fields=["credit_sale"]),
        ]
    
    def __str__(self):
        return f"Payment of Rs. {self.amount} by {self.customer.name} on {self.payment_date}"
    
    def clean(self):
        if self.amount <= 0:
            raise ValidationError("Payment amount must be greater than zero.")
        if self.amount > self.credit_sale.amount_due:
            raise ValidationError(
                f"Payment exceeds outstanding amount. "
                f"Outstanding: Rs. {self.credit_sale.amount_due}"
            )
        if self.customer_id != self.credit_sale.customer_id:
            raise ValidationError("Payment customer must match sale customer.")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        
        # Use atomic transaction to ensure consistency
        with transaction.atomic():
            # Save the payment
            super().save(*args, **kwargs)
            
            # Update credit sale
            self.credit_sale.record_payment(self.amount)
            self.credit_sale.save(update_fields=["amount_paid", "amount_due", "status", "updated_at"])
    
    def delete(self, *args, **kwargs):
        """Reverse the payment when deleted."""
        with transaction.atomic():
            # Reverse the payment on the sale
            self.credit_sale.amount_paid -= self.amount
            self.credit_sale.amount_due = self.credit_sale.total_amount - self.credit_sale.amount_paid
            self.credit_sale._update_status()
            self.credit_sale.save(update_fields=["amount_paid", "amount_due", "status", "updated_at"])
            
            # Delete the payment record
            super().delete(*args, **kwargs)
