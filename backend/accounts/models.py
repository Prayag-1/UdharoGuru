from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, full_name, account_type, password=None):
        if not email:
            raise ValueError("Email is required")

        email = self.normalize_email(email)
        user = self.model(
            email=email,
            full_name=full_name,
            account_type=account_type,
        )
        if account_type == 'BUSINESS':
            user.business_status = 'PAYMENT_PENDING'
        else:
            user.business_status = 'APPROVED'
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password):
        user = self.create_user(
            email=email,
            full_name=full_name,
            account_type='BUSINESS',
            password=password,
        )
        user.is_staff = True
        user.is_superuser = True
        user.kyc_status = 'APPROVED'
        user.business_status = 'APPROVED'
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    ACCOUNT_TYPES = (
        ('PRIVATE', 'Private'),
        ('BUSINESS', 'Business'),
    )

    KYC_STATUS = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )
    BUSINESS_STATUS = (
        ('PAYMENT_PENDING', 'Payment Pending'),
        ('KYC_PENDING', 'KYC Pending'),
        ('UNDER_REVIEW', 'Under Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    account_type = models.CharField(max_length=10, choices=ACCOUNT_TYPES)
    kyc_status = models.CharField(max_length=10, choices=KYC_STATUS, default='PENDING')
    business_status = models.CharField(
        max_length=20,
        choices=BUSINESS_STATUS,
        default='PAYMENT_PENDING',
    )
    is_email_verified = models.BooleanField(default=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return self.email


class BusinessPayment(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='business_payment',
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=18000)
    provider = models.CharField(max_length=100, default="Fonepay")
    transaction_code = models.CharField(max_length=100)
    screenshot = models.ImageField(upload_to="payments/")
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payment {self.transaction_code} for {self.user.email}"


class BusinessKYC(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='business_kyc',
    )
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    gender = models.CharField(max_length=50)
    dob = models.DateField()
    country = models.CharField(max_length=100)
    city = models.CharField(max_length=100)
    phone = models.CharField(max_length=50)
    address = models.TextField()
    business_name = models.CharField(max_length=255)
    registration_pan = models.CharField(max_length=255)
    industry = models.CharField(max_length=255)
    website = models.URLField(blank=True)
    identity_type = models.CharField(max_length=100)
    identity_number = models.CharField(max_length=255)
    identity_document = models.FileField(upload_to="kyc_docs/")
    payment_screenshot = models.FileField(upload_to="kyc_payment/", null=True, blank=True)
    payment_transaction_code = models.CharField(max_length=255, null=True, blank=True)
    is_approved = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='reviewed_kyc',
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"KYC for {self.user.email}"
