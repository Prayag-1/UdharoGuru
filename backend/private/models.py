from django.conf import settings
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q


class PrivateConnection(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="private_connections",
    )
    connected_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="connected_to",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["owner", "connected_user"], name="unique_private_connection"),
            models.CheckConstraint(check=~Q(owner=models.F("connected_user")), name="prevent_self_private_connection"),
        ]

    def __str__(self):
        return f"{self.owner.email} -> {self.connected_user.email}"


class Group(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_groups")
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class GroupMember(models.Model):
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    ROLE_CHOICES = (
        (ADMIN, "Admin"),
        (MEMBER, "Member"),
    )

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="group_memberships")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["group", "user"], name="unique_group_member"),
        ]

    def __str__(self):
        return f"{self.user.email} in {self.group.name}"


class PrivateMoneyTransaction(models.Model):
    LENT = "LENT"
    BORROWED = "BORROWED"
    TRANSACTION_TYPES = (
        (LENT, "Lent"),
        (BORROWED, "Borrowed"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="private_money_transactions",
    )
    person_name = models.CharField(max_length=255, db_index=True)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    transaction_type = models.CharField(max_length=8, choices=TRANSACTION_TYPES)
    transaction_date = models.DateField()
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner", "person_name"]),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(amount__gt=0), name="private_money_amount_gt_zero"),
        ]

    def __str__(self):
        return f"{self.owner.email} - {self.transaction_type} {self.amount} to/from {self.person_name}"


class PrivateItemLoan(models.Model):
    ACTIVE = "ACTIVE"
    RETURNED = "RETURNED"
    STATUS_CHOICES = (
        (ACTIVE, "Active"),
        (RETURNED, "Returned"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="private_item_loans",
    )
    borrower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="borrowed_items",
    )
    item_name = models.CharField(max_length=255)
    item_description = models.TextField(blank=True, null=True)
    lent_date = models.DateField()
    expected_return_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=8, choices=STATUS_CHOICES, default=ACTIVE)
    reminder_enabled = models.BooleanField(default=True)
    reminder_interval_days = models.PositiveIntegerField(default=3)
    last_reminder_sent_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner", "status"]),
            models.Index(fields=["borrower", "status"]),
        ]
        constraints = [
            models.CheckConstraint(check=~models.Q(owner=models.F("borrower")), name="prevent_self_item_loan"),
        ]

    def __str__(self):
        return f"{self.item_name} lent by {self.owner.email} to {self.borrower.email}"


class ChatThread(models.Model):
    DIRECT = "DIRECT"
    GROUP = "GROUP"
    TYPE_CHOICES = (
        (DIRECT, "Direct"),
        (GROUP, "Group"),
    )

    thread_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    group = models.OneToOneField("private.Group", on_delete=models.CASCADE, related_name="chat_thread", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        target = f"group={self.group_id}" if self.group_id else self.thread_type
        return f"Thread {self.id} ({target})"


class ChatParticipant(models.Model):
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_participations")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["thread", "user"], name="unique_chat_participant"),
        ]

    def __str__(self):
        return f"{self.user.email} in thread {self.thread_id}"


class ChatMessage(models.Model):
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages")
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender.email}: {self.message[:20]}"
