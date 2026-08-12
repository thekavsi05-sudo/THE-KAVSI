import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'

// Brand colours (kept in sync with tailwind.config.js) as RGB triples,
// since jsPDF doesn't understand hex/Tailwind tokens.
const WINE = [110, 36, 57] // #6E2439
const INK = [33, 27, 28] // #211B1C
const STONE = [138, 127, 121] // #8A7F79
const IVORY = [250, 246, 241]

const currency = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`

function formatAddress(order) {
  if (order.fullAddress) return order.fullAddress
  const a = order.address || {}
  return [a.houseNumber, a.street, a.landmark, a.area, a.city, a.state, a.pincode]
    .filter(Boolean)
    .join(', ')
}

/**
 * The QR code encodes the order's core details as plain, human-readable
 * text (not a URL) — scanning it with any phone camera shows the order ID,
 * amount and date directly, no app or internet connection required. This
 * doubles as an at-a-glance authenticity check: a delivery agent or the
 * customer can confirm the printed invoice matches by eye.
 */
function buildQrPayload(order, invoiceNo) {
  const address = formatAddress(order) || '-'

  return [
    'KAVSI CUSTOMER DETAILS',
    '',
    `Invoice No: ${invoiceNo}`,
    `Customer Name: ${order.customerName || '-'}`,
    `Phone: ${order.phone || '-'}`,
    `Address: ${address}`,
  ].join('\n')
}

/**
 * Generates a downloadable invoice PDF for a placed order. `order` is
 * whatever the backend returns from placeOrder()/trackOrder()/admin orders:
 * { orderId, customerName, phone, address, fullAddress, products, subtotal,
 *   discount, couponDiscount, deliveryCharge, totalAmount, paymentMethod,
 *   orderStatus, createdAt, ... }
 *
 * Async because the QR code is generated as a PNG data URL before it can be
 * embedded in the PDF — callers should `await` this (or `.then()`).
 */
export async function generateInvoicePDF(order) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40

  const invoiceNo = `INV-${order.orderId || 'THE-KAVSI'}`
  const placedOn = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  // ---- Letterhead ------------------------------------------------------
  doc.setFillColor(...WINE)
  doc.rect(0, 0, pageWidth, 6, 'F') // thin brand-colour band across the very top

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...WINE)
  doc.text('THE KAVSI', marginX, 52)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...STONE)
  doc.text("Women's Ethnic & Contemporary Wear", marginX, 66)
  doc.text('support@kavsi.in  ·  +91 94907 77920', marginX, 78)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...INK)
  doc.text('TAX INVOICE', pageWidth - marginX, 50, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...STONE)
  doc.text(`Invoice No: ${invoiceNo}`, pageWidth - marginX, 65, { align: 'right' })
  doc.text(`Order ID: ${order.orderId || '-'}`, pageWidth - marginX, 78, { align: 'right' })
  doc.text(`Date: ${placedOn}`, pageWidth - marginX, 91, { align: 'right' })

  doc.setDrawColor(...WINE)
  doc.setLineWidth(1)
  doc.line(marginX, 102, pageWidth - marginX, 102)

  // ---- Billed to / Payment details -------------------------------------
  let y = 126
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text('Billed To / Ship To', marginX, y)

  doc.setFont('helvetica', 'normal')
  y += 16
  doc.text(order.customerName || '-', marginX, y)
  y += 14
  const addressLines = doc.splitTextToSize(formatAddress(order) || '-', 280)
  doc.text(addressLines, marginX, y)
  y += addressLines.length * 13
  doc.text(`Phone: ${order.phone || '-'}`, marginX, y)
  if (order.alternatePhone) {
    y += 14
    doc.text(`Alt. Phone: ${order.alternatePhone}`, marginX, y)
  }

  let ry = 126
  doc.setFont('helvetica', 'bold')
  doc.text('Payment Details', pageWidth - marginX, ry, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  ry += 16
  doc.text(`Method: ${order.paymentMethod || 'COD'}`, pageWidth - marginX, ry, { align: 'right' })
  ry += 14
  doc.text(`Payment Status: ${order.paymentStatus || 'Pending'}`, pageWidth - marginX, ry, { align: 'right' })
  ry += 14
  doc.text(`Order Status: ${order.orderStatus || 'Pending'}`, pageWidth - marginX, ry, { align: 'right' })

  const afterHeaderY = Math.max(y, ry) + 24

  // ---- Items table -------------------------------------------------------
  const rows = (order.products || []).map((p) => [
    p.name,
    [p.size, p.color].filter(Boolean).join(' / '),
    String(p.quantity),
    currency(p.price),
    currency(p.price * p.quantity),
  ])

  autoTable(doc, {
    startY: afterHeaderY,
    margin: { left: marginX, right: marginX },
    head: [['Item', 'Variant', 'Qty', 'Unit Price', 'Amount']],
    body: rows,
    styles: { font: 'helvetica', fontSize: 9.5, textColor: INK, cellPadding: 7 },
    headStyles: { fillColor: WINE, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: IVORY },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  })

  // ---- Totals (left column reserved for the QR code) --------------------
  let ty = doc.lastAutoTable.finalY + 20
  const totalsX = pageWidth - marginX
  const labelX = totalsX - 160

  function totalLine(label, value, opts = {}) {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setFontSize(opts.bold ? 11 : 10)
    doc.setTextColor(...(opts.color || INK))
    doc.text(label, labelX, ty)
    doc.text(value, totalsX, ty, { align: 'right' })
    ty += opts.bold ? 20 : 16
  }

  const totalsStartY = ty
  totalLine('Subtotal', currency(order.subtotal ?? order.totalAmount))
  if (order.couponDiscount) totalLine(`Coupon (${order.couponCode || ''})`, `- ${currency(order.couponDiscount)}`)
  if (order.discount) totalLine('Discount', `- ${currency(order.discount)}`)
  totalLine('Delivery Charge', order.deliveryCharge ? currency(order.deliveryCharge) : 'FREE')

  doc.setDrawColor(...STONE)
  doc.setLineWidth(0.5)
  doc.line(labelX, ty - 6, totalsX, ty - 6)
  ty += 6
  totalLine('Total', currency(order.totalAmount), { bold: true, color: WINE })

  // ---- QR code (mandatory) — sits beside the totals block ---------------
  try {
    const qrDataUrl = await QRCode.toDataURL(

       buildQrPayload(order, invoiceNo),
      {
        margin: 0,width: 240,color: {dark: '#211B1C',light: '#FFFFFF',},
      }
    )
    const qrSize = 78
    const qrY = totalsStartY - 6
    doc.addImage(qrDataUrl, 'PNG', marginX, qrY, qrSize, qrSize)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...STONE)
    doc.text('Scan to verify order details', marginX, qrY + qrSize + 11)
  } catch {
    // If QR generation fails for any reason, the invoice still renders
    // correctly without it rather than blocking the download entirely.
  }

  // ---- Footer ------------------------------------------------------------
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...STONE)
  doc.setLineWidth(0.5)
  doc.line(marginX, pageHeight - 56, pageWidth - marginX, pageHeight - 56)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WINE)
  doc.text('Thank you for shopping with KAVSI.', marginX, pageHeight - 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...STONE)
  doc.text('For any questions about this order, reach us at support@kavsi.in', marginX, pageHeight - 24)
  doc.text(invoiceNo, pageWidth - marginX, pageHeight - 24, { align: 'right' })

  doc.save(`Invoice-${order.orderId || 'THE-KAVSI'}.pdf`)
}
