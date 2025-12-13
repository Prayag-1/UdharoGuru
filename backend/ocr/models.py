from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class OCRScan(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to="ocr/")
    extracted_text = models.TextField(blank=True)
    detected_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"OCRScan {self.id} by {self.user}"
