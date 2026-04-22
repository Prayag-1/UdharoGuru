import re
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import pytesseract
from PIL import Image, ImageFilter, ImageOps

try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None


RESTAURANT_KEYWORDS = ("SUBTOTAL", "TAX", "TABLE", "SERVER")
RETAIL_KEYWORDS = ("DESCRIPTION", "PRICE", "CASH RECEIPT")
DATE_PATTERNS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%m-%d-%Y",
    "%m/%d/%Y",
    "%d-%m-%y",
    "%d/%m/%y",
)
AMOUNT_CAPTURE = r"([0-9][0-9,]*(?:\.[0-9]{1,2})?)"
AMOUNT_TOKEN = rf"[$]?\s*{AMOUNT_CAPTURE}"


def quantize_money(value):
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def normalize_whitespace(value):
    return re.sub(r"\s+", " ", (value or "")).strip()


def normalize_ocr_text(text):
    cleaned = (text or "").replace("\x0c", " ")
    cleaned = cleaned.replace("|", "I")
    cleaned = cleaned.replace("§", "S")
    cleaned = cleaned.replace("O00", "000")
    cleaned = cleaned.replace("TOTAL:", "TOTAL ")
    return cleaned


def choose_psm(image):
    if hasattr(image, "shape"):
        height, width = image.shape[:2]
    else:
        width, height = image.size
    aspect_ratio = height / max(width, 1)
    if aspect_ratio > 2.0:
        return 4
    return 6 if width >= 900 else 11


def preprocess_image(image_path):
    if cv2 is None or np is None:
        img = Image.open(image_path)
        gray = ImageOps.grayscale(img)
        width, height = gray.size
        longest_edge = max(width, height)
        if longest_edge < 1600:
            scale = max(2.0, 1600 / max(longest_edge, 1))
            gray = gray.resize((int(width * scale), int(height * scale)))
        denoised = gray.filter(ImageFilter.MedianFilter(size=3))
        boosted = ImageOps.autocontrast(denoised)
        return boosted.point(lambda x: 255 if x > 160 else 0, mode="L")

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Unable to read image for OCR.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape[:2]
    longest_edge = max(height, width)
    if longest_edge < 1600:
        scale = max(2.0, 1600 / max(longest_edge, 1))
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    denoised = cv2.fastNlMeansDenoising(gray, None, 20, 7, 21)
    blurred = cv2.GaussianBlur(denoised, (5, 5), 0)
    thresholded = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        35,
        11,
    )
    kernel = np.ones((2, 2), np.uint8)
    cleaned = cv2.morphologyEx(thresholded, cv2.MORPH_OPEN, kernel, iterations=1)
    cleaned = cv2.medianBlur(cleaned, 3)
    if np.mean(cleaned) < 127:
        cleaned = cv2.bitwise_not(cleaned)
    return cleaned


def run_ocr(image_path):
    processed = preprocess_image(image_path)
    psm = choose_psm(processed)
    config = f"--oem 3 --psm {psm}"
    text = pytesseract.image_to_string(processed, config=config)
    return normalize_ocr_text(text)


def parse_decimal(value):
    if value is None:
        return None
    candidate = str(value).strip()
    if not candidate:
        return None
    candidate = candidate.replace(",", "")
    candidate = re.sub(r"[^0-9.\-]", "", candidate)
    if not candidate:
        return None
    try:
        return quantize_money(Decimal(candidate))
    except InvalidOperation:
        return None


def decimal_to_float(value):
    return float(value) if value is not None else None


def find_first_amount(text, patterns):
    lines = [normalize_whitespace(line) for line in (text or "").splitlines() if normalize_whitespace(line)]
    for pattern in patterns:
        for line in lines:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                amount = parse_decimal(match.group(1))
                if amount is not None:
                    return amount
    return None


def extract_amount_candidates(text):
    candidates = []
    for match in re.finditer(AMOUNT_TOKEN, text or "", re.IGNORECASE):
        amount = parse_decimal(match.group(1))
        if amount is not None:
            candidates.append(amount)
    return candidates


def extract_amount(text):
    amounts = extract_amount_candidates(text)
    return max(amounts) if amounts else None


def extract_date(text):
    if not text:
        return None
    normalized = normalize_ocr_text(text)
    for pattern in (r"\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b", r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"):
        for match in re.finditer(pattern, normalized):
            raw = match.group(0)
            for fmt in DATE_PATTERNS:
                try:
                    parsed = datetime.strptime(raw, fmt).date()
                    if parsed.year < 2000:
                        parsed = parsed.replace(year=parsed.year + 2000)
                    return parsed
                except ValueError:
                    continue
    return None


def extract_merchant(text):
    if not text:
        return None
    lines = [normalize_whitespace(line) for line in text.splitlines() if normalize_whitespace(line)]
    skip_tokens = {"subtotal", "tax", "total", "description", "price", "cash receipt", "table", "server"}
    for line in lines:
        if any(token in line.lower() for token in skip_tokens):
            continue
        if re.search(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", line):
            continue
        if re.search(AMOUNT_TOKEN, line):
            continue
        letters = re.sub(r"[^A-Za-z& ]", "", line).strip()
        if len(letters) >= 3:
            return line[:255]
    return None


def extract_phone_number(text):
    if not text:
        return None
    matches = re.findall(r"(?:\+?977[-\s]?)?(9\d{9})", text)
    if matches:
        return matches[0]
    return None


def extract_customer_name_from_id(text):
    if not text:
        return None
    parsed = parse_customer_id_text(text)
    return parsed.get("customer_name") or None


def _id_candidate_lines(text):
    lines = [normalize_whitespace(line) for line in text.splitlines() if normalize_whitespace(line)]
    cleaned = []
    for line in lines:
        normalized = re.sub(r"[^\w\s,:/-]", " ", line)
        normalized = normalize_whitespace(normalized)
        if normalized:
            cleaned.append(normalized)
    return cleaned


def _clean_name_tokens(line):
    tokens = re.findall(r"[A-Za-z]{2,}", line or "")
    cleaned = []
    for token in tokens:
        lowered = token.lower()
        if lowered in {
            "id",
            "card",
            "number",
            "dob",
            "sex",
            "hgt",
            "wgt",
            "eyes",
            "iss",
            "exp",
            "name",
            "street",
            "city",
        }:
            continue
        if token.isupper() or token[0].isupper():
            cleaned.append(token.upper())
    return cleaned


def extract_id_number(text):
    if not text:
        return None
    lines = _id_candidate_lines(text)
    patterns = (
        r"\bNUMBER[:\s#-]*([A-Z0-9/-]{4,})\b",
        r"\bID\s*NO[:\s#-]*([A-Z0-9/-]{4,})\b",
        r"\bNO[:\s#-]*([A-Z0-9/-]{4,})\b",
    )
    for line in lines:
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1).strip()
    return None


def extract_dob_from_id(text):
    if not text:
        return None
    lines = _id_candidate_lines(text)
    for line in lines:
        match = re.search(r"\bDOB[:\s-]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})\b", line, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def extract_address_from_id(text):
    if not text:
        return None
    lines = _id_candidate_lines(text)
    address_keywords = ("street", "city", "address", "ward", "district", "province")
    for line in lines:
        lowered = line.lower()
        if any(keyword in lowered for keyword in address_keywords):
            return line[:255]
    return None


def extract_name_from_id(text):
    if not text:
        return None

    lines = _id_candidate_lines(text)

    for idx, line in enumerate(lines):
        lowered = line.lower()
        if "name" in lowered and "id name" not in lowered:
            after = re.split(r"name[:\s-]*", line, maxsplit=1, flags=re.IGNORECASE)[-1]
            tokens = _clean_name_tokens(after)
            if len(tokens) >= 2:
                return " ".join(tokens[:3])

        tokens = _clean_name_tokens(line)
        if not tokens:
            continue

        if len(tokens) >= 2 and not re.search(r"\d", line):
            return " ".join(tokens[:3])

        if len(tokens) == 1 and idx + 1 < len(lines):
            next_tokens = _clean_name_tokens(lines[idx + 1])
            if len(next_tokens) >= 1:
                return " ".join((tokens + next_tokens)[:3])

    return None


def parse_customer_id_text(text):
    customer_name = extract_name_from_id(text) or ""
    address = extract_address_from_id(text) or ""
    id_number = extract_id_number(text) or ""
    dob = extract_dob_from_id(text) or ""
    return {
        "customer_name": customer_name,
        "phone": extract_phone_number(text) or "",
        "address": address,
        "id_number": id_number,
        "dob": dob,
    }


def detect_bill_type(text):
    upper_text = (text or "").upper()
    restaurant_hits = sum(keyword in upper_text for keyword in RESTAURANT_KEYWORDS)
    retail_hits = sum(keyword in upper_text for keyword in RETAIL_KEYWORDS)

    if restaurant_hits >= 2:
        return "restaurant"
    if retail_hits >= 2:
        return "retail"
    if "CASH RECEIPT" in upper_text:
        return "retail"
    if "TABLE" in upper_text and "SERVER" in upper_text:
        return "restaurant"
    return "unknown"


def parse_restaurant_items(text):
    items = []
    for raw_line in text.splitlines():
        line = normalize_whitespace(raw_line)
        if not line:
            continue
        if any(keyword in line.upper() for keyword in ("SUBTOTAL", "TOTAL", "TAX", "TABLE", "SERVER")):
            continue

        match = re.search(r"^(?P<qty>\d+)\s+(?P<name>.+?)\s+\$?(?P<price>[0-9][0-9,]*(?:\.[0-9]{1,2})?)$", line)
        if not match:
            continue

        qty = int(match.group("qty"))
        price = parse_decimal(match.group("price"))
        if price is None or qty <= 0:
            continue
        subtotal = quantize_money(price * qty)
        items.append(
            {
                "quantity": qty,
                "name": normalize_whitespace(match.group("name"))[:100],
                "unit_price": float(price),
                "subtotal": float(subtotal),
            }
        )
    return items


def parse_retail_items(text):
    items = []
    in_description_block = False

    for raw_line in text.splitlines():
        line = normalize_whitespace(raw_line)
        if not line:
            continue

        upper = line.upper()
        if "DESCRIPTION" in upper and "PRICE" in upper:
            in_description_block = True
            continue
        if any(keyword in upper for keyword in ("TOTAL", "CASH", "CHANGE")):
            in_description_block = False if "TOTAL" in upper else in_description_block
        if not in_description_block:
            continue

        match = re.search(r"^(?P<name>.+?)\s+\$?(?P<price>[0-9][0-9,]*(?:\.[0-9]{1,2})?)$", line)
        if not match:
            continue

        price = parse_decimal(match.group("price"))
        if price is None:
            continue
        items.append(
            {
                "quantity": 1,
                "name": normalize_whitespace(match.group("name"))[:100],
                "unit_price": float(price),
                "subtotal": float(price),
            }
        )
    return items


def parse_restaurant_bill(text):
    total = find_first_amount(
        text,
        (
            rf"\bTOTAL\s*\$?\s*{AMOUNT_CAPTURE}",
            rf"\bTotal\s*\$?\s*{AMOUNT_CAPTURE}",
            rf"\bAMOUNT DUE\s*\$?\s*{AMOUNT_CAPTURE}",
        ),
    ) or extract_amount(text)
    subtotal = find_first_amount(text, (rf"\bSubtotal\s*\$?\s*{AMOUNT_CAPTURE}",))
    tax = find_first_amount(text, (rf"\bTax\s*\$?\s*{AMOUNT_CAPTURE}",))

    return {
        "bill_type": "restaurant",
        "vendor": extract_merchant(text),
        "date": extract_date(text),
        "total_amount": total,
        "subtotal": subtotal,
        "tax": tax,
        "items": parse_restaurant_items(text),
        "payment_details": {},
    }


def parse_retail_bill(text):
    total = find_first_amount(
        text,
        (
            rf"\bTotal\s*\$?\s*{AMOUNT_CAPTURE}",
            rf"\bTOTAL\s*\$?\s*{AMOUNT_CAPTURE}",
            rf"\bGrand Total\s*\$?\s*{AMOUNT_CAPTURE}",
        ),
    ) or extract_amount(text)
    cash = find_first_amount(text, (rf"\bCash\s*\$?\s*{AMOUNT_CAPTURE}",))
    change = find_first_amount(text, (rf"\bChange\s*\$?\s*{AMOUNT_CAPTURE}",))

    return {
        "bill_type": "retail",
        "vendor": extract_merchant(text),
        "date": extract_date(text),
        "total_amount": total,
        "subtotal": None,
        "tax": None,
        "items": parse_retail_items(text),
        "payment_details": {
            "cash": float(cash) if cash is not None else None,
            "change": float(change) if change is not None else None,
        },
    }


def parse_unknown_bill(text):
    return {
        "bill_type": "unknown",
        "vendor": extract_merchant(text),
        "date": extract_date(text),
        "total_amount": find_first_amount(
            text,
            (
                rf"\bTOTAL\s*\$?\s*{AMOUNT_CAPTURE}",
                rf"\bGrand Total\s*\$?\s*{AMOUNT_CAPTURE}",
                rf"\bAmount Due\s*\$?\s*{AMOUNT_CAPTURE}",
            ),
        ) or extract_amount(text),
        "subtotal": None,
        "tax": None,
        "items": [],
        "payment_details": {},
    }


def confidence_from_fields(bill_type, total_amount, items, subtotal, tax):
    score = 0
    if bill_type in {"restaurant", "retail"}:
        score += 2
    if total_amount is not None:
        score += 2
    if items:
        score += 1
    if subtotal is not None:
        score += 1
    if tax is not None:
        score += 1

    if score >= 5:
        return "high"
    if score >= 3:
        return "medium"
    return "low"


def extract_total_amount(text):
    parsed = parse_ocr_text_to_credit_sale(text)
    total = parsed.get("total_amount")
    return parse_decimal(total) if total not in (None, "") else None


def parse_ocr_text_to_credit_sale(text):
    normalized_text = normalize_ocr_text(text)
    if not normalized_text.strip():
        return {
            "customer_name": "",
            "vendor": None,
            "items": [],
            "total_amount": None,
            "subtotal": None,
            "tax": None,
            "date": None,
            "bill_type": "unknown",
            "payment_details": {},
            "confidence": "low",
            "warning": "No OCR text was extracted. Manual review is required.",
            "manual_review_required": True,
        }

    bill_type = detect_bill_type(normalized_text)
    if bill_type == "restaurant":
        parsed = parse_restaurant_bill(normalized_text)
    elif bill_type == "retail":
        parsed = parse_retail_bill(normalized_text)
    else:
        parsed = parse_unknown_bill(normalized_text)

    confidence = confidence_from_fields(
        parsed["bill_type"], parsed["total_amount"], parsed["items"], parsed["subtotal"], parsed["tax"]
    )
    warning = None
    if parsed["total_amount"] is None:
        warning = "Total amount was not confidently detected. Partial data returned for manual review."
    elif parsed["bill_type"] == "unknown":
        warning = "Bill type not recognized. Partial data returned for manual review."

    return {
        "customer_name": parsed["vendor"] or "",
        "vendor": parsed["vendor"],
        "items": parsed["items"],
        "total_amount": decimal_to_float(parsed["total_amount"]),
        "subtotal": decimal_to_float(parsed["subtotal"]),
        "tax": decimal_to_float(parsed["tax"]),
        "date": parsed["date"].isoformat() if parsed["date"] else None,
        "bill_type": parsed["bill_type"],
        "payment_details": parsed["payment_details"],
        "confidence": confidence,
        "warning": warning,
        "manual_review_required": parsed["total_amount"] is None or confidence == "low",
    }
