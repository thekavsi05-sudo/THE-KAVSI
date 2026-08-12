import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Star, Minus, Plus, ShieldCheck, Truck, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchProductById, checkVariantStock } from '../services/api'
import { useCart } from '../context/CartContext'
import {
  findVariant,
  getVariantStock,
  getTotalStock,
  getStockStatus,
  getAvailableColorsForSize,
  getAvailableSizesForColor,
  stockStatusLabel,
} from '../utils/variants'

export default function ProductDetails() {
  const { id } = useParams()
  const { addToCart } = useCart()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [zoom, setZoom] = useState(false)
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchProductById(id).then((data) => {
      setProduct(data)
      // Pre-select the first size/color combo that's actually in stock, so the
      // customer isn't dropped onto a sold-out combination by default.
      const firstInStock = data?.variants?.find((v) => v.stock > 0)
      setSize(firstInStock?.size || data?.sizes?.[0] || '')
      setColor(firstInStock?.color || data?.colors?.[0] || '')
      setQuantity(1)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return <div className="max-w-7xl mx-auto px-5 md:px-8 py-24 text-center text-stone">Loading…</div>
  }
  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-24 text-center">
        <p className="text-stone">Product not found.</p>
        <Link to="/shop" className="btn-ghost mt-3 inline-flex">Back to Shop</Link>
      </div>
    )
  }

  const finalPrice = Math.round(product.price * (1 - (product.discount || 0) / 100))
  const totalStock = getTotalStock(product)
  const productOutOfStock = totalStock === 0

  const variant = findVariant(product, size, color)
  const variantStock = getVariantStock(product, size, color)
  const variantChosen = Boolean(size && color)
  const variantOutOfStock = variantChosen && !variant
  const variantSoldOut = variantChosen && Boolean(variant) && variantStock === 0
  const canAddToCart = variantChosen && variantStock > 0 && !adding

  // Grey out size/color combos that don't exist or are sold out, without
  // hiding them — customers should still see the option existed.
  const colorsInStockForSize = getAvailableColorsForSize(product, size)
  const sizesInStockForColor = getAvailableSizesForColor(product, color)

  function handleSelectSize(s) {
    setSize(s)
    setQuantity(1)
  }

  function handleSelectColor(c) {
    setColor(c)
    setQuantity(1)
  }

  async function handleAddToCart() {
    if (!canAddToCart) return
    setAdding(true)
    try {
      // Re-validate against live stock right before adding — the product was
      // fetched on page load and could be stale if someone else just bought
      // the last one. Final authority is always the backend at checkout time,
      // but this catches the common case early with a clear message.
      const { available, stock } = await checkVariantStock(product._id, size, color)
      if (!available) {
        toast.error(stock === 0 ? `${color} / ${size} just sold out` : `Only ${stock} left in ${color} / ${size}`)
        return
      }
      const qtyToAdd = Math.min(quantity, stock)
      addToCart(product, { size, color, quantity: qtyToAdd })
    } catch {
      toast.error('Could not verify stock — please try again')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
        {/* Gallery */}
        <div>
          <div
            className="relative aspect-[4/5] bg-blush/40 overflow-hidden cursor-zoom-in"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              setZoomPos({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
              })
            }}
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
          >
            <img
              src={product.images[activeImage]}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-200"
              style={
                zoom
                  ? { transform: 'scale(1.8)', transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }
                  : {}
              }
            />
          </div>
          <div className="flex gap-3 mt-3">
            {product.images.map((img, i) => (
              <button
                key={img}
                onClick={() => setActiveImage(i)}
                className={`w-16 h-20 overflow-hidden border ${i === activeImage ? 'border-wine' : 'border-transparent'}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div>
          <p className="text-xs uppercase tracking-wide text-stone">{product.category}</p>
          <h1 className="font-display text-3xl mt-1">{product.name}</h1>
          {product.rating && (
            <div className="flex items-center gap-1 text-sm text-stone mt-2">
              <Star size={14} className="fill-champagne text-champagne" /> {product.rating} rating
            </div>
          )}

          <div className="flex items-center gap-3 mt-4">
            <span className="text-2xl font-semibold">₹{finalPrice.toLocaleString('en-IN')}</span>
            {product.discount > 0 && (
              <>
                <span className="text-base text-stone line-through">₹{product.price.toLocaleString('en-IN')}</span>
                <span className="text-sm text-wine font-semibold">{product.discount}% off</span>
              </>
            )}
          </div>

          <p className="text-sm text-ink/70 leading-relaxed mt-5">{product.description}</p>

          {/* Size */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2">
              Size {size && <span className="text-stone font-normal normal-case">— {size}</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => {
                const available = sizesInStockForColor.includes(s)
                return (
                  <button
                    key={s}
                    onClick={() => handleSelectSize(s)}
                    title={!available ? `${s} unavailable in ${color}` : undefined}
                    className={`relative min-w-[44px] px-3 py-2 text-xs border transition-colors ${
                      size === s
                        ? 'bg-ink text-ivory border-ink'
                        : available
                        ? 'border-ink/20 hover:border-ink'
                        : 'border-ink/10 text-ink/30 line-through'
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Color */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2">
              Color {color && <span className="text-stone font-normal normal-case">— {color}</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => {
                const available = colorsInStockForSize.includes(c)
                return (
                <button
                  key={c}
                  onClick={() => handleSelectColor(c)}
                  title={!available ? `${c} unavailable in size ${size}` : undefined}
                  className={`px-3 py-2 text-xs border transition-colors ${
                    color === c
                      ? 'bg-ink text-ivory border-ink'
                      : available
                      ? 'border-ink/20 hover:border-ink'
                      : 'border-ink/10 text-ink/30 line-through'
                  }`}
                >
                  {c}
                </button>
                )
              })}
            </div>
          </div>

          {/* Quantity */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2">Quantity</p>
            <div className="flex items-center border border-ink/20 w-fit">
              <button
                className="p-3 disabled:opacity-30"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={!canAddToCart}
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="px-4 text-sm w-10 text-center">{quantity}</span>
              <button
                className="p-3 disabled:opacity-30"
                onClick={() => setQuantity((q) => Math.min(variantStock, q + 1))}
                disabled={!canAddToCart}
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
            <p className={`text-xs mt-2 flex items-center gap-1.5 ${variantSoldOut ? 'text-wine' : getStockStatus(variantStock, product.lowStockThreshold) === 'low' ? 'text-wine-light' : 'text-stone'}`}>
              {(variantSoldOut || variantOutOfStock) && <AlertCircle size={13} />}
              {!variantChosen
                ? 'Select a size and color'
                : variantOutOfStock || variantSoldOut
                ? `${color} / ${size} is currently out of stock`
                : stockStatusLabel(variantStock, product.lowStockThreshold)}
            </p>
          </div>

          <button onClick={handleAddToCart} disabled={!canAddToCart} className="btn-primary w-full mt-8">
            {adding ? 'Checking stock…' : !variantChosen ? 'Select Size & Color' : variantOutOfStock || variantSoldOut ? 'Out of Stock' : 'Add to Cart'}
          </button>
          {productOutOfStock && (
            <p className="text-xs text-wine mt-2 text-center">This product is currently out of stock in all sizes and colors.</p>
          )}

          <div className="grid grid-cols-2 gap-3 mt-6 text-xs text-stone">
            <div className="flex items-center gap-2"><Truck size={16} className="text-wine" /> Delivered in 3–5 days</div>
            <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-wine" /> Quality checked</div>
          </div>
        </div>
      </div>
    </div>
  )
}
