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

        request.user.business_status = "PAYMENT_SUBMITTED"
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

        request.user.refresh_from_db()
        payment = getattr(request.user, "business_payment", None)
        kyc = getattr(request.user, "business_kyc", None)

        return Response(
            {
                "business_status": request.user.business_status,
                "kyc_status": request.user.kyc_status,
                "payment": {"is_verified": bool(getattr(payment, "is_verified", False))} if payment else None,
                "kyc": {
                    "is_approved": bool(getattr(kyc, "is_approved", False)),
                    "rejection_reason": getattr(kyc, "rejection_reason", "") if kyc else "",
                    "reviewed_at": getattr(kyc, "reviewed_at", None) if kyc else None,
                    "reviewed_by": getattr(getattr(kyc, "reviewed_by", None), "id", None) if kyc else None,
                }
                if kyc
                else None,
            },
            status=status.HTTP_200_OK,
        )
