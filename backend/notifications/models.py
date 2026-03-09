from django.conf import settings
from django.db import models


class Notification(models.Model):
    SETTLEMENT = "SETTLEMENT"
    ACTIVITY = "ACTIVITY"

    NOTIFICATION_TYPES = (
        (SETTLEMENT, "Settlement"),
        (ACTIVITY, "Activity"),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_notifications",
    )
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES)
    message = models.TextField()
    related_transaction = models.ForeignKey(
        "core.Transaction",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    related_private_transaction = models.ForeignKey(
        "private.PrivateMoneyTransaction",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.notification_type} -> {self.recipient.email}"
