from rest_framework.permissions import BasePermission


class IsBusinessAccount(BasePermission):
    message = "Business account required."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "account_type", "").upper() != "BUSINESS":
            self.message = "Business account required."
            return False
        kyc_ok = getattr(user, "kyc_status", "").upper() == "APPROVED"
        business_ok = getattr(user, "business_status", "").upper() == "APPROVED"
        if not (kyc_ok or business_ok):
            self.message = "Business KYC approval required."
            return False
        return True
