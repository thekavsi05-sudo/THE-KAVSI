import axios from 'axios'


const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

// The Express + MongoDB backend in /server is now the source of truth for
// every read/write below. Set VITE_API_BASE_URL in .env if it's not running
// on localhost:5000, but there is no more mock-data branch to flip.
export const api = axios.create({ baseURL: BASE_URL })

// Attach the admin JWT (if present) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kavsi_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to /admin/login on 401s from protected admin endpoints.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && window.location.pathname.startsWith('/admin')) {
      localStorage.removeItem('kavsi_admin_token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(err)
  }
)

/* ---------------------------- Public: Products --------------------------- */

export async function fetchProducts(params = {}) {
  // Drop empty/undefined filter values so they don't show up as ?search=&category=
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  const { data } = await api.get('/products', { params: cleaned })
  return data.data
}

export async function fetchProductById(id) {
  const { data } = await api.get(`/products/${id}`)
  return data.data
}

/**
 * Re-check a single variant's live stock right before add-to-cart / checkout,
 * so a product page fetched minutes ago can't be used to order something
 * that sold out in the meantime.
 */
export async function checkVariantStock(productId, size, color) {
  const { data } = await api.get(`/products/${productId}/variant-stock`, { params: { size, color } })
  return { available: data.available, stock: data.stock }
}

export async function fetchProductReviews(productId) {
  const { data } = await api.get(`/products/${productId}/reviews`)
  return data.data
}

export async function submitReview(productId, review) {
  const { data } = await api.post(`/products/${productId}/reviews`, review)
  return data.data
}

/* ------------------------------- Public: Orders --------------------------- */

/**
 * This is the single most important integrity check in the app: the backend
 * re-validates every line item's variant stock and re-computes every price
 * against MongoDB, atomically, before creating the order. Never trust
 * whatever the React cart thinks the price or stock is — two tabs, two
 * customers, or a stale cached product page can all disagree with reality by
 * the time "Place Order" is clicked.
 */
export async function placeOrder(orderPayload) {
  const { data } = await api.post('/orders', orderPayload)
  return data.data
}


export async function calculateOrderTotal(products, couponCode, phone) {
  const { data } = await api.post('/orders/price', {
    products,
    couponCode,
    phone,
  })

  return data.data
}
/**
 * Asks the backend to open a Razorpay order for the current cart's
 * backend-computed total. Call this right before opening the Razorpay
 * Checkout widget; the returned razorpayOrderId is what the widget needs.
 */
export async function createRazorpayOrder(products, couponCode, phone) {
  const { data } = await api.post('/payments/razorpay/order', { products, couponCode, phone })
  return data.data // { razorpayOrderId, amount, currency, keyId, totalAmount }
}

export async function trackOrder(orderId, phone) {
  const { data } = await api.get('/orders/track', { params: { orderId, phone } })
  return data.data
}

export async function cancelOrder(orderId, phone, reason) {
  const { data } = await api.post(`/orders/${orderId}/cancel`, { phone, reason })
  return data.data
}

/* -------------------------------- Public: Misc ------------------------------ */

export async function fetchCategories() {
  const { data } = await api.get('/categories')
  return data.data
}

export async function validateCoupon(code, subtotal) {
  const { data } = await api.post('/coupons/validate', { code, subtotal })
  return data
}

export async function submitContactMessage(payload) {
  const { data } = await api.post('/contact', payload)
  return data
}

/* --------------------------------- Admin ----------------------------------- */

export async function adminLogin(username, password) {
  const { data } = await api.post('/auth/admin/login', { username, password })
  return data
}

export async function changeAdminPassword(
  currentPassword,
  newPassword
) {
  const { data } = await api.put(
    '/auth/admin/change-password',
    {
      currentPassword,
      newPassword,
    }
  )

  return data
}

export async function fetchAdminProducts(params = {}) {
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  const { data } = await api.get('/admin/products', { params: cleaned })
  return data // { success, data: products[], pagination }
}

// Admin-only single-product lookup that includes inactive/archived products
// (the public fetchProductById excludes them, so admins couldn't otherwise
// open an archived product to edit or reactivate it).
export async function fetchAdminProductById(id) {
  const { data } = await api.get(`/admin/products/${id}`)
  return data.data
}

export async function createProduct(product) {
  const { data } = await api.post('/admin/products', product)
  return data.data
}

export async function updateProduct(id, updates) {
  const { data } = await api.put(`/admin/products/${id}`, updates)
  return data.data
}

export async function deleteProduct(id) {
  await api.delete(`/admin/products/${id}`)
  return { success: true }
}

export async function bulkUpdateProducts(ids, action, extra = {}) {
  const { data } = await api.patch('/admin/products/bulk', { ids, action, ...extra })
  return data
}

/** Uploads image files straight to Cloudinary via the backend and returns
 * the resulting URLs to store on the product. `files` is a FileList/array
 * of File objects straight from an <input type="file multiple">. */
export async function uploadProductImages(files) {
  const formData = new FormData()
  Array.from(files).forEach((file) => formData.append('images', file))
  const { data } = await api.post('/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data // [{ url, publicId }]
}

export async function fetchAdminOrders(params = {}) {
  const { data } = await api.get('/admin/orders', { params })
  return data.data
}

export async function updateOrderStatus(id, orderStatus) {
  const { data } = await api.put(`/admin/orders/${id}/status`, { orderStatus })
  return data.data
}

export async function fetchDashboardStats() {
  const { data } = await api.get('/admin/dashboard')
  return data.data
}

export async function fetchAdminCategories() {
  const { data } = await api.get('/admin/categories')
  return data.data
}

export async function createCategory(payload) {
  const { data } = await api.post('/admin/categories', payload)
  return data.data
}

export async function updateCategory(id, payload) {
  const { data } = await api.put(`/admin/categories/${id}`, payload)
  return data.data
}

export async function deleteCategory(id) {
  const { data } = await api.delete(`/admin/categories/${id}`)
  return data
}

export async function createSubCategory(
  categoryId,
  payload
) {
  const { data } = await api.post(
    `/admin/categories/${categoryId}/subcategories`,
    payload
  )

  return data.data
}

export async function updateSubCategory(
  categoryId,
  subCategoryId,
  payload
) {
  const { data } = await api.put(
    `/admin/categories/${categoryId}/subcategories/${subCategoryId}`,
    payload
  )

  return data.data
}

export async function deleteSubCategory(
  categoryId,
  subCategoryId
) {
  const { data } = await api.delete(
    `/admin/categories/${categoryId}/subcategories/${subCategoryId}`
  )

  return data
}

export async function fetchAdminCoupons() {
  const { data } = await api.get('/admin/coupons')
  return data.data
}

export async function createCoupon(payload) {
  const { data } = await api.post('/admin/coupons', payload)
  return data.data
}

export async function updateCoupon(id, payload) {
  const { data } = await api.put(`/admin/coupons/${id}`, payload)
  return data.data
}

export async function deleteCoupon(id) {
  await api.delete(`/admin/coupons/${id}`)
  return { success: true }
}

export async function fetchAdminMessages() {
  const { data } = await api.get('/admin/contact-messages')
  return data.data
}

export async function markMessageRead(id, isRead) {
  const { data } = await api.put(`/admin/contact-messages/${id}`, { isRead })
  return data.data
}

export async function deleteAdminMessage(id) {
  await api.delete(`/admin/contact-messages/${id}`)

  return {
    success: true,
  }
}

export async function fetchSalesChart(
  range = 'daily',
  days = 30
) {
  const { data } = await api.get(
    '/admin/dashboard/sales',
    {
      params: {
        range,
        days,
      },
    }
  )

  return data.data
}
export async function fetchBestSellers() {
  const { data } = await api.get(
    '/admin/dashboard/best-sellers'
  )

  return data.data
}

export async function exportProductsCSV() {
  const { data } = await api.get('/admin/products', {
    params: {
      limit: 10000,
    },
  })

  return data.data
}

export async function exportOrdersCSV() {
  const { data } = await api.get('/admin/orders', {
    params: {
      limit: 10000,
    },
  })

  return data.data
}
export async function registerNotificationToken(token, phone = null) {
  const { data } = await api.post(
    "/notifications/register",
    {
      token,
      phone,
    }
  );

  return data;
}
