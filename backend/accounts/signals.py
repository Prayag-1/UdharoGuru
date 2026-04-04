from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import User, ensure_business_profile


@receiver(post_save, sender=User)
def create_business_profile(sender, instance, created, **kwargs):
    if instance.account_type != "BUSINESS":
        return

    ensure_business_profile(instance)
