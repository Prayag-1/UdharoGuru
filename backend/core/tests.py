from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import BusinessProfile, User
from core.models import Customer, CreditSale, Payment, Product


class BusinessDataIntegrityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="biz-core@example.com",
            full_name="Core Biz",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.other_user = User.objects.create_user(
            email="other-core@example.com",
            full_name="Other Core",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.profile = BusinessProfile.objects.get(user=self.user)
        self.other_profile = BusinessProfile.objects.get(user=self.other_user)

    def test_business_endpoints_recreate_missing_profile_without_404(self):
        self.profile.delete()
        self.client.force_authenticate(self.user)

        endpoints = [
            "/api/products/",
            "/api/customers/",
            "/api/credit-sales/",
            "/api/payments/",
            "/api/business/dashboard/",
        ]

        for endpoint in endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code, 200, endpoint)

        self.assertTrue(BusinessProfile.objects.filter(user=self.user).exists())

    def test_business_queries_are_scoped_to_logged_in_profile(self):
        customer = Customer.objects.create(business=self.profile, name="Alice")
        other_customer = Customer.objects.create(business=self.other_profile, name="Mallory")
        Product.objects.create(business=self.profile, name="Tea", selling_price=10)
        Product.objects.create(business=self.other_profile, name="Coffee", selling_price=20)

        self.client.force_authenticate(self.user)

        customer_response = self.client.get("/api/customers/")
        product_response = self.client.get("/api/products/")

        self.assertEqual(customer_response.status_code, 200)
        self.assertEqual(product_response.status_code, 200)

        customer_ids = {item["id"] for item in customer_response.json()}
        product_names = {item["name"] for item in product_response.json()}

        self.assertIn(customer.id, customer_ids)
        self.assertNotIn(other_customer.id, customer_ids)
        self.assertIn("Tea", product_names)
        self.assertNotIn("Coffee", product_names)

    def test_dashboard_uses_only_current_business_records(self):
        customer = Customer.objects.create(business=self.profile, name="Alice")
        sale = CreditSale.objects.create(
            business=self.profile,
            customer=customer,
            invoice_number="INV-100",
            total_amount=1500,
            amount_due=1500,
            status=CreditSale.PENDING,
        )
        Payment.objects.create(
            business=self.profile,
            customer=customer,
            credit_sale=sale,
            amount=500,
            payment_method=Payment.CASH,
            payment_date="2026-04-03",
        )

        other_customer = Customer.objects.create(business=self.other_profile, name="Bob")
        CreditSale.objects.create(
            business=self.other_profile,
            customer=other_customer,
            invoice_number="INV-200",
            total_amount=9999,
            amount_due=9999,
            status=CreditSale.PENDING,
        )

        self.client.force_authenticate(self.user)
        response = self.client.get("/api/business/dashboard/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["metrics"]["total_customers"], 1)
        self.assertEqual(payload["sales_by_status"]["pending"], 0)
        self.assertEqual(payload["sales_by_status"]["partial"], 1)
        self.assertEqual(payload["metrics"]["payments_collected"], 500.0)
