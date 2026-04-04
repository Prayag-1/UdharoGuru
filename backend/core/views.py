from django.contrib.auth import get_user_model
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from django.http import FileResponse
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound, ValidationError as DRFValidationError
from accounts.models import ensure_business_profile
from accounts.permissions import IsBusinessUser
from notifications.services import create_settlement_notification
from .models import Customer, Transaction, Product, CreditSale, CreditSaleItem, Payment
from .receipts import generate_settlement_receipt
from .serializers import CustomerSerializer, TransactionSerializer, ProductSerializer, CreditSaleSerializer, CreditSaleItemSerializer, PaymentSerializer

User = get_user_model()


def get_business_profile_for_user(user):
    profile, _ = ensure_business_profile(user)
    return profile

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, IsBusinessUser]

    def _get_business(self):
        return get_business_profile_for_user(self.request.user)

    def get_queryset(self):
        profile = self._get_business()
        return Customer.objects.filter(business=profile)

    def perform_create(self, serializer):
        profile = self._get_business()
        serializer.save(business=profile)
    @action(detail=True, methods=["get"])
    def balance(self, request, pk=None):
        customer = self.get_object()

        credit = customer.transactions.filter(
            transaction_type="CREDIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        debit = customer.transactions.filter(
            transaction_type="DEBIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        return Response({
            "customer_id": customer.id,
            "customer_name": customer.name,
            "credit_total": credit,
            "debit_total": debit,
            "balance": credit - debit,
        })

    @action(detail=True, methods=["get"])
    def ledger(self, request, pk=None):
        """Get ledger entries (credit sales and payments) for a customer with running balance."""
        customer = self.get_object()
        
        # Collect all ledger entries
        ledger_entries = []
        
        # Add opening balance as first entry
        if customer.opening_balance != 0:
            ledger_entries.append({
                "date": customer.created_at.date(),
                "type": "OPENING_BALANCE",
                "description": "Opening Balance",
                "amount": abs(customer.opening_balance),
                "is_credit": customer.opening_balance > 0,
                "sort_key": (customer.created_at, 0),  # Sort before transactions on same day
            })
        
        # Add credit sales
        credit_sales = CreditSale.objects.filter(customer=customer).order_by("created_at")
        for sale in credit_sales:
            ledger_entries.append({
                "date": sale.created_at.date(),
                "type": "CREDIT_SALE",
                "description": f"Sale {sale.invoice_number}",
                "amount": sale.total_amount,
                "is_credit": True,
                "sort_key": (sale.created_at, 1),
            })
        
        # Add payments
        payments = Payment.objects.filter(customer=customer).order_by("payment_date", "created_at")
        for payment in payments:
            ledger_entries.append({
                "date": payment.payment_date,
                "type": "PAYMENT",
                "description": f"Payment via {payment.get_payment_method_display()}",
                "amount": payment.amount,
                "is_credit": False,
                "sort_key": (payment.payment_date, payment.created_at),
            })
        
        # Sort by date
        ledger_entries.sort(key=lambda x: x["sort_key"])
        
        # Calculate running balance
        running_balance = customer.opening_balance or 0
        result_entries = []
        
        for entry in ledger_entries:
            if entry["type"] == "OPENING_BALANCE":
                running_balance = entry["amount"] if entry["is_credit"] else -entry["amount"]
            else:
                if entry["is_credit"]:
                    running_balance += entry["amount"]
                else:
                    running_balance -= entry["amount"]
            
            result_entries.append({
                "date": entry["date"],
                "type": entry["type"],
                "description": entry["description"],
                "amount": entry["amount"],
                "running_balance": running_balance,
            })
        
        return Response({
            "customer_id": customer.id,
            "customer_name": customer.name,
            "opening_balance": customer.opening_balance or 0,
            "current_balance": running_balance,
            "entries": result_entries,
        })


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated, IsBusinessUser]

    def _get_business(self):
        return get_business_profile_for_user(self.request.user)

    def get_queryset(self):
        """
        Only allow users to see transactions
        linked to their own customers
        """
        profile = self._get_business()
        queryset = Transaction.objects.filter(customer__business=profile)

        customer_id = self.request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        return queryset

    def perform_create(self, serializer):
        """
        Extra safety check to prevent users
        from creating transactions for
        other users' customers
        """
        profile = self._get_business()
        customer = serializer.validated_data["customer"]
        if customer.business_id != profile.id:
            raise PermissionError("Not allowed to add transaction for this customer")

        serializer.save()

    def perform_update(self, serializer):
        instance = serializer.instance
        previous_status = instance.status
        transaction = serializer.save()
        new_status = transaction.status

        if previous_status != Transaction.PAID and new_status == Transaction.PAID:
            if not transaction.settled_at:
                transaction.settled_at = timezone.now()
                transaction.save(update_fields=["settled_at"])
            self._notify_settlement(transaction)

    def _notify_settlement(self, transaction):
        customer_email = (getattr(transaction.customer, "email", "") or "").strip()
        if not customer_email:
            return
        recipient = (
            User.objects.filter(email__iexact=customer_email)
            .exclude(id=self.request.user.id)
            .first()
        )
        if not recipient:
            return
        sender_name = self.request.user.full_name or self.request.user.email
        amount_value = transaction.amount
        amount_display = f"{amount_value:,.2f}"
        message = f"{sender_name} has settled a debt of Rs. {amount_display} with you."
        create_settlement_notification(
            recipient=recipient,
            sender=self.request.user,
            transaction=transaction,
            message=message,
        )

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt(self, request, pk=None):
        transaction = self.get_object()
        if transaction.status != Transaction.PAID:
            return Response({"detail": "Transaction is not settled."}, status=400)

        receipt_path = generate_settlement_receipt(transaction)
        return FileResponse(
            open(receipt_path, "rb"),
            as_attachment=True,
            filename=receipt_path.name,
            content_type="application/pdf",
        )

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """
        Secure summary endpoint
        URL: /api/transactions/summary/?customer=<id>
        """
        customer_id = request.query_params.get("customer")
        if not customer_id:
            return Response(
                {"error": "customer parameter is required"},
                status=400
            )

        profile = self._get_business()
        qs = Transaction.objects.filter(
            customer_id=customer_id,
            customer__business=profile,
        )

        credit_total = qs.filter(
            transaction_type="CREDIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        debit_total = qs.filter(
            transaction_type="DEBIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        balance = credit_total - debit_total

        return Response({
            "customer_id": int(customer_id),
            "credit_total": credit_total,
            "debit_total": debit_total,
            "balance": balance,
        })


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, IsBusinessUser]

    def _get_business(self):
        return get_business_profile_for_user(self.request.user)

    def get_queryset(self):
        profile = self._get_business()
        return Product.objects.filter(business=profile).order_by("name")

    def perform_create(self, serializer):
        profile = self._get_business()
        serializer.save(business=profile)


class CreditSaleViewSet(viewsets.ModelViewSet):
    serializer_class = CreditSaleSerializer
    permission_classes = [IsAuthenticated, IsBusinessUser]

    def _get_business(self):
        return get_business_profile_for_user(self.request.user)

    def get_queryset(self):
        profile = self._get_business()
        return CreditSale.objects.filter(business=profile).select_related("customer").prefetch_related("items")

    def perform_create(self, serializer):
        """Create a credit sale with stock reduction and proper transactions."""
        profile = self._get_business()
        customer = serializer.validated_data.get("customer")
        
        # Verify customer belongs to this business
        if customer.business_id != profile.id:
            raise DRFValidationError({"customer": "Customer does not belong to this business."})
        
        # Save the sale
        sale = serializer.save(business=profile)
        
        # Recalculate totals to ensure consistency
        sale.calculate_totals()
        sale.save()
        
        # Reduce product stock if items exist
        if sale.items.exists():
            self._reduce_stock(sale)

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to recalculate totals before returning."""
        response = super().retrieve(request, *args, **kwargs)
        
        # Recalculate totals to ensure they're accurate
        sale = self.get_object()
        sale.calculate_totals()
        sale.save()
        
        # Return updated serialized data
        serializer = self.get_serializer(sale)
        return Response(serializer.data)

    def list(self, request, *args, **kwargs):
        """Override list to recalculate totals for all sales."""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Recalculate totals for all sales in the queryset
        for sale in queryset:
            sale.calculate_totals()
            sale.save()
        
        # Return serialized data
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    def _reduce_stock(self, sale):
        """Reduce product stock for all items in the sale using database transaction."""
        try:
            with transaction.atomic():
                sale_items = sale.items.all()
                for item in sale_items:
                    if item.product:
                        # Use adjust_stock to validate
                        item.product.adjust_stock(-item.quantity)
        except Exception as e:
            # Remove the sale if stock adjustment fails
            sale.delete()
            raise DRFValidationError({
                "items": f"Failed to reduce stock: {str(e)}"
            })
    
    @action(detail=True, methods=["post"])
    def add_item(self, request, pk=None):
        """Add an item to an existing credit sale."""
        sale = self.get_object()
        
        serializer = CreditSaleItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        product = serializer.validated_data["product"]
        quantity = serializer.validated_data["quantity"]
        
        # Check stock availability
        if product.stock_quantity < quantity:
            raise DRFValidationError({
                "quantity": f"Insufficient stock. Available: {product.stock_quantity}"
            })
        
        # Create or update item
        item, created = CreditSaleItem.objects.update_or_create(
            credit_sale=sale,
            product=product,
            defaults={
                "quantity": quantity,
                "unit_price": serializer.validated_data["unit_price"],
            }
        )
        
        # Recalculate sale totals
        sale.calculate_totals()
        sale.save()
        
        # Return the updated sale with recalculated totals
        sale_serializer = CreditSaleSerializer(sale)
        return Response(sale_serializer.data, status=201)
    
    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        """Record a payment for a credit sale."""
        sale = self.get_object()
        amount = request.data.get("amount")
        
        if not amount:
            raise DRFValidationError({"amount": "Payment amount is required."})
        
        try:
            amount = float(amount)
            if amount <= 0:
                raise DRFValidationError({"amount": "Payment amount must be greater than zero."})
        except (ValueError, TypeError):
            raise DRFValidationError({"amount": "Invalid amount format."})
        
        sale.record_payment(amount)
        sale.save()
        
        return Response({
            "id": sale.id,
            "invoice_number": sale.invoice_number,
            "total_amount": sale.total_amount,
            "amount_paid": sale.amount_paid,
            "amount_due": sale.amount_due,
            "status": sale.status,
        })
    
    @action(detail=False, methods=["get"])
    def pending(self, request):
        """Get all pending credit sales."""
        profile = self._get_business()
        sales = CreditSale.objects.filter(
            business=profile,
            status=CreditSale.PENDING
        ).select_related("customer")
        serializer = self.get_serializer(sales, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Get summary statistics for credit sales."""
        profile = self._get_business()
        sales = CreditSale.objects.filter(business=profile)
        
        total_sales = sales.aggregate(total=Sum("total_amount"))["total"] or 0
        total_paid = sales.aggregate(total=Sum("amount_paid"))["total"] or 0
        total_due = sales.aggregate(total=Sum("amount_due"))["total"] or 0
        
        pending_count = sales.filter(status=CreditSale.PENDING).count()
        partial_count = sales.filter(status=CreditSale.PARTIAL).count()
        paid_count = sales.filter(status=CreditSale.PAID).count()
        
        return Response({
            "total_sales": total_sales,
            "total_paid": total_paid,
            "total_due": total_due,
            "pending_count": pending_count,
            "partial_count": partial_count,
            "paid_count": paid_count,
        })
    
    @action(detail=True, methods=["get"])
    def invoice(self, request, pk=None):
        """Generate and return PDF invoice for a credit sale."""
        from .invoices import generate_invoice_pdf
        
        sale = self.get_object()
        
        try:
            # Generate PDF
            pdf_buffer = generate_invoice_pdf(sale)
            
            # Return PDF as file download
            filename = f'{sale.invoice_number.replace("/", "-")}.pdf'
            response = FileResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            return response
        except Exception as e:
            raise DRFValidationError({"invoice": f"Failed to generate invoice: {str(e)}"})


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsBusinessUser]

    def _get_business(self):
        return get_business_profile_for_user(self.request.user)

    def get_queryset(self):
        profile = self._get_business()
        return Payment.objects.filter(
            business=profile
        ).select_related("customer", "credit_sale").order_by("-payment_date")

    def perform_create(self, serializer):
        """Create a payment and update the credit sale."""
        profile = self._get_business()
        customer = serializer.validated_data.get("customer")
        credit_sale = serializer.validated_data.get("credit_sale")

        # Verify customer and sale belong to this business
        if customer.business_id != profile.id:
            raise DRFValidationError({"customer": "Customer does not belong to this business."})
        if credit_sale.business_id != profile.id:
            raise DRFValidationError({"credit_sale": "Sale does not belong to this business."})

        # Save payment (which also updates sale in atomic transaction)
        serializer.save(business=profile)

    @action(detail=False, methods=["get"])
    def by_sale(self, request):
        """Get all payments for a specific credit sale."""
        sale_id = request.query_params.get("sale")
        if not sale_id:
            raise DRFValidationError({"sale": "Sale ID is required."})

        profile = self._get_business()
        try:
            sale = CreditSale.objects.get(id=sale_id, business=profile)
        except CreditSale.DoesNotExist:
            raise NotFound("Credit sale not found.")

        payments = Payment.objects.filter(credit_sale=sale).order_by("-payment_date")
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def by_customer(self, request):
        """Get all payments from a specific customer."""
        customer_id = request.query_params.get("customer")
        if not customer_id:
            raise DRFValidationError({"customer": "Customer ID is required."})

        profile = self._get_business()
        try:
            customer = Customer.objects.get(id=customer_id, business=profile)
        except Customer.DoesNotExist:
            raise NotFound("Customer not found.")

        payments = Payment.objects.filter(customer=customer).order_by("-payment_date")
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Get payment summary statistics."""
        profile = self._get_business()
        payments = Payment.objects.filter(business=profile)

        total_collected = payments.aggregate(total=Sum("amount"))["total"] or 0
        payment_count = payments.count()

        # Group by payment method
        by_method = payments.values("payment_method").annotate(
            total=Sum("amount"), count=Count("id")
        ).order_by("-total")

        return Response({
            "total_collected": total_collected,
            "payment_count": payment_count,
            "by_method": by_method,
        })


class TotalOutstandingView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessUser]

    def get(self, request):
        profile = get_business_profile_for_user(request.user)
        customers = Customer.objects.filter(business=profile)

        credit = Transaction.objects.filter(
            customer__in=customers,
            transaction_type="CREDIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        debit = Transaction.objects.filter(
            customer__in=customers,
            transaction_type="DEBIT"
        ).aggregate(total=Sum("amount"))["total"] or 0

        return Response({
            "total_credit": credit,
            "total_debit": debit,
            "total_outstanding": credit - debit,
        })
class TopDebtorsView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessUser]

    def get(self, request):
        profile = get_business_profile_for_user(request.user)
        customers = Customer.objects.filter(business=profile)

        data = []

        for customer in customers:
            credit = customer.transactions.filter(
                transaction_type="CREDIT"
            ).aggregate(total=Sum("amount"))["total"] or 0

            debit = customer.transactions.filter(
                transaction_type="DEBIT"
            ).aggregate(total=Sum("amount"))["total"] or 0

            balance = credit - debit

            if balance > 0:
                data.append({
                    "customer_id": customer.id,
                    "customer_name": customer.name,
                    "balance": balance,
                })

        data.sort(key=lambda x: x["balance"], reverse=True)

        return Response(data[:5])
class MonthlySummaryView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessUser]

    def get(self, request):
        profile = get_business_profile_for_user(request.user)
        qs = Transaction.objects.filter(customer__business=profile).annotate(
            month=TruncMonth("created_at")
        ).values("month", "transaction_type").annotate(
            total=Sum("amount")
        ).order_by("month")

        return Response(qs)


class BusinessDashboardView(APIView):
    """Dashboard analytics for business overview."""
    permission_classes = [IsAuthenticated, IsBusinessUser]

    def get(self, request):
        profile = get_business_profile_for_user(request.user)
        profile_incomplete = not all(
            [
                profile.business_name,
                profile.owner_name,
                profile.phone,
                profile.email,
                profile.address,
                profile.business_type,
                profile.pan_vat_number,
            ]
        )
        
        # Total sales
        total_sales = CreditSale.objects.filter(
            business=profile
        ).aggregate(total=Sum("total_amount"))["total"] or 0
        
        # Payments collected
        payments_collected = Payment.objects.filter(
            business=profile
        ).aggregate(total=Sum("amount"))["total"] or 0
        
        # Outstanding credit (amount still due)
        outstanding_credit = CreditSale.objects.filter(
            business=profile
        ).aggregate(total=Sum("amount_due"))["total"] or 0
        
        # Total customers
        total_customers = Customer.objects.filter(
            business=profile
        ).count()
        
        # Recent credit sales (last 5)
        recent_sales = CreditSale.objects.filter(
            business=profile
        ).select_related("customer").order_by("-created_at")[:5]
        
        recent_sales_data = [
            {
                "id": sale.id,
                "invoice_number": sale.invoice_number,
                "customer_name": sale.customer.name,
                "total_amount": float(sale.total_amount),
                "amount_due": float(sale.amount_due),
                "status": sale.status,
                "created_at": sale.created_at.isoformat(),
            }
            for sale in recent_sales
        ]
        
        # Recent payments (last 5)
        recent_payments = Payment.objects.filter(
            business=profile
        ).select_related("customer", "credit_sale").order_by("-payment_date")[:5]
        
        recent_payments_data = [
            {
                "id": payment.id,
                "customer_name": payment.customer.name,
                "amount": float(payment.amount),
                "payment_method": payment.get_payment_method_display(),
                "invoice_number": payment.credit_sale.invoice_number if payment.credit_sale else "N/A",
                "payment_date": payment.payment_date.isoformat(),
            }
            for payment in recent_payments
        ]
        
        # Sales by status
        pending_count = CreditSale.objects.filter(
            business=profile,
            status=CreditSale.PENDING
        ).count()
        partial_count = CreditSale.objects.filter(
            business=profile,
            status=CreditSale.PARTIAL
        ).count()
        paid_count = CreditSale.objects.filter(
            business=profile,
            status=CreditSale.PAID
        ).count()
        
        return Response({
            "metrics": {
                "total_sales": float(total_sales),
                "outstanding_credit": float(outstanding_credit),
                "payments_collected": float(payments_collected),
                "total_customers": total_customers,
            },
            "sales_by_status": {
                "pending": pending_count,
                "partial": partial_count,
                "paid": paid_count,
            },
            "recent_credit_sales": recent_sales_data,
            "recent_payments": recent_payments_data,
            "message": "Complete your business profile to unlock invoices and richer business details." if profile_incomplete else "",
        })
