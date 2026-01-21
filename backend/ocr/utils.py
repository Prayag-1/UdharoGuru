
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import pytesseract
from PIL import Image, ImageFilter, ImageOps


def preprocess_image(image_path):
    """
    Basic preprocessing to improve OCR fidelity:
    - grayscale
    - noise reduction
    - light thresholding
    """
    img = Image.open(image_path)
    gray = ImageOps.grayscale(img)
    denoised = gray.filter(ImageFilter.MedianFilter(size=3))
    boosted = ImageOps.autocontrast(denoised)
    return boosted.point(lambda x: 0 if x < 140 else 255, mode="1")


def run_ocr(image_path):
    """
    Extract raw text from image using Tesseract after preprocessing.
    """
    processed = preprocess_image(image_path)
    return pytesseract.image_to_string(processed, config="--psm 6")


def extract_amount(text):
    """
    Heuristic: pick the largest monetary-looking number.
    """
    candidates = re.findall(r"[-+]?\d+[.,]?\d*", text or "")
    amounts = []
    for raw in candidates:
        normalized = raw.replace(",", "")
        try:
            val = Decimal(normalized)
            amounts.append(val)
        except InvalidOperation:
            continue
    if not amounts:
        return None
    return max(amounts).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def extract_date(text):
    """
    Try multiple common date patterns.
    """
    if not text:
        return None
    patterns = [
        r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})",  # YYYY-MM-DD
        r"(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})",  # DD/MM/YYYY or MM/DD/YYYY
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        raw_parts = match.groups()
        parts = [int(p) for p in raw_parts]
        try:
            if len(raw_parts[0]) == 4:
                year, month, day = parts
            else:
                first, second, year = parts
                # Heuristic: if first > 12, treat as day/month.
                if first > 12:
                    day, month = first, second
                else:
                    month, day = first, second
                if year < 100:
                    year += 2000
            return datetime(year, month, day).date()
        except Exception:
            continue
    return None


def extract_merchant(text):
    """
    Pick the first meaningful line that looks like a merchant name.
    """
    if not text:
        return None
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for line in lines:
        # Skip lines that look like amounts or dates.
        if re.search(r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", line):
            continue
        if re.search(r"\d+[.,]\d{2}", line):
            continue
        if len(re.sub(r"[^A-Za-z]", "", line)) < 3:
            continue
        return line[:255]
    return None
