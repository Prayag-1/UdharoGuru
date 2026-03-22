from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()


class EmailBackend(ModelBackend):
    """Custom authentication backend that allows email-based login."""
    
    def authenticate(self, request, username=None, email=None, password=None, **kwargs):
        """
        Authenticate using email if provided, otherwise fall back to username.
        """
        # Try email first if provided
        if email:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                return None
        # Fall back to username
        elif username:
            try:
                user = User.objects.get(email=username)
            except User.DoesNotExist:
                return None
        else:
            return None
        
        # Check password
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        
        return None
    
    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
