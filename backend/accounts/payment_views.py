import json
import stripe
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import User, BusinessProfile

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_checkout_session(request):
    """
    Create a Stripe checkout session for business account activation.
    
    Returns:
        {
            "checkout_url": "https://checkout.stripe.com/pay/..."
        }
    """
    try:
        user = request.user

        # Validate user is a business account
        if user.account_type != 'BUSINESS':
            return Response(
                {"error": "Only business accounts can activate"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create Stripe checkout session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[
                {
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': 'Business Account Activation',
                            'description': 'Udharo Guru Business Account Activation Fee',
                        },
                        'unit_amount': settings.STRIPE_ACTIVATION_AMOUNT,  # in cents
                    },
                    'quantity': 1,
                }
            ],
            mode='payment',
            success_url='http://localhost:5173/payment-success',  # Update to frontend URL
            cancel_url='http://localhost:5173/payment-cancel',
            metadata={
                'user_id': str(user.id),
                'email': user.email,
            }
        )

        return Response(
            {"checkout_url": session.url},
            status=status.HTTP_200_OK
        )

    except stripe.error.StripeError as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {"error": f"Server error: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@require_http_methods(['POST'])
def stripe_webhook(request):
    """
    Handle Stripe webhook events.
    
    Listens for:
    - checkout.session.completed: Update user payment status
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    try:
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return JsonResponse({'error': 'Invalid payload'}, status=400)
    except stripe.error.SignatureVerificationError:
        return JsonResponse({'error': 'Invalid signature'}, status=400)

    # Handle checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        try:
            # Get user from metadata
            user_id = session['metadata'].get('user_id')
            if not user_id:
                return JsonResponse({'error': 'No user_id in metadata'}, status=400)

            user = User.objects.get(id=user_id)

            # Update user status to KYC_PENDING (payment approved)
            user.business_status = 'KYC_PENDING'
            user.save(update_fields=['business_status'])

            # Ensure BusinessProfile exists
            profile, created = BusinessProfile.objects.get_or_create(
                user=user,
                defaults={
                    'business_name': user.full_name,
                    'owner_name': user.full_name,
                    'phone': '',
                    'email': user.email,
                    'address': '',
                    'business_type': '',
                    'pan_vat_number': '',
                }
            )

            return JsonResponse({'status': 'success'}, status=200)

        except User.DoesNotExist:
            return JsonResponse({'error': 'User not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': f'Processing error: {str(e)}'}, status=500)

    # Return 200 for all other events
    return JsonResponse({'status': 'received'}, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile_status(request):
    """
    Get current user's business profile status.
    
    Returns profile payment_status for frontend to determine next step.
    """
    try:
        user = request.user
        profile = BusinessProfile.objects.get(user=user)
        
        return Response({
            'business_status': user.business_status,
            'kyc_status': user.kyc_status,
            'profile_exists': True,
        }, status=status.HTTP_200_OK)
    except BusinessProfile.DoesNotExist:
        return Response({
            'business_status': user.business_status,
            'kyc_status': user.kyc_status,
            'profile_exists': False,
        }, status=status.HTTP_200_OK)
