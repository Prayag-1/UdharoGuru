from django.db import IntegrityError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


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
            raise serializers.ValidationError({"email": "Email already registered."}) from exc
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "full_name", "account_type", "kyc_status", "date_joined")
        read_only_fields = ("id", "kyc_status", "date_joined")


class SimpleTokenObtainPairSerializer(TokenObtainPairSerializer):
    # No email verification checks; standard JWT issuance.
    pass
