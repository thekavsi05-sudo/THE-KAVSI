// Static site copy only — NOT product data. All catalog/order data now comes
// from the Express + MongoDB backend in /server via src/services/api.js.
// Category labels here are just the admin form's default preset; manage the
// live list from Admin → Categories (GET/POST /api/admin/categories).

export const categories = ['Kurtis', 'Sarees', 'Dresses', 'Tops', 'Co-ord Sets', 'Ethnic Wear']
export const LOW_STOCK_THRESHOLD = 5

// mockProducts / mockOrders removed — the Shop, Product Details, Cart,
// Checkout, and Admin panel all read/write live data via src/services/api.js
// against the Express + MongoDB backend in /server now. Only static site
// copy (category labels, homepage testimonials) still lives here.

export const testimonials = [
  { name: 'Sneha K.', text: 'The kurti fit better than anything I have bought off a rack — fabric feels genuinely premium.', rating: 5 },
  { name: 'Divya R.', text: 'Delivery was quick and the courier called ahead — no back-and-forth needed to find the address.', rating: 5 },
  { name: 'Fatima S.', text: 'The Anarkali was worth every rupee. Zari work looked exactly like the photos.', rating: 4.5 },
]
