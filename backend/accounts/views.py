from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import BusinessKYC, BusinessPayment
from .serializers import (
    BusinessKYCSerializer,
    BusinessPaymentSerializer,
    MeSerializer,
    RegisterSerializer,
    SimpleTokenObtainPairSerializer,
    UserSerializer,
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


class SimpleTokenObtainPairView(TokenObtainPairView):
    serializer_class = SimpleTokenObtainPairSerializer
    permission_classes = [AllowAny]


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
