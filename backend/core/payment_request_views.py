"""
Payment Request Views for both private and business payment requests.
"""
import stripe
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, NotFound

from accounts.models import User, ensure_business_profile
from accounts.permissions import IsBusinessUser
from .models import PaymentRequest, Customer, CreditSale
from .serializers import PaymentRequestSerializer, PaymentRequestCreateSerializer

stripe.api_key = settings.STRIPE_SECRET_KEY
MIN_STRIPE_AMOUNT_CENTS = 50


class PaymentRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing payment requests.
    
    POST /payment-request/: Create a new payment request
    GET /payment-request/: List all payment requests for current user
    GET /payment-request/{id}/: Get specific payment request
    """
    
    serializer_class = PaymentRequestSerializer
    permission_classes = [IsAuthenticated]
    queryset = PaymentRequest.objects.none()

    def get_queryset(self):
        """Get payment requests for current user (sent or received)."""
        user = self.request.user
        return PaymentRequest.objects.filter(
            sender=user
        ) | PaymentRequest.objects.filter(
            receiver=user
        )

    @action(detail=False, methods=['post'])
    def create_payment_request(self, request):
        """
        Create a new payment request with Stripe checkout.
        
        POST /payment-request/create_payment_request/
        
        Body:
        {
            "receiver_id": 1,  # For PRIVATE
            "customer_id": 2,  # For BUSINESS
            "amount": 1000,
            "description": "Payment for invoice",
            "request_type": "PRIVATE" or "BUSINESS",
            "credit_sale_id": 3  # Optional for BUSINESS
        }
        """
        serializer = PaymentRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        request_type = serializer.validated_data.get('request_type')
        amount = serializer.validated_data.get('amount')
        description = serializer.validated_data.get('description', '')
        receiver_id = serializer.validated_data.get('receiver_id')
        customer_id = serializer.validated_data.get('customer_id')
        credit_sale_id = serializer.validated_data.get('credit_sale_id')

        try:
            with transaction.atomic():
                # Validate and fetch receiver/customer
                receiver = None
                customer = None
                credit_sale = None

                if request_type == "PRIVATE":
                    try:
                        receiver = User.objects.get(id=receiver_id)
                    except User.DoesNotExist:
                        raise ValidationError({"receiver_id": "Receiver not found."})

                elif request_type == "BUSINESS":
                    try:
                        customer = Customer.objects.get(id=customer_id)
                    except Customer.DoesNotExist:
                        raise ValidationError({"customer_id": "Customer not found."})

                    # Ensure sender is business and owns this customer
                    try:
                        business_profile, _ = ensure_business_profile(request.user)
                        if customer.business != business_profile:
                            raise ValidationError({"customer_id": "You do not have access to this customer."})
                    except ValidationError:
                        raise
                    except Exception:
                        raise ValidationError({"error": "Business profile not found."})

                    if not (customer.phone or "").strip():
                        raise ValidationError({"customer_id": "Customer phone number is required to send a WhatsApp payment reminder."})

                    # If credit_sale_id provided, link to it
                    if credit_sale_id:
                        try:
                            credit_sale = CreditSale.objects.get(
                                id=credit_sale_id,
                                customer=customer,
                                business=business_profile
                            )
                        except CreditSale.DoesNotExist:
                            raise ValidationError({"credit_sale_id": "Credit sale not found."})

                # Create payment request
                payment_request = PaymentRequest(
                    sender=request.user,
                    receiver=receiver,
                    customer=customer,
                    amount=amount,
                    description=description,
                    request_type=request_type,
                    credit_sale=credit_sale,
                )
                payment_request.save()

                # Create Stripe checkout session when the converted amount
                # is large enough for Stripe's minimum charge rules.
                checkout_url = self._create_stripe_checkout(payment_request, amount)
                if checkout_url:
                    payment_request.checkout_url = checkout_url
                    payment_request.save(update_fields=['checkout_url'])

                    # Generate QR code only when a checkout URL exists.
                    qr_code = self._generate_qr_code(checkout_url)
                    payment_request.qr_code_data = qr_code
                    payment_request.save(update_fields=['qr_code_data'])

                serializer = PaymentRequestSerializer(payment_request)
                return Response(serializer.data, status=status.HTTP_201_CREATED)

        except ValidationError:
            raise
        except Exception as e:
            return Response(
                {"error": f"Failed to create payment request: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def sent_requests(self, request):
        """Get all sent payment requests."""
        requests_qs = PaymentRequest.objects.filter(sender=request.user).order_by('-created_at')
        serializer = PaymentRequestSerializer(requests_qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def received_requests(self, request):
        """Get all received payment requests (for PRIVATE accounts)."""
        requests_qs = PaymentRequest.objects.filter(
            receiver=request.user,
            request_type="PRIVATE"
        ).order_by('-created_at')
        serializer = PaymentRequestSerializer(requests_qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_customer_requests(self, request):
        """Get pending payment requests for business customers."""
        try:
            business_profile, _ = ensure_business_profile(request.user)
            requests_qs = PaymentRequest.objects.filter(
                sender=request.user,
                request_type="BUSINESS",
                status=PaymentRequest.PENDING
            ).order_by('-created_at')
            serializer = PaymentRequestSerializer(requests_qs, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {"error": "Not a business account"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail='uuid', methods=['get'])
    def get_public_request(self, request, pk=None):
        """Get a payment request by UUID (public endpoint)."""
        try:
            payment_request = PaymentRequest.objects.get(id=pk)
            serializer = PaymentRequestSerializer(payment_request)
            return Response(serializer.data)
        except PaymentRequest.DoesNotExist:
            raise NotFound("Payment request not found.")

    def _create_stripe_checkout(self, payment_request, amount):
        """Create Stripe checkout session for payment request."""
        try:
            # Convert NPR to USD (approximately 1 USD = 130 NPR)
            amount_usd = Decimal(amount) / Decimal('130')
            amount_cents = int(amount_usd * 100)
            if amount_cents < MIN_STRIPE_AMOUNT_CENTS:
                return ""

            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[
                    {
                        'price_data': {
                            'currency': 'usd',
                            'product_data': {
                                'name': 'Payment Request',
                                'description': payment_request.description or f"Payment of Rs. {amount}",
                            },
                            'unit_amount': amount_cents,
                        },
                        'quantity': 1,
                    }
                ],
                mode='payment',
                success_url='http://localhost:5173/payment-success?session_id={CHECKOUT_SESSION_ID}',
                cancel_url='http://localhost:5173/payment-cancel',
                metadata={
                    'payment_request_id': str(payment_request.id),
                    'sender_id': str(payment_request.sender.id),
                    'receiver_id': str(payment_request.receiver.id) if payment_request.receiver else '',
                    'customer_id': str(payment_request.customer.id) if payment_request.customer else '',
                    'request_type': payment_request.request_type,
                }
            )

            # Store session ID
            payment_request.stripe_session_id = session.id
            payment_request.save(update_fields=['stripe_session_id'])

            return session.url

        except stripe.error.StripeError as e:
            raise ValidationError(f"Stripe error: {str(e)}")

    def _generate_qr_code(self, url):
        """Generate QR code from checkout URL."""
        try:
            import qrcode
            import io
            import base64

            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(url)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")

            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()

            return f"data:image/png;base64,{img_str}"

        except Exception as e:
            # Return empty string if QR generation fails
            return ""

    @action(detail='uuid', methods=['post'])
    def cancel_request(self, request, pk=None):
        """Cancel a payment request."""
        try:
            payment_request = PaymentRequest.objects.get(id=pk)

            # Only sender can cancel
            if payment_request.sender != request.user:
                return Response(
                    {"error": "You can only cancel your own requests."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Can only cancel pending requests
            if payment_request.status != PaymentRequest.PENDING:
                return Response(
                    {"error": f"Cannot cancel a {payment_request.status.lower()} request."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            payment_request.status = PaymentRequest.CANCELLED
            payment_request.save(update_fields=['status'])

            serializer = PaymentRequestSerializer(payment_request)
            return Response(serializer.data)

        except PaymentRequest.DoesNotExist:
            raise NotFound("Payment request not found.")
