from rest_framework.permissions import BasePermission


class IsPrivateAccount(BasePermission):
    message = "Private account required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "account_type", None) == "PRIVATE")

    def has_object_permission(self, request, view, obj):
        user = request.user
        owner_id = getattr(obj, "owner_id", None)
        if owner_id is not None:
            return owner_id == getattr(user, "id", None) and self.has_permission(request, view)
        return self.has_permission(request, view)
