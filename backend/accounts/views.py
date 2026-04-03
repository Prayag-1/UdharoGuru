from django.conf import settings
from django.core.mail import send_mail
from django.utils.crypto import get_random_string
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import BusinessKYC, BusinessPayment, BusinessProfile, LoginOTP
from .serializers import (
    BusinessKYCSerializer,
    BusinessPaymentSerializer,
    BusinessProfileSerializer,
    LoginRequestSerializer,
    MeSerializer,
    RegisterSerializer,
    UserSerializer,
    VerifyOTPSerializer,
)

ALLOWED_BUSINESS_STATUSES = {"PAYMENT_PENDING", "KYC_PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"}


def _normalize_business_status(user):
    current = getattr(user, "business_status", None)
    if current not in ALLOWED_BUSINESS_STATUSES:
        user.business_status = "PAYMENT_PENDING"
        user.save(update_fields=["business_status"])
        return user.business_status
    return current


def _sync_with_kyc(user):
    """
    Keep business_status and KYC.is_approved aligned.
    """
    kyc = getattr(user, "business_kyc", None)
    if not kyc:
        return None
    if kyc.is_approved and user.business_status != "APPROVED":
        user.business_status = "APPROVED"
        user.save(update_fields=["business_status"])
    elif user.business_status == "APPROVED" and not kyc.is_approved:
        kyc.is_approved = True
        kyc.save(update_fields=["is_approved", "updated_at"])
    return kyc


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "message": "Registration successful.",
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


def _generate_otp():
    return get_random_string(6, allowed_chars="0123456789")


def _send_otp_email(user, otp):
    send_mail(
        subject="Your OTP Code",
        message=f"Your OTP is {otp}. It expires in {settings.OTP_EXPIRY_MINUTES} minutes.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        LoginOTP.objects.filter(user=user).delete()
        otp = _generate_otp()
        login_otp = LoginOTP.objects.create(user=user, otp=otp)

        try:
            _send_otp_email(user, otp)
        except Exception:
            login_otp.delete()
            return Response(
                {"detail": "Unable to send OTP email. Check SMTP configuration and try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "otp_required": True,
                "user_id": user.id,
                "email": user.email,
                "message": "OTP sent to your email.",
            },
            status=status.HTTP_200_OK,
        )


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        login_otp = serializer.validated_data["login_otp"]
        login_otp.delete()

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "message": "OTP verified successfully.",
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        request.user.refresh_from_db()
        _normalize_business_status(request.user)
        _sync_with_kyc(request.user)
        return Response(MeSerializer(request.user).data, status=status.HTTP_200_OK)


class BusinessOnlyMixin:
    def _ensure_business(self, request):
        user = request.user
        if user.account_type != "BUSINESS":
            return Response({"detail": "Business account required."}, status=status.HTTP_403_FORBIDDEN)
        return None


class BusinessPaymentSubmitView(BusinessOnlyMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        forbidden = self._ensure_business(request)
        if forbidden:
            return forbidden

        try:
            instance = BusinessPayment.objects.get(user=request.user)
        except BusinessPayment.DoesNotExist:
            instance = None

        serializer = BusinessPaymentSerializer(instance=instance, data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        request.user.business_status = "KYC_PENDING"
        request.user.save(update_fields=["business_status"])

        return Response(BusinessPaymentSerializer(payment).data, status=status.HTTP_200_OK)


class BusinessKYCSubmitView(BusinessOnlyMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        forbidden = self._ensure_business(request)
        if forbidden:
            return forbidden

        try:
            instance = BusinessKYC.objects.get(user=request.user)
        except BusinessKYC.DoesNotExist:
            instance = None

        serializer = BusinessKYCSerializer(instance=instance, data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        kyc = serializer.save()

        request.user.kyc_status = "PENDING"
        request.user.business_status = "UNDER_REVIEW"
        request.user.save(update_fields=["kyc_status", "business_status"])

        return Response(BusinessKYCSerializer(kyc).data, status=status.HTTP_200_OK)


class BusinessStatusView(BusinessOnlyMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        forbidden = self._ensure_business(request)
        if forbidden:
            return forbidden

        request.user.refresh_from_db(fields=["business_status", "kyc_status"])
        payment = getattr(request.user, "business_payment", None)
        kyc = getattr(request.user, "business_kyc", None)
        current_status = _normalize_business_status(request.user)
        synced_kyc = _sync_with_kyc(request.user)
        if synced_kyc:
            kyc = synced_kyc
        if current_status == "UNDER_REVIEW" and kyc is None:
            current_status = "KYC_PENDING"
            request.user.business_status = current_status
            request.user.save(update_fields=["business_status"])

        return Response(
            {
                "business_status": current_status,
                "kyc_status": request.user.kyc_status,
                "payment": {"is_verified": bool(getattr(payment, "is_verified", False))} if payment else None,
                "kyc": {
                    "is_approved": bool(getattr(kyc, "is_approved", False)),
                    "rejection_reason": getattr(kyc, "rejection_reason", "") if kyc else "",
                    "reviewed_at": getattr(kyc, "reviewed_at", None) if kyc else None,
                }
                if kyc
                else None,
            },
            status=status.HTTP_200_OK,
        )


class BusinessProfileView(BusinessOnlyMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        forbidden = self._ensure_business(request)
        if forbidden:
            return forbidden

        profile = BusinessProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response({"detail": "Business profile not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(BusinessProfileSerializer(profile).data, status=status.HTTP_200_OK)

    def post(self, request):
        forbidden = self._ensure_business(request)
        if forbidden:
            return forbidden

        if BusinessProfile.objects.filter(user=request.user).exists():
            return Response({"detail": "Business profile already exists."}, status=status.HTTP_409_CONFLICT)

        serializer = BusinessProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(BusinessProfileSerializer(profile).data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        forbidden = self._ensure_business(request)
        if forbidden:
            return forbidden

        profile = BusinessProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response({"detail": "Business profile not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = BusinessProfileSerializer(
            profile,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(BusinessProfileSerializer(profile).data, status=status.HTTP_200_OK)
