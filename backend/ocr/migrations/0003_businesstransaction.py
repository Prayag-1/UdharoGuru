import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ocr", "0002_ocrdocument"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BusinessTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("merchant", models.CharField(max_length=255)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                (
                    "transaction_type",
                    models.CharField(choices=[("LENT", "Lent"), ("BORROWED", "Borrowed")], max_length=8),
                ),
                ("transaction_date", models.DateField()),
                ("note", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "ocr_document",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="business_transaction",
                        to="ocr.ocrdocument",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="business_transactions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="businesstransaction",
            index=models.Index(fields=["owner", "transaction_date"], name="businesstra_owner_tr_idx"),
        ),
        migrations.AddConstraint(
            model_name="businesstransaction",
            constraint=models.CheckConstraint(check=models.Q(("amount__gt", 0)), name="business_money_amount_gt_zero"),
        ),
    ]
