// Shared helpers for working with product variants (size + color level stock).
//
// Product shape (matches server/models/Product.js):
//   {
//     _id, name, ..., sizes: ['S','M','L'], colors: ['Black','Red'],
//     variants: [{ size: 'S', color: 'Black', stock: 5 }, ...],
//     lowStockThreshold: 5,
//   }
//
// `sizes` / `colors` stay on the product for fast filtering (feature 6) —
// `variants` is the source of truth for stock. Keeping both in sync is the
// admin form's job (see admin/AdminProductForm.jsx).

export const DEFAULT_LOW_STOCK_THRESHOLD = 5

/** Find the variant record for a given size/color combo. */
export function findVariant(product, size, color) {
  if (!product?.variants) return null
  return product.variants.find((v) => v.size === size && v.color === color) || null
}

/** Stock for one specific size/color combo (0 if the combo doesn't exist). */
export function getVariantStock(product, size, color) {
  return findVariant(product, size, color)?.stock ?? 0
}

/** Whether a specific size/color combo can currently be purchased. */
export function isVariantAvailable(product, size, color, qty = 1) {
  return getVariantStock(product, size, color) >= qty
}

/** Total stock across every variant — used for card badges & sort/filter. */
export function getTotalStock(product) {
  if (!product?.variants?.length) return 0
  return product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
}

/** Colors that still have stock for a given size (used to grey out combos). */
export function getAvailableColorsForSize(product, size) {
  if (!product?.variants) return []
  return product.variants.filter((v) => v.size === size && v.stock > 0).map((v) => v.color)
}

/** Sizes that still have stock for a given color. */
export function getAvailableSizesForColor(product, color) {
  if (!product?.variants) return []
  return product.variants.filter((v) => v.color === color && v.stock > 0).map((v) => v.size)
}

/** 'out' | 'low' | 'in' — drives badges everywhere stock is shown. */
export function getStockStatus(stock, threshold = DEFAULT_LOW_STOCK_THRESHOLD) {
  if (stock <= 0) return 'out'
  if (stock <= threshold) return 'low'
  return 'in'
}

export function stockStatusLabel(stock, threshold = DEFAULT_LOW_STOCK_THRESHOLD) {
  const status = getStockStatus(stock, threshold)
  if (status === 'out') return 'Out of Stock'
  if (status === 'low') return `Low Stock — only ${stock} left`
  return `${stock} in stock`
}

/** Build an empty size x color variant grid (used by the admin form). */
export function buildVariantGrid(sizes = [], colors = [], existing = []) {
  const grid = []
  for (const size of sizes) {
    for (const color of colors) {
      const found = existing.find((v) => v.size === size && v.color === color)
      grid.push({ size, color, stock: found ? Number(found.stock) || 0 : 0 })
    }
  }
  return grid
}
