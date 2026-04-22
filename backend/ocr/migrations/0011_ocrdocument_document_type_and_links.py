from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_alter_paymentrequest_checkout_url"),
        ("ocr", "0010_invoice"),
    ]

    operations = [
        migrations.AddField(
            model_name="ocrdocument",
            name="document_type",
            field=models.CharField(
                choices=[("RECEIPT", "Receipt"), ("CUSTOMER_ID", "Customer ID")],
                default="RECEIPT",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="ocrdocument",
            name="extracted_phone",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="ocrdocument",
            name="linked_credit_sale",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="ocr_documents",
                to="core.creditsale",
            ),
        ),
        migrations.AddField(
            model_name="ocrdocument",
            name="linked_customer",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="ocr_documents",
                to="core.customer",
            ),
        ),
    ]
