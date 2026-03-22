"""Invoice PDF generation service for credit sales."""

import os
from decimal import Decimal
from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from django.conf import settings


def format_currency(amount):
    """Format decimal amount as Indian currency."""
    return f"₹ {float(amount):,.2f}"


def generate_invoice_pdf(credit_sale):
    """
    Generate a PDF invoice for a credit sale.
    
    Args:
        credit_sale: CreditSale model instance
    
    Returns:
        BytesIO object containing the PDF data
    """
    # Create a BytesIO object to hold the PDF
    pdf_buffer = BytesIO()
    
    # Create PDF document
    doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=A4,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.75*inch,
        bottomMargin=0.5*inch,
    )
    
    # Get styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a202c'),
        spaceAfter=6,
        fontName='Helvetica-Bold',
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#2d3748'),
        spaceAfter=6,
        fontName='Helvetica-Bold',
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#2d3748'),
        spaceAfter=4,
    )
    
    # Container for PDF elements
    story = []
    
    # Header: Business Name and Invoice Title
    story.append(Paragraph(credit_sale.business.business_name, title_style))
    story.append(Spacer(1, 0.15*inch))
    
    # Invoice details section
    invoice_data = [
        ['INVOICE', f'Invoice #: {credit_sale.invoice_number}'],
        ['', f'Date: {credit_sale.created_at.strftime("%d-%b-%Y")}'],
        ['', f'Due Date: {credit_sale.due_date.strftime("%d-%b-%Y") if credit_sale.due_date else "On Demand"}'],
    ]
    
    invoice_table = Table(invoice_data, colWidths=[3*inch, 2*inch])
    invoice_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 14),
        ('FONTSIZE', (1, 0), (1, -1), 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2d3748')),
    ]))
    story.append(invoice_table)
    story.append(Spacer(1, 0.2*inch))
    
    # Business and Customer details
    details_data = [
        ['BUSINESS DETAILS', 'CUSTOMER DETAILS'],
        [
            f'{credit_sale.business.business_name}\n'
            f'Phone: {credit_sale.business.phone or "N/A"}\n'
            f'Address: {credit_sale.business.address or "N/A"}',
            f'{credit_sale.customer.name}\n'
            f'Phone: {credit_sale.customer.phone or "N/A"}\n'
            f'Address: {credit_sale.customer.address or "N/A"}'
        ],
    ]
    
    details_table = Table(details_data, colWidths=[3*inch, 3*inch])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#edf2f7')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#2d3748')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 0.2*inch))
    
    # Items table
    story.append(Paragraph('ITEMS', heading_style))
    
    items_data = [
        ['Product', 'Quantity', 'Unit Price', 'Amount'],
    ]
    
    for item in credit_sale.items.all():
        items_data.append([
            item.product.name,
            f'{item.quantity} {item.product.unit or ""}',
            format_currency(item.unit_price),
            format_currency(item.subtotal),
        ])
    
    items_table = Table(items_data, colWidths=[2.5*inch, 1.2*inch, 1.2*inch, 1.2*inch])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#edf2f7')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#2d3748')),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.lightgrey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 0.2*inch))
    
    # Summary section
    summary_data = [
        ['', 'Total Amount:', format_currency(credit_sale.total_amount)],
        ['', 'Amount Paid:', format_currency(credit_sale.amount_paid)],
        ['', 'Amount Due:', format_currency(credit_sale.amount_due)],
    ]
    
    summary_table = Table(summary_data, colWidths=[2.5*inch, 1.2*inch, 1.2*inch])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (1, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (1, 0), (-1, -1), 1, colors.lightgrey),
        ('BACKGROUND', (1, -1), (-1, -1), colors.HexColor('#edf2f7')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.2*inch))
    
    # Status and Notes
    status_colors = {
        'PENDING': colors.HexColor('#f59e0b'),
        'PARTIAL': colors.HexColor('#3b82f6'),
        'PAID': colors.HexColor('#10b981'),
    }
    
    status_badge = f'<b>Status:</b> <font color="{status_colors.get(credit_sale.status, colors.HexColor("#6b7280")).hexval()}">{credit_sale.get_status_display()}</font>'
    story.append(Paragraph(status_badge, normal_style))
    
    if credit_sale.notes:
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph('<b>Notes:</b>', normal_style))
        story.append(Paragraph(credit_sale.notes, normal_style))
    
    story.append(Spacer(1, 0.3*inch))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#a0aec0'),
        alignment=TA_CENTER,
    )
    story.append(Paragraph(
        f'Generated on {datetime.now().strftime("%d-%b-%Y at %H:%M")} | UdharoGuru Business Dashboard',
        footer_style,
    ))
    
    # Build PDF
    doc.build(story)
    
    # Reset buffer position to beginning
    pdf_buffer.seek(0)
    
    return pdf_buffer


def save_invoice_pdf(credit_sale, pdf_buffer):
    """
    Save invoice PDF to file system.
    
    Args:
        credit_sale: CreditSale model instance
        pdf_buffer: BytesIO object with PDF data
    
    Returns:
        Path to saved PDF file
    """
    # Create media/invoices directory if it doesn't exist
    invoices_dir = os.path.join(settings.MEDIA_ROOT, 'invoices')
    os.makedirs(invoices_dir, exist_ok=True)
    
    # Generate filename
    filename = f'{credit_sale.invoice_number.replace("/", "-")}-{credit_sale.created_at.strftime("%Y%m%d")}.pdf'
    filepath = os.path.join(invoices_dir, filename)
    
    # Save PDF
    with open(filepath, 'wb') as f:
        f.write(pdf_buffer.getvalue())
    
    return filepath
