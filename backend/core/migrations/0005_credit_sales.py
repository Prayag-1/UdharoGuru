from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_business_profile"),
        ("core", "0004_product"),
    ]

    operations = [
        migrations.CreateModel(
            name="CreditSale",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("invoice_number", models.CharField(db_index=True, max_length=100, unique=True)),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("amount_paid", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("amount_due", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("due_date", models.DateField(blank=True, null=True)),
                ("status", models.CharField(
                    choices=[("PENDING", "Pending"), ("PARTIAL", "Partial"), ("PAID", "Paid")],
                    default="PENDING",
                    max_length=10
                )),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="credit_sales", to="accounts.businessprofile")),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="credit_sales", to="core.customer")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="CreditSaleItem",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity", models.PositiveIntegerField()),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=12)),
                ("subtotal", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("credit_sale", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="core.creditsale")),
                ("product", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="credit_sale_items", to="core.product")),
            ],
        ),
        migrations.AddIndex(
            model_name="creditsale",
            index=models.Index(fields=["business", "-created_at"], name="core_credit_business_1a2b3c_idx"),
        ),
        migrations.AddIndex(
            model_name="creditsale",
            index=models.Index(fields=["customer", "-created_at"], name="core_credit_customer_2d3e4f_idx"),
        ),
        migrations.AddIndex(
            model_name="creditsale",
            index=models.Index(fields=["status"], name="core_credit_status_3e4f5g_idx"),
        ),
        migrations.AlterUniqueTogether(
            name="creditsaleitem",
            unique_together={("credit_sale", "product")},
        ),
    ]
