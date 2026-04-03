from django.contrib.auth import authenticate
from django.db import IntegrityError
from rest_framework import serializers
from rest_framework.exceptions import APIException

from .models import BusinessKYC, BusinessPayment, BusinessProfile, LoginOTP, User


class ConflictError(APIException):
    status_code = 409
    default_detail = "Conflict"
    default_code = "conflict"


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    account_type = serializers.CharField()

    class Meta:
        model = User
        fields = ("email", "full_name", "account_type", "password")

    def validate_account_type(self, value: str) -> str:
        if not value:
            raise serializers.ValidationError("account_type is required.")
        normalized = value.upper()
        if normalized == "PERSONAL":
            normalized = "PRIVATE"
        allowed = {choice for choice, _ in User.ACCOUNT_TYPES}
        if normalized not in allowed:
            raise serializers.ValidationError("account_type must be PRIVATE or BUSINESS.")
        return normalized

    def create(self, validated_data):
        password = validated_data.pop("password")
        try:
            user = User.objects.create_user(password=password, **validated_data)
        except IntegrityError as exc:
            # Surface as HTTP 409 to distinguish from other validation errors.
            raise ConflictError({"email": ["Email already registered."]}) from exc
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "account_type",
            "kyc_status",
            "business_status",
            "invite_code",
            "date_joined",
        )
        read_only_fields = ("id", "kyc_status", "business_status", "invite_code", "date_joined")


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "account_type",
            "kyc_status",
            "business_status",
            "invite_code",
        )
        read_only_fields = fields


class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user_lookup = User.objects.filter(email=email).first()
        if not user_lookup:
            raise serializers.ValidationError({"detail": "User not found."})
        if not user_lookup.is_active:
            raise serializers.ValidationError({"detail": "This account is inactive."})

        user = authenticate(self.context.get("request"), email=email, password=password)
        if not user:
            raise serializers.ValidationError({"detail": "Invalid credentials."})

        attrs["user"] = user
        return attrs


class VerifyOTPSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    otp = serializers.RegexField(r"^\d{6}$", max_length=6, min_length=6)

    def validate(self, attrs):
        user = User.objects.filter(id=attrs["user_id"]).first()
        if not user:
            raise serializers.ValidationError({"detail": "User not found."})

        login_otp = LoginOTP.objects.filter(user=user).order_by("-created_at").first()
        if not login_otp:
            raise serializers.ValidationError({"detail": "OTP not found. Please login again."})
        if login_otp.is_expired():
            login_otp.delete()
            raise serializers.ValidationError({"detail": "OTP expired. Please login again."})
        if login_otp.otp != attrs["otp"]:
            raise serializers.ValidationError({"detail": "Invalid OTP."})

        attrs["user"] = user
        attrs["login_otp"] = login_otp
        return attrs


class BusinessPaymentSerializer(serializers.ModelSerializer):
    transaction_code = serializers.CharField(required=True)
    screenshot = serializers.ImageField(required=False)

    class Meta:
        model = BusinessPayment
        fields = ("transaction_code", "screenshot", "amount", "provider", "is_verified")
        read_only_fields = ("is_verified",)

    def validate(self, attrs):
        instance = self.instance
        if not attrs.get("transaction_code") and not (instance and instance.transaction_code):
            raise serializers.ValidationError({"transaction_code": "transaction_code is required."})
        if not attrs.get("screenshot") and not (instance and getattr(instance, "screenshot", None)):
            raise serializers.ValidationError({"screenshot": "Payment screenshot is required."})
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        return BusinessPayment.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        return instance


class BusinessKYCSerializer(serializers.ModelSerializer):
    identity_document = serializers.FileField(required=False)

    class Meta:
        model = BusinessKYC
        fields = (
            "first_name",
            "last_name",
            "gender",
            "dob",
            "country",
            "city",
            "phone",
            "address",
            "business_name",
            "registration_pan",
            "industry",
            "website",
            "identity_type",
            "identity_number",
            "identity_document",
            "payment_screenshot",
            "payment_transaction_code",
            "is_approved",
        )
        read_only_fields = ("is_approved",)

    REQUIRED_FIELDS = [
        "first_name",
        "last_name",
        "gender",
        "dob",
        "country",
        "city",
        "phone",
        "address",
        "business_name",
        "registration_pan",
        "industry",
        "identity_type",
        "identity_number",
    ]

    def validate(self, attrs):
        instance = self.instance
        for field in self.REQUIRED_FIELDS:
            if not attrs.get(field) and not (instance and getattr(instance, field, None)):
                raise serializers.ValidationError({field: f"{field} is required."})
        if not attrs.get("identity_document") and not (instance and getattr(instance, "identity_document", None)):
            raise serializers.ValidationError({"identity_document": "identity_document is required."})
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        return BusinessKYC.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        return instance


class BusinessProfileSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    logo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = BusinessProfile
        fields = (
            "id",
            "user",
            "business_name",
            "owner_name",
            "phone",
            "email",
            "address",
            "business_type",
            "logo",
            "pan_vat_number",
            "kyc_status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "user", "kyc_status", "created_at", "updated_at")

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and getattr(user, "account_type", None) != "BUSINESS":
            raise serializers.ValidationError("Business account required.")
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user:
            raise serializers.ValidationError("Authentication required.")
        if BusinessProfile.objects.filter(user=user).exists():
            raise serializers.ValidationError("Business profile already exists.")
        return BusinessProfile.objects.create(user=user, **validated_data)
