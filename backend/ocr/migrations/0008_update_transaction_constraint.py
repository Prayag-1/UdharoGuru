from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ocr", "0007_adjust_transaction_fields"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="businesstransaction",
            name="business_transaction_type_valid",
        ),
        migrations.AddConstraint(
            model_name="businesstransaction",
            constraint=models.CheckConstraint(
                check=models.Q(transaction_type__in=["CREDIT", "DEBIT"]),
                name="business_transaction_type_valid",
            ),
        ),
    ]
