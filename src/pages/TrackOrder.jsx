import { useState } from 'react'
import { CheckCircle2, Circle, PackageSearch, Download, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { trackOrder as apiTrackOrder, cancelOrder as apiCancelOrder } from '../services/api'
import { generateInvoicePDF } from '../utils/invoice'

const STEPS = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered']
// Mirrors CANCELLABLE_STATUSES in server/controllers/orderController.js —
// kept here only to decide whether to show the button at all; the backend
// is the actual authority and re-checks status + the cancellation window
// itself, so this is a UX nicety, not the security boundary.
const CANCELLABLE_STATUSES = ['Pending', 'Confirmed', 'Packed']

export default function TrackOrder() {
  const [orderId, setOrderId] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  async function handleDownloadInvoice() {
    setDownloading(true)
    try {
      await generateInvoicePDF(order)
    } finally {
      setDownloading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setNotFound(false)
    setOrder(null)
    try {
      const data = await apiTrackOrder(orderId.trim(), phone.trim())
      setOrder(data)
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true)
      else toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return
    setCancelling(true)
    try {
      const updated = await apiCancelOrder(order.orderId, phone.trim())
      setOrder(updated)
      toast.success('Order cancelled')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not cancel this order. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  const activeIndex = order ? STEPS.indexOf(order.orderStatus) : -1
  const cancelled = order?.orderStatus === 'Cancelled'
  const canCancel = order && CANCELLABLE_STATUSES.includes(order.orderStatus)

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-16">
      <p className="eyebrow">Order Status</p>
      <h1 className="text-3xl mt-2 mb-8">Track Your Order</h1>

      <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4 border border-ink/10 p-6">
        <label className="block text-xs sm:col-span-1">
          <span className="font-medium text-ink/80">Order ID</span>
          <input
            required
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="KAVSI-2026-000001"
            className="input-field mt-1.5"
          />
        </label>
        <label className="block text-xs sm:col-span-1">
          <span className="font-medium text-ink/80">Mobile Number</span>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit number used at checkout"
            className="input-field mt-1.5"
          />
        </label>
        <button type="submit" disabled={loading} className="btn-primary sm:col-span-2">
          {loading ? 'Searching…' : 'Track Order'}
        </button>
      </form>

      {notFound && (
        <p className="text-sm text-wine mt-6 text-center">
          No matching order found. Double-check your Order ID and the mobile number used at checkout.
        </p>
      )}

      {order && (
        <div className="border border-ink/10 mt-8 p-6">
          <div className="flex items-start justify-between mb-6 gap-4">
            <div>
              <p className="text-xs text-stone">Order ID</p>
              <p className="font-semibold">{order.orderId}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone">Placed On</p>
              <p className="text-sm">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={downloading}
            className="btn-outline w-full sm:w-auto inline-flex items-center justify-center gap-2 mb-6"
          >
            <Download size={15} /> {downloading ? 'Preparing…' : 'Download Invoice'}
          </button>

          {canCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="btn-outline w-full sm:w-auto inline-flex items-center justify-center gap-2 mb-6 sm:ml-3 text-wine border-wine/40"
            >
              <XCircle size={15} /> {cancelling ? 'Cancelling…' : 'Cancel Order'}
            </button>
          )}

          {cancelled ? (
            <p className="text-sm text-wine font-medium flex items-center gap-2">
              <PackageSearch size={16} /> This order was cancelled{order.cancellationReason ? `: ${order.cancellationReason}` : '.'}
            </p>
          ) : (
            <ol className="space-y-4">
              {STEPS.map((step, i) => {
                const done = i <= activeIndex
                return (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    {done ? <CheckCircle2 size={18} className="text-wine shrink-0" /> : <Circle size={18} className="text-ink/20 shrink-0" />}
                    <span className={done ? 'text-ink font-medium' : 'text-stone'}>{step}</span>
                  </li>
                )
              })}
            </ol>
          )}

          <div className="border-t border-ink/10 mt-6 pt-4 space-y-2">
            {order.products.map((p, i) => (
              <div key={i} className="flex justify-between text-xs text-ink/70">
                <span>{p.name} × {p.quantity} ({p.size}/{p.color})</span>
                <span>₹{(p.price * p.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="flex justify-between text-base font-semibold pt-2">
              <span>Total</span>
              <span>₹{order.totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
