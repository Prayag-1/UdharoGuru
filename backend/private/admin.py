from django.contrib import admin

from .models import Group, GroupMember, PrivateConnection, PrivateMoneyTransaction


@admin.register(PrivateConnection)
class PrivateConnectionAdmin(admin.ModelAdmin):
    list_display = ("owner", "connected_user", "created_at")
    search_fields = ("owner__email", "connected_user__email")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner", "created_at")
    search_fields = ("name", "owner__email")
    readonly_fields = ("created_at",)


@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
    list_display = ("group", "user", "role", "joined_at")
    list_filter = ("role",)
    search_fields = ("group__name", "user__email")
    readonly_fields = ("joined_at",)


@admin.register(PrivateMoneyTransaction)
class PrivateMoneyTransactionAdmin(admin.ModelAdmin):
    list_display = ("owner", "person_name", "amount", "transaction_type", "transaction_date", "created_at")
    list_filter = ("transaction_type",)
    search_fields = ("owner__email", "person_name", "note")
    readonly_fields = ("created_at",)
