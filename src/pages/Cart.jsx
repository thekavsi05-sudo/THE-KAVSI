import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, ArrowRight, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCart } from '../context/CartContext'
import { checkVariantStock } from '../services/api'

export default function Cart() {
  const { items, updateQuantity, removeFromCart, totalPrice } = useCart()
  const [checkingKey, setCheckingKey] = useState(null)
  const [unavailableKeys, setUnavailableKeys] = useState({})

  // Passive check so a "sold out" flag is visible on the bag itself, not just
  // sprung on the customer at the final checkout gate.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      items.map(async (item) => {
        const { stock } = await checkVariantStock(item.productId, item.size, item.color)
        return [item.key, stock < item.quantity ? stock : null]
      })
    ).then((pairs) => {
      if (cancelled) return
      const map = {}
      pairs.forEach(([key, stock]) => { if (stock !== null) map[key] = stock })
      setUnavailableKeys(map)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  // Re-validate against live variant stock before letting the quantity go up —
  // the item may have been added a while ago and stock can move underneath it.
  async function handleIncrease(item) {
    setCheckingKey(item.key)
    try {
      const { stock } = await checkVariantStock(item.productId, item.size, item.color)
      if (item.quantity + 1 > stock) {
        toast.error(stock === 0 ? 'This item just sold out' : `Only ${stock} available in ${item.color} / ${item.size}`)
        return
      }
      updateQuantity(item.key, item.quantity + 1)
    } finally {
      setCheckingKey(null)
    }
  }

  const hasStockIssues = Object.keys(unavailableKeys).length > 0

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-24 text-center">
        <p className="font-display text-2xl mb-3">Your bag is empty</p>
        <p className="text-stone mb-6">Looks like you haven&apos;t added anything yet.</p>
        <Link to="/shop" className="btn-primary">Continue Shopping</Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <h1 className="text-3xl mb-8">Shopping Bag</h1>
      <div className="grid md:grid-cols-[1fr_340px] gap-10">
        <div className="divide-y divide-ink/10">
          {items.map((item) => {
            const shortStock = unavailableKeys[item.key]
            const isOut = shortStock === 0
            return (
            <div key={item.key} className="flex gap-4 py-5">
              <img src={item.image} alt={item.name} className={`w-20 h-24 object-cover bg-blush/40 ${isOut ? 'opacity-40' : ''}`} />
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-stone mt-1">Size: {item.size} · Color: {item.color}</p>
                    {shortStock !== undefined && (
                      <p className="text-xs text-wine flex items-center gap-1 mt-1">
                        <AlertTriangle size={11} />
                        {isOut ? 'Out of stock' : `Only ${shortStock} left — reduce quantity`}
                      </p>
                    )}
                  </div>
                  <button onClick={() => removeFromCart(item.key)} aria-label="Remove item" className="text-stone hover:text-wine">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-ink/20">
                    <button className="p-2" onClick={() => updateQuantity(item.key, item.quantity - 1)} aria-label="Decrease quantity">
                      <Minus size={12} />
                    </button>
                    <span className="px-3 text-xs w-8 text-center">{item.quantity}</span>
                    <button
                      className="p-2 disabled:opacity-40"
                      onClick={() => handleIncrease(item)}
                      disabled={checkingKey === item.key}
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="text-sm font-semibold">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
            )
          })}
          <div className="pt-5">
            <Link to="/shop" className="btn-ghost px-0">← Continue Shopping</Link>
          </div>
        </div>

        <div className="border border-ink/10 p-6 h-fit">
          <h2 className="font-display text-lg mb-4">Order Summary</h2>
          {hasStockIssues && (
            <p className="text-xs text-wine flex items-center gap-1.5 mb-4 border border-wine/30 bg-wine/5 px-3 py-2">
              <AlertTriangle size={13} /> Some items need attention before checkout
            </p>
          )}
          <div className="flex justify-between text-sm text-ink/70 mb-2">
            <span>Subtotal</span>
            <span>₹{totalPrice.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm text-ink/70 mb-4">
            <span>Delivery</span>
            <span className="text-champagne font-medium">Free</span>
          </div>
          <div className="flex justify-between text-base font-semibold border-t border-ink/10 pt-4 mb-6">
            <span>Total</span>
            <span>₹{totalPrice.toLocaleString('en-IN')}</span>
          </div>
          <Link to="/checkout" className="btn-primary w-full">
            Proceed to Checkout <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
