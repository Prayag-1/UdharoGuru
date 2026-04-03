from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import LoginOTP, User


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class OTPLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="otp@example.com",
            full_name="OTP User",
            account_type="PRIVATE",
            password="pass12345",
        )

    def test_login_generates_otp_and_sends_email(self):
        res = self.client.post(
            "/api/auth/login/",
            {"email": "otp@example.com", "password": "pass12345"},
            format="json",
        )

        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertTrue(payload["otp_required"])
        self.assertEqual(payload["user_id"], self.user.id)
        otp_record = LoginOTP.objects.get(user=self.user)
        self.assertEqual(len(otp_record.otp), 6)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(otp_record.otp, mail.outbox[0].body)

    def test_verify_otp_returns_jwt_tokens(self):
        otp_record = LoginOTP.objects.create(user=self.user, otp="123456")

        res = self.client.post(
            "/api/auth/verify-otp/",
            {"user_id": self.user.id, "otp": "123456"},
            format="json",
        )

        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn("access", payload)
        self.assertIn("refresh", payload)
        self.assertFalse(LoginOTP.objects.filter(id=otp_record.id).exists())

    def test_verify_otp_rejects_expired_code(self):
        otp_record = LoginOTP.objects.create(user=self.user, otp="123456")
        otp_record.created_at = timezone.now() - timezone.timedelta(minutes=10)
        otp_record.save(update_fields=["created_at"])

        res = self.client.post(
            "/api/auth/verify-otp/",
            {"user_id": self.user.id, "otp": "123456"},
            format="json",
        )

        self.assertEqual(res.status_code, 400)
        self.assertIn("OTP expired", res.json()["detail"][0])

    def test_verify_otp_rejects_wrong_code(self):
        LoginOTP.objects.create(user=self.user, otp="123456")

        res = self.client.post(
            "/api/auth/verify-otp/",
            {"user_id": self.user.id, "otp": "654321"},
            format="json",
        )

        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid OTP", res.json()["detail"][0])
