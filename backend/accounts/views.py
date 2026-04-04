from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import BusinessKYC, BusinessPayment, ensure_business_profile
from .serializers import (
    BusinessKYCSerializer,
    BusinessPaymentSerializer,
    BusinessProfileSerializer,
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


def _sync_business_access_state(user):
    current_status = _normalize_business_status(user)
    if getattr(user, "account_type", "").upper() != "BUSINESS":
        return None, None, current_status

    payment = getattr(user, "business_payment", None)
    kyc = getattr(user, "business_kyc", None)
    next_status = current_status
    next_kyc_status = getattr(user, "kyc_status", "PENDING")
    payment_completed = bool(payment)

    if kyc and not kyc.is_approved and next_kyc_status == "REJECTED":
        next_status = "REJECTED"
    elif not payment_completed:
        next_status = "PAYMENT_PENDING"
        if next_kyc_status == "APPROVED":
            next_kyc_status = "PENDING"
    elif not kyc:
        next_status = "KYC_PENDING"
        if next_kyc_status == "APPROVED":
            next_kyc_status = "PENDING"
    elif kyc.is_approved:
        next_status = "APPROVED"
        next_kyc_status = "APPROVED"
    elif next_kyc_status == "REJECTED":
        next_status = "REJECTED"
    elif current_status == "UNDER_REVIEW":
        next_status = "UNDER_REVIEW"
        next_kyc_status = "PENDING"
    else:
        next_status = "KYC_PENDING"
        next_kyc_status = "PENDING"

    update_fields = []
    if user.business_status != next_status:
        user.business_status = next_status
        update_fields.append("business_status")
    if user.kyc_status != next_kyc_status:
        user.kyc_status = next_kyc_status
        update_fields.append("kyc_status")
    if update_fields:
        user.save(update_fields=update_fields)

    return payment, kyc, next_status


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
        _sync_business_access_state(request.user)
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
        payment, kyc, current_status = _sync_business_access_state(request.user)
        ensure_business_profile(request.user)

        return Response(
            {
                "business_status": current_status,
                "kyc_status": request.user.kyc_status,
                "payment_status": "approved" if payment else "pending",
                "payment": {
                    "is_verified": bool(getattr(payment, "is_verified", False)),
                    "status": "approved",
                }
                if payment
                else {"is_verified": False, "status": "pending"},
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

        profile, _ = ensure_business_profile(request.user)
        return Response(BusinessProfileSerializer(profile).data, status=status.HTTP_200_OK)

    def post(self, request):
        forbidden = self._ensure_business(request)
        if forbidden:
            return forbidden

        profile, created = ensure_business_profile(request.user)
        serializer = BusinessProfileSerializer(profile, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(BusinessProfileSerializer(profile).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def patch(self, request):
        forbidden = self._ensure_business(request)
        if forbidden:
            return forbidden

        profile, _ = ensure_business_profile(request.user)
        serializer = BusinessProfileSerializer(
            profile,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(BusinessProfileSerializer(profile).data, status=status.HTTP_200_OK)
