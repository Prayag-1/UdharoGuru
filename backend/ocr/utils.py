
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


def parse_ocr_text_to_credit_sale(text):
    """
    LAYER 2 — Data Parsing
    
    Convert raw OCR text into structured credit sale data.
    
    Returns:
    {
        "customer_name": "...",
        "items": [
            {"name": "...", "quantity": 1, "unit_price": 0, "subtotal": 0}
        ],
        "total_amount": 0,
        "confidence": "high|medium|low"
    }
    """
    if not text or not text.strip():
        return {
            "customer_name": "",
            "items": [],
            "total_amount": 0,
            "confidence": "low",
            "warning": "Empty or invalid text"
        }
    
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    
    # Initialize result
    result = {
        "customer_name": "",
        "items": [],
        "total_amount": 0,
        "confidence": "medium"
    }
    
    # Extract customer name (usually first meaningful line)
    customer_name = extract_merchant(text)
    if customer_name:
        result["customer_name"] = customer_name
    
    # Extract total amount
    total_amount = extract_total_amount(text)
    if total_amount:
        result["total_amount"] = float(total_amount)
    
    # Parse items from lines
    items = parse_items_from_lines(lines)
    result["items"] = items
    
    # Validate parsing
    if not result["customer_name"]:
        result["confidence"] = "low"
        result["warning"] = "Customer name not detected"
    elif not items:
        result["confidence"] = "low"
        result["warning"] = "No items detected in text"
    elif not total_amount:
        result["confidence"] = "medium"
        result["warning"] = "Total amount not clearly detected"
    
    return result


def extract_total_amount(text):
    """
    Extract total amount by looking for 'total' keyword.
    Fallback: use largest monetary value.
    """
    if not text:
        return None
    
    # Look for "total" keyword
    text_lower = text.lower()
    total_keywords = ["total", "sum", "amount due", "final"]
    
    for keyword in total_keywords:
        # Find total keyword and extract number after it
        pattern = rf"{keyword}\s*[:\-]?\s*([\d,.\s]+)"
        matches = re.finditer(pattern, text_lower)
        for match in matches:
            amount_str = match.group(1).replace(",", "").replace(" ", "").strip()
            try:
                amount = Decimal(amount_str)
                if amount > 0:
                    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            except InvalidOperation:
                continue
    
    # Fallback: largest amount in text
    return extract_amount(text)


def parse_items_from_lines(lines):
    """
    Parse item list from lines.
    
    Heuristics:
    1. Look for lines with quantities and prices
    2. Extract product name, qty, unit_price
    3. Calculate subtotal
    """
    items = []
    
    # Skip header and non-item lines
    item_lines = []
    for line in lines:
        # Skip if line is all numbers or all text
        has_numbers = bool(re.search(r'\d', line))
        has_letters = bool(re.search(r'[a-zA-Z]', line))
        
        # Item lines should have both words and numbers
        if has_numbers and has_letters:
            item_lines.append(line)
    
    # Parse each potential item line
    for line in item_lines:
        item = parse_item_line(line)
        if item and item.get("name"):
            items.append(item)
    
    return items


def parse_item_line(line):
    """
    Parse a single line into item data.
    
    Patterns:
    - "rice 2kg 200" → name: rice, qty: 2, unit_price: 200
    - "milk 80" → name: milk, unit_price: 80
    - "sugar x2 150" → name: sugar, qty: 2, unit_price: 150
    """
    # Extract all numbers from line
    numbers = re.findall(r'\d+(?:[.,]\d+)?', line)
    
    # Remove numbers from line to get product name
    name = re.sub(r'\d+(?:[.,]\d+)?|[x×]\d+', '', line).strip()
    
    # Clean up name (remove common keywords)
    name = re.sub(r'(kg|l|piece|pcs|qty|unit|price|rs|₹|€|$|amount)', '', name, flags=re.IGNORECASE).strip()
    
    if not name or len(name) < 2:
        return None
    
    try:
        # If we have 2+ numbers, first is qty, second is price
        if len(numbers) >= 2:
            quantity = int(float(numbers[0].replace(',', '')))
            unit_price = Decimal(numbers[1].replace(',', ''))
            subtotal = Decimal(quantity) * unit_price
        
        # If we have 1 number, it's the price (qty defaults to 1)
        elif len(numbers) == 1:
            quantity = 1
            unit_price = Decimal(numbers[0].replace(',', ''))
            subtotal = unit_price
        else:
            return None
        
        # Validate: price shouldn't be too low (less than 1) or unreasonable
        if unit_price < 1 or unit_price > Decimal('999999'):
            return None
        
        return {
            "name": name[:100],
            "quantity": quantity,
            "unit_price": float(unit_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "subtotal": float(subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        }
    
    except (ValueError, InvalidOperation):
        return None
