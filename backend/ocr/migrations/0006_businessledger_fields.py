from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ocr", "0005_rename_businesstra_owner_tr_idx_ocr_busines_owner_i_fabfaf_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="businesstransaction",
            name="customer_name",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="businesstransaction",
            name="is_settled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="businesstransaction",
            name="source",
            field=models.CharField(
                choices=[("MANUAL", "Manual"), ("OCR", "OCR")], default="MANUAL", max_length=10
            ),
        ),
    ]
