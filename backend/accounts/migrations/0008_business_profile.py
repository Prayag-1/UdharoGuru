from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_alter_user_invite_code"),
    ]

    operations = [
        migrations.CreateModel(
            name="BusinessProfile",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("business_name", models.CharField(max_length=255)),
                ("owner_name", models.CharField(max_length=255)),
                ("phone", models.CharField(max_length=50)),
                ("email", models.EmailField(max_length=254)),
                ("address", models.TextField()),
                ("business_type", models.CharField(max_length=100)),
                ("logo", models.ImageField(blank=True, null=True, upload_to="business_logos/")),
                ("pan_vat_number", models.CharField(max_length=100)),
                ("kyc_status", models.CharField(choices=[("PENDING", "Pending"), ("APPROVED", "Approved"), ("REJECTED", "Rejected")], default="PENDING", max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="business_profile", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
