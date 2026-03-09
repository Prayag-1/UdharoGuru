from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    transaction_id = serializers.SerializerMethodField()
    transaction_source = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "message",
            "sender_name",
            "transaction_id",
            "transaction_source",
            "created_at",
            "is_read",
            "notification_type",
        ]

    def get_sender_name(self, obj):
        sender = obj.sender
        if not sender:
            return ""
        return sender.full_name or sender.email

    def get_transaction_id(self, obj):
        if obj.related_transaction_id:
            return obj.related_transaction_id
        if obj.related_private_transaction_id:
            return obj.related_private_transaction_id
        return None

    def get_transaction_source(self, obj):
        if obj.related_transaction_id:
            return "core"
        if obj.related_private_transaction_id:
            return "private"
        return None
