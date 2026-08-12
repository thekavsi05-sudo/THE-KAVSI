import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { getTotalStock, getStockStatus } from '../utils/variants'

export default function ProductCard({ product }) {
  const hasDiscount = product.discount > 0
  const finalPrice = Math.round(product.price * (1 - (product.discount || 0) / 100))
  const totalStock = getTotalStock(product)
  const stockStatus = getStockStatus(totalStock, product.lowStockThreshold)
  const outOfStock = stockStatus === 'out'

  return (
    <Link to={`/product/${product._id}`} className="group block">
      <div className="relative overflow-hidden bg-blush/40 aspect-[4/5]">
        <img
          src={product.images?.[0]}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {product.images?.[1] && (
          <img
            src={product.images[1]}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          />
        )}
        {hasDiscount && (
          <span className="absolute top-3 left-3 bg-wine text-ivory text-[11px] font-semibold tracking-wide px-2 py-1">
            {product.discount}% OFF
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 bg-ink/50 flex items-center justify-center text-ivory text-xs tracking-widest2 uppercase">
            Out of Stock
          </span>
        )}
        {!outOfStock && stockStatus === 'low' && (
          <span className="absolute top-3 right-3 bg-champagne text-ink text-[10px] font-semibold tracking-wide px-2 py-1">
            Low Stock
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-stone">{product.category}</p>
        <h3 className="text-sm font-medium text-ink group-hover:text-wine transition-colors line-clamp-1">
          {product.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">₹{finalPrice.toLocaleString('en-IN')}</span>
          {hasDiscount && (
            <span className="text-xs text-stone line-through">₹{product.price.toLocaleString('en-IN')}</span>
          )}
        </div>
        {product.rating && (
          <div className="flex items-center gap-1 text-xs text-stone">
            <Star size={12} className="fill-champagne text-champagne" />
            {product.rating}
          </div>
        )}
      </div>
    </Link>
  )
}
