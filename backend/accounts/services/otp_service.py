import os
import secrets
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import EmailMessage, get_connection
from django.db import transaction
from django.utils import timezone

from accounts.models import TwoFactorOTP


OTP_LENGTH = 6
DEFAULT_EXPIRY_MINUTES = 10
DEFAULT_MAX_ATTEMPTS = 5
DEFAULT_RESEND_COOLDOWN_SECONDS = 60


class OTPError(Exception):
    default_message = "OTP verification failed."

    def __init__(self, message=None):
        super().__init__(message or self.default_message)


class OTPExpiredError(OTPError):
    default_message = "OTP has expired."


class OTPInvalidError(OTPError):
    default_message = "Invalid OTP."


class OTPMaxAttemptsError(OTPError):
    default_message = "Maximum OTP attempts exceeded."


class OTPAlreadyUsedError(OTPError):
    default_message = "OTP has already been used."


class OTPCooldownError(OTPError):
    default_message = "Please wait before requesting another OTP."

    def __init__(self, retry_after_seconds, message=None):
        self.retry_after_seconds = max(0, int(retry_after_seconds))
        super().__init__(message or self.default_message)


@dataclass(frozen=True)
class OTPDelivery:
    otp: TwoFactorOTP
    code: str


def generate_otp_code(length=OTP_LENGTH):
    upper_bound = 10 ** length
    return f"{secrets.randbelow(upper_bound):0{length}d}"


def get_otp_expiry_minutes():
    return int(getattr(settings, "OTP_EXPIRY_MINUTES", os.getenv("OTP_EXPIRY_MINUTES", DEFAULT_EXPIRY_MINUTES)))


def get_otp_max_attempts():
    return int(getattr(settings, "OTP_MAX_ATTEMPTS", os.getenv("OTP_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS)))


def get_otp_resend_cooldown_seconds():
    return int(
        getattr(
            settings,
            "OTP_RESEND_COOLDOWN_SECONDS",
            os.getenv("OTP_RESEND_COOLDOWN_SECONDS", DEFAULT_RESEND_COOLDOWN_SECONDS),
        )
    )


def create_otp(user=None, email=None, purpose='LOGIN_2FA', *, now=None):
    """
    Create an OTP for a user or email.
    Either user or email must be provided.
    """
    if not user and not email:
        raise ValueError("Either user or email must be provided")
    
    now = now or timezone.now()
    code = generate_otp_code()
    
    # Invalidate any existing active OTPs for this user/email + purpose
    query_filter = {}
    if user:
        query_filter['user'] = user
    else:
        query_filter['email'] = email
    query_filter['purpose'] = purpose
    query_filter['used_at__isnull'] = True
    
    TwoFactorOTP.objects.filter(**query_filter).update(
        expires_at=now  # Mark as expired
    )
    
    otp = TwoFactorOTP.objects.create(
        user=user,
        email=email or (user.email if user else None),
        purpose=purpose,
        otp_hash=make_password(code),
        expires_at=now + timedelta(minutes=get_otp_expiry_minutes()),
        last_sent_at=now,
    )
    return OTPDelivery(otp=otp, code=code)


def get_latest_otp(user=None, email=None, purpose='LOGIN_2FA'):
    """Get the latest OTP for a user/email and purpose."""
    if not user and not email:
        raise ValueError("Either user or email must be provided")
    
    query_filter = {'purpose': purpose}
    if user:
        query_filter['user'] = user
    else:
        query_filter['email'] = email
    
    return TwoFactorOTP.objects.filter(**query_filter).order_by("-created_at").first()


def assert_resend_allowed(user=None, email=None, purpose='LOGIN_2FA', *, now=None):
    """Check if resend is allowed based on cooldown."""
    now = now or timezone.now()
    latest_otp = get_latest_otp(user=user, email=email, purpose=purpose)
    if not latest_otp:
        return

    cooldown = timedelta(seconds=get_otp_resend_cooldown_seconds())
    available_at = latest_otp.last_sent_at + cooldown
    if now < available_at:
        retry_after = (available_at - now).total_seconds()
        raise OTPCooldownError(retry_after)


def create_resend_otp(user=None, email=None, purpose='LOGIN_2FA', *, now=None):
    """Create and resend an OTP after checking cooldown."""
    now = now or timezone.now()
    assert_resend_allowed(user=user, email=email, purpose=purpose, now=now)
    return create_otp(user=user, email=email, purpose=purpose, now=now)


def verify_otp(code, user=None, email=None, purpose='LOGIN_2FA', *, now=None):
    """
    Verify an OTP for a user/email and purpose.
    Returns the verified OTP record.
    """
    if not user and not email:
        raise ValueError("Either user or email must be provided")
    
    now = now or timezone.now()
    normalized_code = str(code or "").strip()

    with transaction.atomic():
        query_filter = {'purpose': purpose}
        if user:
            query_filter['user'] = user
        else:
            query_filter['email'] = email

        otp = (
            TwoFactorOTP.objects.select_for_update()
            .filter(**query_filter)
            .order_by("-created_at")
            .first()
        )

        if not otp:
            raise OTPInvalidError(f"No OTP found for {purpose}.")

        if otp.used_at:
            raise OTPAlreadyUsedError()

        if otp.expires_at <= now:
            raise OTPExpiredError()

        if otp.attempt_count >= get_otp_max_attempts():
            raise OTPMaxAttemptsError()

        if not check_password(normalized_code, otp.otp_hash):
            otp.attempt_count += 1
            otp.save(update_fields=["attempt_count"])
            if otp.attempt_count >= get_otp_max_attempts():
                raise OTPMaxAttemptsError()
            raise OTPInvalidError()

        otp.used_at = now
        otp.save(update_fields=["used_at"])
        return otp


def get_email_connection():
    host = os.getenv("EMAIL_HOST") or getattr(settings, "EMAIL_HOST", "")
    username = os.getenv("EMAIL_HOST_USER") or getattr(settings, "EMAIL_HOST_USER", "")
    password = os.getenv("EMAIL_HOST_PASSWORD") or getattr(settings, "EMAIL_HOST_PASSWORD", "")
    backend = os.getenv("EMAIL_BACKEND") or getattr(settings, "EMAIL_BACKEND", "")

    if backend:
        return get_connection(backend=backend)

    if host and username and password:
        return get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=host,
            port=int(os.getenv("EMAIL_PORT") or getattr(settings, "EMAIL_PORT", 587)),
            username=username,
            password=password,
            use_tls=str(os.getenv("EMAIL_USE_TLS") or getattr(settings, "EMAIL_USE_TLS", "True")) == "True",
        )

    return get_connection(backend="django.core.mail.backends.console.EmailBackend")


def send_otp_email(email, code, purpose='LOGIN_2FA'):
    """Send OTP email with context-specific message."""
    expiry_minutes = get_otp_expiry_minutes()
    from_email = os.getenv("DEFAULT_FROM_EMAIL") or getattr(settings, "DEFAULT_FROM_EMAIL", "Udharo Guru <no-reply@localhost>")
    
    # Purpose-specific messages
    purpose_messages = {
        'LOGIN_2FA': f"Your UdharoGuru login OTP is {code}.",
        'PASSWORD_RESET': f"Your UdharoGuru password reset code is {code}.",
        'EMAIL_VERIFICATION': f"Your UdharoGuru verification code is {code}.",
    }
    
    subject_map = {
        'LOGIN_2FA': "Your UdharoGuru login OTP",
        'PASSWORD_RESET': "Password Reset Code",
        'EMAIL_VERIFICATION': "Email Verification Code",
    }
    
    base_message = purpose_messages.get(purpose, f"Your OTP is {code}.")
    
    message = (
        f"{base_message}\n\n"
        f"This code expires in {expiry_minutes} minutes. "
        "If you did not request this, you can ignore this email."
    )

    email_obj = EmailMessage(
        subject=subject_map.get(purpose, "Your UdharoGuru OTP"),
        body=message,
        from_email=from_email,
        to=[email],
        connection=get_email_connection(),
    )
    email_obj.send(fail_silently=False)


def create_and_send_otp(user=None, email=None, purpose='LOGIN_2FA'):
    """Create OTP and send via email. Returns OTP record."""
    delivery = create_otp(user=user, email=email, purpose=purpose)
    send_otp_email(delivery.otp.email, delivery.code, purpose=purpose)
    return delivery.otp


def resend_otp(user=None, email=None, purpose='LOGIN_2FA'):
    """Resend OTP after cooldown check. Returns OTP record."""
    delivery = create_resend_otp(user=user, email=email, purpose=purpose)
    send_otp_email(delivery.otp.email, delivery.code, purpose=purpose)
    return delivery.otp
