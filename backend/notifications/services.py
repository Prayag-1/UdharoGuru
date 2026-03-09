from .models import Notification


def create_notification(
    *,
    recipient,
    sender,
    message,
    notification_type=Notification.ACTIVITY,
    related_transaction=None,
    related_private_transaction=None,
):
    notification = Notification.objects.create(
        recipient=recipient,
        sender=sender,
        notification_type=notification_type,
        message=message,
        related_transaction=related_transaction,
        related_private_transaction=related_private_transaction,
    )
    # Hook for future push/email delivery can live here.
    return notification


def create_settlement_notification(*, recipient, sender, transaction, message):
    return create_notification(
        recipient=recipient,
        sender=sender,
        related_transaction=transaction,
        message=message,
        notification_type=Notification.SETTLEMENT,
    )
