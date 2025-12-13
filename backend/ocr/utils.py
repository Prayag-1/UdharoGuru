import pytesseract
import re
from PIL import Image


def run_ocr(image_path):
    """
    Extract raw text from image using Tesseract
    """
    text = pytesseract.image_to_string(Image.open(image_path))
    return text


def extract_amount(text):
    """
    Heuristic: extract the largest number that looks like a monetary value
    """
    matches = re.findall(r"\d+[.,]?\d*", text)
    amounts = []

    for m in matches:
        try:
            amounts.append(float(m.replace(",", "")))
        except ValueError:
            pass

    return max(amounts) if amounts else None
