import io
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from ocr.models import BusinessTransaction, OCRDocument
from private.models import Group, GroupMember


def create_png_bytes():
    # Tiny 1x1 black png
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02"
        b"\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\xd7c```\x00\x00\x00\x04\x00\x01"
        b"\x0bm\x0b\xef\x00\x00\x00\x00IEND\xaeB`\x82"
    )


class BusinessOCRTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.approved_user = User.objects.create_user(
            email="biz@example.com",
            full_name="Biz",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.approved_user.kyc_status = "APPROVED"
        self.approved_user.business_status = "APPROVED"
        self.approved_user.save(update_fields=["kyc_status", "business_status"])

        self.unapproved_user = User.objects.create_user(
            email="pending@example.com",
            full_name="Pending Biz",
            account_type="BUSINESS",
            password="pass12345",
        )
        self.unapproved_user.kyc_status = "PENDING"
        self.unapproved_user.business_status = "KYC_PENDING"
        self.unapproved_user.save(update_fields=["kyc_status", "business_status"])

    def test_business_gate_blocks_unapproved(self):
        self.client.force_authenticate(self.unapproved_user)
        res = self.client.get("/api/business/ocr/")
        self.assertEqual(res.status_code, 403)

    def test_confirm_creates_transaction_and_updates_document(self):
        self.client.force_authenticate(self.approved_user)
        img = SimpleUploadedFile("tiny.png", create_png_bytes(), content_type="image/png")
        doc = OCRDocument.objects.create(owner=self.approved_user, image=img, raw_text="Test", status=OCRDocument.DRAFT)

        payload = {
            "merchant": "Test Store",
            "amount": "12.50",
            "date": date.today().isoformat(),
            "transaction_type": "LENT",
            "note": "OCR confirm test",
        }
        res = self.client.post(f"/api/business/ocr/{doc.id}/confirm/", data=payload, format="json")
        self.assertEqual(res.status_code, 201)

        doc.refresh_from_db()
        self.assertEqual(doc.status, OCRDocument.CONFIRMED)

        tx = BusinessTransaction.objects.get(ocr_document=doc)
        self.assertEqual(str(tx.amount), "12.50")
        self.assertEqual(tx.merchant, "Test Store")


class GroupPersistenceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            account_type="PRIVATE",
            password="pass12345",
        )
        self.member = User.objects.create_user(
            email="member@example.com",
            full_name="Member",
            account_type="PRIVATE",
            password="pass12345",
        )

    def test_group_and_membership_persist(self):
        group = Group.objects.create(owner=self.owner, name="Test Group")
        GroupMember.objects.create(group=group, user=self.owner, role=GroupMember.ADMIN)
        GroupMember.objects.create(group=group, user=self.member, role=GroupMember.MEMBER)

        self.assertEqual(Group.objects.count(), 1)
        self.assertEqual(group.memberships.count(), 2)
        self.assertTrue(group.memberships.filter(user=self.owner, role=GroupMember.ADMIN).exists())
        self.assertTrue(group.memberships.filter(user=self.member, role=GroupMember.MEMBER).exists())
