import re

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import BusinessKYC, BusinessPayment, BusinessProfile, User


class BusinessProfileLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.business_user = User.objects.create_user(
            email="biz@example.com",
            full_name="Biz Owner",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.other_business_user = User.objects.create_user(
            email="otherbiz@example.com",
            full_name="Other Owner",
            account_type="BUSINESS",
            password="pass12345",
        )

    def test_business_user_creation_auto_creates_profile(self):
        profile = BusinessProfile.objects.get(user=self.business_user)
        self.assertEqual(profile.user, self.business_user)
        self.assertEqual(profile.owner_name, "Biz Owner")
        self.assertEqual(profile.email, "biz@example.com")

    def test_register_business_account_auto_creates_profile(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "newbiz@example.com",
                "full_name": "New Biz",
                "account_type": "BUSINESS",
                "password": "pass12345",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="newbiz@example.com")
        self.assertTrue(BusinessProfile.objects.filter(user=user).exists())

    def test_business_profile_endpoint_returns_only_logged_in_users_profile(self):
        my_profile = BusinessProfile.objects.get(user=self.business_user)
        other_profile = BusinessProfile.objects.get(user=self.other_business_user)
        self.client.force_authenticate(self.business_user)

        response = self.client.get("/api/business/profile/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], my_profile.id)
        self.assertNotEqual(payload["id"], other_profile.id)
        self.assertEqual(payload["user"], self.business_user.id)

    def test_business_status_endpoint_reflects_payment_and_kyc_approval(self):
        self.client.force_authenticate(self.business_user)

        initial = self.client.get("/api/business/status/")
        self.assertEqual(initial.status_code, 200)
        self.assertEqual(initial.json()["business_status"], "PAYMENT_PENDING")
        self.assertEqual(initial.json()["payment_status"], "pending")

        BusinessPayment.objects.create(
            user=self.business_user,
            transaction_code="TXN123",
            screenshot="payments/test.png",
            is_verified=False,
        )
        after_payment = self.client.get("/api/business/status/")
        self.assertEqual(after_payment.status_code, 200)
        self.assertEqual(after_payment.json()["business_status"], "KYC_PENDING")
        self.assertEqual(after_payment.json()["payment_status"], "approved")

        BusinessKYC.objects.create(
            user=self.business_user,
            first_name="Biz",
            last_name="Owner",
            gender="MALE",
            dob="2000-01-01",
            country="Nepal",
            city="Kathmandu",
            phone="9800000000",
            address="Kathmandu",
            business_name="Biz Owner",
            registration_pan="PAN123",
            industry="Retail",
            identity_type="NATIONAL_ID",
            identity_number="ID123",
            identity_document="kyc_docs/test.png",
            is_approved=True,
        )
        approved = self.client.get("/api/business/status/")
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json()["business_status"], "APPROVED")
        self.assertEqual(approved.json()["kyc_status"], "APPROVED")

    def test_business_profile_endpoint_returns_payment_and_kyc_status(self):
        BusinessPayment.objects.create(
            user=self.business_user,
            transaction_code="TXN456",
            screenshot="payments/test.png",
        )
        self.client.force_authenticate(self.business_user)

        response = self.client.get("/api/business/profile/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["payment_status"], "approved")
        self.assertEqual(payload["kyc_status"], self.business_user.kyc_status)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    OTP_RESEND_COOLDOWN_SECONDS=60,
)
class TwoFactorAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="private@example.com",
            full_name="Private User",
            account_type="PRIVATE",
            password="pass12345",
        )

    def test_login_without_2fa_returns_tokens(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": "private@example.com", "password": "pass12345"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("access", payload)
        self.assertIn("refresh", payload)
        self.assertNotIn("two_factor_required", payload)

    def test_login_with_2fa_sends_otp_without_tokens_then_verify_returns_tokens(self):
        self.user.two_factor_enabled = True
        self.user.save(update_fields=["two_factor_enabled"])

        login_response = self.client.post(
            "/api/auth/login/",
            {"email": "private@example.com", "password": "pass12345"},
            format="json",
        )

        self.assertEqual(login_response.status_code, 200)
        login_payload = login_response.json()
        self.assertTrue(login_payload["two_factor_required"])
        self.assertEqual(login_payload["email"], "private@example.com")
        self.assertNotIn("access", login_payload)
        self.assertEqual(len(mail.outbox), 1)

        code = re.search(r"\b\d{6}\b", mail.outbox[0].body).group(0)
        verify_response = self.client.post(
            "/api/auth/2fa/verify/",
            {"email": "private@example.com", "otp": code},
            format="json",
        )

        self.assertEqual(verify_response.status_code, 200)
        verify_payload = verify_response.json()
        self.assertIn("access", verify_payload)
        self.assertIn("refresh", verify_payload)
        self.assertTrue(verify_payload["user"]["two_factor_enabled"])

    def test_resend_respects_cooldown(self):
        self.user.two_factor_enabled = True
        self.user.save(update_fields=["two_factor_enabled"])

        self.client.post(
            "/api/auth/login/",
            {"email": "private@example.com", "password": "pass12345"},
            format="json",
        )
        response = self.client.post(
            "/api/auth/2fa/resend/",
            {"email": "private@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 429)
        self.assertIn("retry_after", response.json())

    def test_authenticated_user_can_toggle_2fa(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            "/api/auth/2fa/toggle/",
            {"enabled": True},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.two_factor_enabled)

    def test_forgot_password_otp_verification_and_reset_updates_password(self):
        request_response = self.client.post(
            "/api/auth/password/forgot/",
            {"email": "private@example.com"},
            format="json",
        )
        self.assertEqual(request_response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        code = re.search(r"\b\d{6}\b", mail.outbox[0].body).group(0)
        verify_response = self.client.post(
            "/api/auth/password/verify-otp/",
            {"email": "private@example.com", "otp": code},
            format="json",
        )
        self.assertEqual(verify_response.status_code, 200)
        reset_token = verify_response.json()["reset_token"]

        reset_response = self.client.post(
            "/api/auth/password/reset/",
            {
                "email": "private@example.com",
                "reset_token": reset_token,
                "new_password": "newpass12345",
            },
            format="json",
        )
        self.assertEqual(reset_response.status_code, 200)

        login_response = self.client.post(
            "/api/auth/login/",
            {"email": "private@example.com", "password": "newpass12345"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertIn("access", login_response.json())

    def test_password_reset_resend_respects_cooldown(self):
        self.client.post(
            "/api/auth/password/forgot/",
            {"email": "private@example.com"},
            format="json",
        )

        resend_response = self.client.post(
            "/api/auth/password/resend/",
            {"email": "private@example.com"},
            format="json",
        )

        self.assertEqual(resend_response.status_code, 429)
        self.assertIn("retry_after", resend_response.json())
