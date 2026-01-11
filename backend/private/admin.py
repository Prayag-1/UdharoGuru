from django.contrib import admin

from .models import PrivateConnection


@admin.register(PrivateConnection)
class PrivateConnectionAdmin(admin.ModelAdmin):
    list_display = ("owner", "connected_user", "created_at")
    search_fields = ("owner__email", "connected_user__email")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)

