from django.test import TestCase
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
