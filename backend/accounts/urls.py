from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    MeView,
    RegisterView,
    SimpleTokenObtainPairView,
    GoogleAuthView,
    PhoneUpdateView,
    TwoFactorResendView,
    TwoFactorToggleView,
    TwoFactorVerifyView,
    ForgotPasswordRequestView,
    PasswordResetResendView,
    PasswordResetVerifyView,
    PasswordResetView,
    EmailVerificationView,
    EmailVerificationResendView,
)
from .payment_views import create_checkout_session, stripe_webhook, get_profile_status

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", SimpleTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("google/login/", GoogleAuthView.as_view(), name="google_login"),
    path("phone/update/", PhoneUpdateView.as_view(), name="phone_update"),
    
    # 2FA endpoints
    path("2fa/verify/", TwoFactorVerifyView.as_view(), name="two_factor_verify"),
    path("2fa/resend/", TwoFactorResendView.as_view(), name="two_factor_resend"),
    path("2fa/toggle/", TwoFactorToggleView.as_view(), name="two_factor_toggle"),
    
    # Email verification endpoints
    path("email/verify/", EmailVerificationView.as_view(), name="email_verify"),
    path("email/resend/", EmailVerificationResendView.as_view(), name="email_resend"),
    
    # Password reset endpoints
    path("password/forgot/", ForgotPasswordRequestView.as_view(), name="password_forgot"),
    path("password/verify-otp/", PasswordResetVerifyView.as_view(), name="password_verify_otp"),
    path("password/resend/", PasswordResetResendView.as_view(), name="password_resend"),
    path("password/reset/", PasswordResetView.as_view(), name="password_reset"),
    
    # Payment endpoints
    path("create-checkout-session/", create_checkout_session, name="create_checkout_session"),
    path("stripe/webhook/", stripe_webhook, name="stripe_webhook"),
    path("profile-status/", get_profile_status, name="profile_status"),
]
