from rest_framework import status
from django.conf import settings
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import BusinessKYC, BusinessPayment, User, ensure_business_profile
from .serializers import (
    BusinessKYCSerializer,
    BusinessPaymentSerializer,
    BusinessProfileSerializer,
    EmailVerificationResendSerializer,
    EmailVerificationSerializer,
    ForgotPasswordRequestSerializer,
    MeSerializer,
    PasswordResetResendSerializer,
    PasswordResetSerializer,
    PasswordResetVerifySerializer,
    RegisterSerializer,
    SimpleTokenObtainPairSerializer,
    TwoFactorResendSerializer,
    TwoFactorToggleSerializer,
    TwoFactorVerifySerializer,
    UserSerializer,
)
from .services.otp_service import (
    OTPCooldownError,
    OTPError,
    create_and_send_otp,
    resend_otp,
    verify_otp,
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
        
        # Send email verification OTP
        try:
            create_and_send_otp(user=user, purpose='EMAIL_VERIFICATION')
        except Exception as e:
            # Log but don't fail - user is created
            import logging
            logging.error(f"Failed to send email verification OTP for {user.email}: {str(e)}")
        
        return Response(
            {
                "email_verification_required": True,
                "email": user.email,
                "message": "Verification code sent to your email. Please verify to continue.",
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


class TwoFactorVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = TwoFactorVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        code = serializer.validated_data["otp"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user or not getattr(user, "two_factor_enabled", False):
            return Response({"detail": "Invalid OTP request."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            verify_otp(code, user=user, purpose='LOGIN_2FA')
        except OTPError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "message": "2FA verification successful.",
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": MeSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class TwoFactorResendView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = TwoFactorResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user or not getattr(user, "two_factor_enabled", False):
            return Response({"detail": "Invalid OTP request."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resend_otp(user=user, purpose='LOGIN_2FA')
        except OTPCooldownError as exc:
            return Response(
                {"detail": str(exc), "retry_after": exc.retry_after_seconds},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except OTPError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "OTP sent to your email.",
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )


class TwoFactorToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = TwoFactorToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        request.user.two_factor_enabled = serializer.validated_data["enabled"]
        request.user.save(update_fields=["two_factor_enabled"])
        return Response(
            {
                "message": "2FA setting updated.",
                "two_factor_enabled": request.user.two_factor_enabled,
            },
            status=status.HTTP_200_OK,
        )


class ForgotPasswordRequestView(APIView):
    """Request password reset OTP."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()

        # Always return generic message to not reveal user existence
        generic_response = Response(
            {
                "message": "If an account exists with this email, a verification code has been sent."
            },
            status=status.HTTP_200_OK,
        )

        if not user:
            return generic_response

        try:
            create_and_send_otp(user=user, purpose='PASSWORD_RESET')
        except Exception as e:
            import logging
            logging.error(f"Failed to send password reset OTP for {email}: {str(e)}")
            return generic_response

        return generic_response


class PasswordResetVerifyView(APIView):
    """Verify OTP during password reset flow."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        code = serializer.validated_data["otp"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response(
                {"detail": "Invalid OTP or email."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            verify_otp(code, user=user, purpose='PASSWORD_RESET')
        except OTPError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # Generate a short-lived reset token
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        reset_token = str(refresh.access_token)

        return Response(
            {
                "message": "OTP verified. You can now reset your password.",
                "reset_token": reset_token,
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetResendView(APIView):
    """Resend password reset OTP."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()

        if not user:
            return Response(
                {"message": "If an account exists, a verification code has been sent."},
                status=status.HTTP_200_OK,
            )

        try:
            resend_otp(user=user, purpose='PASSWORD_RESET')
        except OTPCooldownError as exc:
            return Response(
                {"detail": str(exc), "retry_after": exc.retry_after_seconds},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except OTPError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "Password reset code sent to your email.",
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetView(APIView):
    """Reset password after OTP verification."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        reset_token = serializer.validated_data["reset_token"]
        new_password = serializer.validated_data["new_password"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response(
                {"detail": "Invalid reset request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate reset token (it's a JWT access token)
        try:
            from rest_framework_simplejwt.tokens import TokenError
            from rest_framework_simplejwt.authentication import JWTAuthentication
            from rest_framework_simplejwt.models import TokenUser

            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(reset_token)
            token_user_id = validated_token.get('user_id')

            if str(token_user_id) != str(user.id):
                return Response(
                    {"detail": "Invalid reset token."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except (TokenError, Exception):
            return Response(
                {"detail": "Invalid or expired reset token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update password
        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response(
            {
                "message": "Password reset successful. You can now log in with your new password.",
            },
            status=status.HTTP_200_OK,
        )


class EmailVerificationView(APIView):
    """Verify email OTP during signup."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        code = serializer.validated_data["otp"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            verify_otp(code, user=user, purpose='EMAIL_VERIFICATION')
        except OTPError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # Mark email as verified
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])

        # Return tokens so user can proceed
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "message": "Email verified successfully.",
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": MeSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class EmailVerificationResendView(APIView):
    """Resend email verification OTP."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmailVerificationResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()

        if not user:
            return Response(
                {"message": "If an account exists, a verification code has been sent."},
                status=status.HTTP_200_OK,
            )

        try:
            resend_otp(user=user, purpose='EMAIL_VERIFICATION')
        except OTPCooldownError as exc:
            return Response(
                {"detail": str(exc), "retry_after": exc.retry_after_seconds},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except OTPError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "Verification code sent to your email.",
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )


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


class GoogleAuthView(APIView):
    """
    Google OAuth login endpoint.
    Expects token from Google OAuth flow on frontend.
    Creates or links user account.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth import get_user_model
        
        google_token = request.data.get("token")
        account_type = (request.data.get("account_type") or "PRIVATE").upper()
        
        if not google_token:
            return Response(
                {"detail": "Google token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if account_type not in ["PRIVATE", "BUSINESS"]:
            account_type = "PRIVATE"

        google_client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
        if not google_client_id or google_client_id == "your_google_client_id":
            return Response(
                {"detail": "Google Client ID is not configured on the backend."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        try:
            from google.auth.transport import requests
            from google.oauth2 import id_token
            
            idinfo = id_token.verify_oauth2_token(
                google_token,
                requests.Request(),
                google_client_id,
            )
            
            google_id = idinfo.get("sub")
            email = idinfo.get("email")
            full_name = idinfo.get("name", email.split("@")[0])
            email_verified = idinfo.get("email_verified", False)
            
            if not google_id or not email or not email_verified:
                return Response(
                    {"detail": "Invalid Google token."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            User = get_user_model()
            
            # Try to find existing user by google_id
            user = User.objects.filter(google_id=google_id).first()
            
            if not user:
                # Try to find by email
                user = User.objects.filter(email__iexact=email).first()
                if user:
                    # Link existing user to Google
                    user.google_id = google_id
                    user.google_linked = True
                    user.save(update_fields=["google_id", "google_linked"])
                else:
                    user = User.objects.create_user(
                        email=email,
                        full_name=full_name,
                        account_type=account_type,
                        password=None,  # No password for Google auth
                    )
                    user.google_id = google_id
                    user.google_linked = True
                    user.save(update_fields=["google_id", "google_linked"])
            
            # Generate tokens
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "message": "Google login successful.",
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "user": MeSerializer(user).data,
                },
                status=status.HTTP_200_OK,
            )
        
        except Exception as e:
            return Response(
                {"detail": f"Google authentication failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class PhoneUpdateView(APIView):
    """Update phone number for authenticated user."""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        phone_number = request.data.get("phone_number", "").strip()
        
        if not phone_number:
            return Response(
                {"detail": "Phone number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if len(phone_number) > 20:
            return Response(
                {"detail": "Phone number too long."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        request.user.phone_number = phone_number
        request.user.save(update_fields=["phone_number"])
        
        return Response(
            {
                "message": "Phone number updated.",
                "user": MeSerializer(request.user).data,
            },
            status=status.HTTP_200_OK,
        )
