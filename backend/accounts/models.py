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

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    account_type = models.CharField(max_length=10, choices=ACCOUNT_TYPES)
    kyc_status = models.CharField(max_length=10, choices=KYC_STATUS, default='PENDING')
    is_email_verified = models.BooleanField(default=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return self.email
