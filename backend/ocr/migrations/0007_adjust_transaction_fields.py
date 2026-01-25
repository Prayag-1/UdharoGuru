from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ocr", "0006_businessledger_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="businesstransaction",
            name="customer_name",
            field=models.CharField(default="", max_length=255),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="businesstransaction",
            name="transaction_type",
            field=models.CharField(
                choices=[("CREDIT", "Credit"), ("DEBIT", "Debit")], max_length=10
            ),
        ),
        migrations.AlterField(
            model_name="businesstransaction",
            name="source",
            field=models.CharField(
                choices=[("MANUAL", "Manual"), ("OCR", "OCR")], default="MANUAL", max_length=10
            ),
        ),
    ]
