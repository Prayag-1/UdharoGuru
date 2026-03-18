from django.db import migrations, models
import django.db.models.deletion


def forwards(apps, schema_editor):
    Customer = apps.get_model("core", "Customer")
    BusinessProfile = apps.get_model("accounts", "BusinessProfile")

    for customer in Customer.objects.select_related("owner").all():
        owner = getattr(customer, "owner", None)
        if not owner:
            continue
        profile = BusinessProfile.objects.filter(user=owner).first()
        if profile:
            customer.business_id = profile.id
            customer.save(update_fields=["business"])


def backwards(apps, schema_editor):
    # No reverse data migration.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_business_profile"),
        ("core", "0002_transaction_settled_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="business",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name="customers", to="accounts.businessprofile"),
        ),
        migrations.AddField(
            model_name="customer",
            name="opening_balance",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="customer",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(
            model_name="customer",
            name="owner",
        ),
        migrations.RemoveField(
            model_name="customer",
            name="email",
        ),
        migrations.AlterField(
            model_name="customer",
            name="business",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="customers", to="accounts.businessprofile"),
        ),
    ]
