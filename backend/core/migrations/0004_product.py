from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_business_profile"),
        ("core", "0003_customer_business_profile"),
    ]

    operations = [
        migrations.CreateModel(
            name="Product",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("sku", models.CharField(blank=True, max_length=100)),
                ("category", models.CharField(blank=True, max_length=100)),
                ("cost_price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("selling_price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("stock_quantity", models.IntegerField(default=0)),
                ("low_stock_threshold", models.IntegerField(default=0)),
                ("unit", models.CharField(blank=True, max_length=50)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="products", to="accounts.businessprofile")),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["business", "name"], name="core_produ_business_2cb0b0_idx"),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["business", "sku"], name="core_produ_business_4f16b1_idx"),
        ),
    ]
