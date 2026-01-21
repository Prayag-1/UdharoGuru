from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("ocr", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="OCRDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="ocr/documents/")),
                ("raw_text", models.TextField(blank=True)),
                ("extracted_amount", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("extracted_date", models.DateField(blank=True, null=True)),
                ("extracted_merchant", models.CharField(blank=True, max_length=255, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("DRAFT", "Draft"), ("CONFIRMED", "Confirmed")], default="DRAFT", max_length=10
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ocr_documents",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="ocrdocument",
            index=models.Index(fields=["owner", "status"], name="ocr_doc_own_status_idx"),
        ),
        migrations.AddIndex(
            model_name="ocrdocument",
            index=models.Index(fields=["owner", "created_at"], name="ocr_doc_own_created_idx"),
        ),
    ]
