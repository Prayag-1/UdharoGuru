from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_business_profile"),
        ("core", "0005_credit_sales"),
    ]

    operations = [
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("payment_method", models.CharField(
                    choices=[
                        ("CASH", "Cash"),
                        ("BANK_TRANSFER", "Bank Transfer"),
                        ("CHEQUE", "Cheque"),
                        ("MOBILE_MONEY", "Mobile Money"),
                        ("OTHER", "Other"),
                    ],
                    default="CASH",
                    max_length=20
                )),
                ("reference_number", models.CharField(blank=True, db_index=True, max_length=100)),
                ("notes", models.TextField(blank=True)),
                ("payment_date", models.DateField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payments", to="accounts.businessprofile")),
                ("credit_sale", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payments", to="core.creditsale")),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payments", to="core.customer")),
            ],
            options={
                "ordering": ["-payment_date", "-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(fields=["business", "-payment_date"], name="core_payment_business_5f6g7h_idx"),
        ),
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(fields=["customer", "-payment_date"], name="core_payment_customer_6g7h8i_idx"),
        ),
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(fields=["credit_sale"], name="core_payment_credit_7h8i9j_idx"),
        ),
    ]
