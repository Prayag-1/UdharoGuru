from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ocr", "0003_businesstransaction"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="ocrdocument",
            constraint=models.CheckConstraint(check=models.Q(status__in=["DRAFT", "CONFIRMED"]), name="ocr_document_status_valid"),
        ),
        migrations.AddConstraint(
            model_name="businesstransaction",
            constraint=models.CheckConstraint(
                check=models.Q(transaction_type__in=["LENT", "BORROWED"]),
                name="business_transaction_type_valid",
            ),
        ),
    ]
