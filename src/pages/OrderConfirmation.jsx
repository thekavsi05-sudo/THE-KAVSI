import { useLocation, useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CheckCircle2, Download, PackageSearch } from 'lucide-react'
import { generateInvoicePDF } from '../utils/invoice'
import { trackOrder } from '../services/api'

// Bug 7: React Router `state` (the fast path, set right after checkout)
// disappears on a hard refresh. This page now keys off the orderId in the
// URL and falls back to re-fetching the order via the same orderId+phone
// lookup TrackOrder already uses, using the phone number Checkout stashed
// in sessionStorage — so a refresh (or a bookmark/share of this exact URL,
// on the same device/session) still shows the real order instead of
// bouncing to home.
export default function OrderConfirmation() {
  const { orderId } = useParams()
  const { state } = useLocation()
  const stateOrder = state?.order

  const [order, setOrder] = useState(stateOrder && stateOrder.orderId === orderId ? stateOrder : null)
  const [loading, setLoading] = useState(!order)
  const [notFound, setNotFound] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (order) return // already have it from navigation state — no need to re-fetch
    const phone = sessionStorage.getItem('kavsi_last_order_phone')
    if (!orderId || !phone) {
      setLoading(false)
      setNotFound(true)
      return
    }
    let cancelled = false
    trackOrder(orderId, phone)
      .then((data) => {
        if (!cancelled) setOrder(data)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  async function handleDownload() {
    setDownloading(true)
    try {
      await generateInvoicePDF(order)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-5 md:px-8 py-20 text-center text-stone">
        Loading your order…
      </div>
    )
  }

  if (!order || notFound) {
    return (
      <div className="max-w-2xl mx-auto px-5 md:px-8 py-20 text-center">
        <PackageSearch className="mx-auto text-stone" size={44} />
        <h1 className="font-display text-2xl mt-6">We couldn't pull up that order here</h1>
        <p className="text-stone mt-2">
          This can happen if the confirmation link is opened on a different device, or the session expired.
          You can still look it up with your Order ID and phone number.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <Link to="/track-order" className="btn-primary">Track Your Order</Link>
          <Link to="/shop" className="btn-outline">Continue Shopping</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-20 text-center">
      <CheckCircle2 className="mx-auto text-wine" size={52} />
      <h1 className="font-display text-3xl mt-6">Order Placed</h1>
      <p className="text-stone mt-2">
        Thank you{order.customerName ? `, ${order.customerName}` : ''}. Your order has been received and is being prepared.
      </p>

      <div className="border border-ink/10 mt-8 p-6 text-left">
        <div className="flex justify-between text-sm mb-3">
          <span className="text-stone">Order ID</span>
          <span className="font-semibold">{order.orderId}</span>
        </div>
        <div className="flex justify-between text-sm mb-3">
          <span className="text-stone">Payment Method</span>
          <span>{order.paymentMethod}</span>
        </div>
        <div className="flex justify-between text-sm mb-3">
          <span className="text-stone">Status</span>
          <span className="text-wine font-medium">{order.orderStatus}</span>
        </div>
        <div className="border-t border-ink/10 pt-3 mt-3 space-y-2">
          {order.products.map((p, i) => (
            <div key={i} className="flex justify-between text-xs text-ink/70">
              <span>{p.name} × {p.quantity}</span>
              <span>₹{(p.price * p.quantity).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-base font-semibold border-t border-ink/10 pt-3 mt-3">
          <span>Total</span>
          <span>₹{order.totalAmount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
        <Link to="/shop" className="btn-primary">Continue Shopping</Link>
        <Link to="/track-order" className="btn-outline">Track This Order</Link>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="btn-outline inline-flex items-center gap-2"
        >
          <Download size={15} /> {downloading ? 'Preparing…' : 'Download Invoice'}
        </button>
      </div>
    </div>
  )
}
