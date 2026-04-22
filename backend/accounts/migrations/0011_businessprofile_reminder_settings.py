from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_alter_businessprofile_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="businessprofile",
            name="reminder_days_before_due",
            field=models.PositiveIntegerField(default=3),
        ),
        migrations.AddField(
            model_name="businessprofile",
            name="reminder_enabled",
            field=models.BooleanField(default=True),
        ),
    ]
