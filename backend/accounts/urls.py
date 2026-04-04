from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import MeView, RegisterView, SimpleTokenObtainPairView
from .payment_views import create_checkout_session, stripe_webhook, get_profile_status

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", SimpleTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    
    # Payment endpoints
    path("create-checkout-session/", create_checkout_session, name="create_checkout_session"),
    path("stripe/webhook/", stripe_webhook, name="stripe_webhook"),
    path("profile-status/", get_profile_status, name="profile_status"),
]
