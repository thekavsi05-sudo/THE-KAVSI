# The KAVSI — Full-Stack E-Commerce (React + Express + MongoDB)

A premium women's clothing storefront with a hidden, JWT-protected admin
panel, now backed by a real Node/Express + MongoDB API. Products the admin
adds are saved permanently to MongoDB and appear on the Shop page for every
customer — that flow is the core of this build and is fully wired end to end.

```
CUSTOMER / ADMIN  →  React + Vite (client/)  →  Axios  →  Express REST API (server/)  →  MongoDB
                                                                    ↓
                                                          Cloudinary (images)
```

## Project Structure

```
kavsi-frontend/
├── src/                  # React app (unchanged folder layout — see below)
├── server/               # NEW: Express + MongoDB backend
│   ├── config/db.js
│   ├── models/           # Product, Order, Admin, Category, Coupon, Review, ContactMessage
│   ├── controllers/
│   ├── routes/
│   ├── middleware/       # auth, error handling, validation
│   ├── utils/            # JWT, order-ID generator, Cloudinary, seedAdmin.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── package.json          # frontend
└── .env.example          # frontend
```

## 1. Prerequisites

- Node.js 18+
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster
- A free [Cloudinary](https://cloudinary.com/users/register/free) account (for product images)
- A [Google Maps API key](https://console.cloud.google.com/) with **Maps JavaScript API**, **Geocoding API**, and **Places API** enabled, billing account attached (Google requires this even for the free tier)

## 2. Backend Setup (`server/`)

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:
- `MONGODB_URI` — from Atlas → Connect → Drivers (replace `<user>`/`<password>`)
- `JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`)
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` — from your Cloudinary dashboard's "Account Details" card
- `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` — pick your real admin login (change the password from the placeholder!)

Create your admin account (run once):
```bash
npm run seed:admin
```

Start the API:
```bash
npm run dev      # nodemon, auto-restarts on changes
# or
npm start
```

You should see `KAVSI API listening on port 5000` and a MongoDB connected log line. Visit `http://localhost:5000/api/health` to confirm.

## 3. Frontend Setup (`client` — the repo root)

```bash
npm install
cp .env.example .env
```

Edit `.env`:
```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
VITE_WHATSAPP_NUMBER=919490777920
```

```bash
npm run dev
```

The storefront runs at `http://localhost:5173`. Admin panel is at
`http://localhost:5173/admin/login` — it is never linked from the public
site, by design.

## 4. What Changed From the Mock-Data Version

- `src/services/api.js` now calls the real Express API for everything — no
  `USE_MOCK` flag, no in-memory arrays. Every function signature it exposes
  (`fetchProducts`, `placeOrder`, `adminLogin`, etc.) is unchanged, so no
  page/component had to be rewritten.
- `src/services/mockData.js` no longer contains fake products/orders — only
  static site copy (default category presets, homepage testimonials).
- `src/admin/AdminProductForm.jsx` — image picker now uploads straight to
  Cloudinary through `POST /api/admin/upload` instead of a local preview.
- `src/pages/Contact.jsx` now posts to `POST /api/contact` (stored in Mongo,
  visible to admin via `GET /api/admin/contact-messages`).
- **New:** `src/pages/TrackOrder.jsx` at `/track-order`, linked from the
  footer and the order confirmation page — enters Order ID + phone, calls
  `GET /api/orders/track`.
- `src/admin/AdminOrders.jsx` — fixed to display the human-friendly
  `orderId` (e.g. `KAVSI-2026-000001`) instead of the raw Mongo `_id`, and
  the full 7-stage status list.

## 5. The Critical Flow, End to End

```
Admin Login (/admin/login)
  → POST /api/auth/admin/login → JWT stored in localStorage
Admin → Add Product
  → images uploaded to Cloudinary via POST /api/admin/upload
  → POST /api/admin/products (JWT required) → saved in MongoDB
Customer → Shop page
  → GET /api/products → reads the same MongoDB collection
  → new product appears immediately, no code changes needed
Customer → Product Details → select size/color → Add to Cart → Checkout
  → GPS location via LocationPicker (Google Maps) → lat/lng + address saved
  → POST /api/orders
      → backend re-validates every variant's live stock
      → backend re-calculates every price (never trusts the frontend)
      → stock decremented atomically inside a MongoDB transaction
      → human-friendly order ID generated (KAVSI-2026-000001)
Admin → Orders
  → GET /api/admin/orders, PUT /api/admin/orders/:id/status
  → "Navigate" opens Google Maps directions to the saved GPS pin
Customer → /track-order
  → GET /api/orders/track?orderId=&phone= (only returns a match if BOTH match)
```

## 6. API Reference

**Public**
```
GET    /api/products                      list (search/filter/sort/pagination)
GET    /api/products/:id                   by id or slug
GET    /api/products/:id/variant-stock     live stock check for one size/color
GET    /api/products/:productId/reviews
POST   /api/products/:productId/reviews    verified by orderId+phone
GET    /api/categories
POST   /api/coupons/validate
POST   /api/orders
GET    /api/orders/track?orderId=&phone=
POST   /api/orders/:orderId/cancel
POST   /api/contact
GET    /api/health
```

**Admin** (all require `Authorization: Bearer <jwt>`)
```
POST   /api/auth/admin/login
GET    /api/auth/admin/me
PUT    /api/auth/admin/change-password

GET    /api/admin/products
POST   /api/admin/products
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id
PATCH  /api/admin/products/bulk
GET    /api/admin/products/export          CSV

POST   /api/admin/upload                   multipart "images" field, multiple files
DELETE /api/admin/upload?publicId=...

GET    /api/admin/orders
GET    /api/admin/orders/:id
PUT    /api/admin/orders/:id/status

GET    /api/admin/categories
POST   /api/admin/categories
PUT    /api/admin/categories/:id
DELETE /api/admin/categories/:id

GET    /api/admin/coupons
POST   /api/admin/coupons
PUT    /api/admin/coupons/:id
DELETE /api/admin/coupons/:id

GET    /api/admin/reviews
PUT    /api/admin/reviews/:id
DELETE /api/admin/reviews/:id

GET    /api/admin/contact-messages
PUT    /api/admin/contact-messages/:id
DELETE /api/admin/contact-messages/:id

GET    /api/admin/dashboard
GET    /api/admin/dashboard/best-sellers
GET    /api/admin/dashboard/sales?range=daily|monthly&days=30
```

## 7. Security Notes

- Admin passwords are bcrypt-hashed (never stored in plain text); 5 failed
  logins locks the account for 15 minutes.
- Every `/api/admin/*` route re-verifies the JWT server-side — the frontend
  hiding `/admin` from navigation is cosmetic, not the actual protection.
- Order pricing, stock checks, and totals are 100% backend-calculated inside
  a MongoDB transaction; the frontend's cart numbers are never trusted.
- Helmet, CORS (locked to `CLIENT_URL`), rate limiting (300 req/15min
  general, 20/15min on login), and `express-mongo-sanitize` (NoSQL injection
  protection) are all enabled in `server/server.js`.

## 8. Deployment

- **Frontend:** Vercel — set `VITE_API_BASE_URL` to your deployed API URL and `VITE_GOOGLE_MAPS_API_KEY` in the Vercel project's environment variables.
- **Backend:** Render or Railway — set all `server/.env` variables in the platform's dashboard; set `CLIENT_URL` to your deployed frontend's URL (CORS depends on it).
- **Database:** MongoDB Atlas — allow-list `0.0.0.0/0` (or your host's IPs) in Atlas Network Access.
- **Images:** Cloudinary — no deploy step needed, just correct env vars.

## 9. What's Deliberately Out of Scope for This Pass

Everything in the core commerce loop (products, variants, stock, cart,
checkout, GPS, orders, tracking, admin auth, dashboard, categories, coupons,
reviews, contact messages, image upload) is implemented and wired. Not yet
built, listed here so nothing is assumed to silently exist:

- PDF invoice generation
- Admin-side charts/graphs UI for the sales analytics endpoints (the API
  endpoints exist — `/api/admin/dashboard/sales`, `/best-sellers` — but no
  chart component consumes them yet)
- Returns/exchanges workflow
- CSV product **import** (export exists: `GET /api/admin/products/export`)
- Pincode-level delivery availability checking
- Store Settings admin screen (delivery charge / free-delivery threshold are
  read from `server/.env` for now — `DEFAULT_DELIVERY_CHARGE`,
  `FREE_DELIVERY_THRESHOLD`)
- SEO meta tags / structured data / sitemap
- Wishlist / recently-viewed (spec calls for browser-storage-based; not yet added to the UI)
- Online payment gateways (Razorpay/UPI/Cards) — architecture supports adding
  them (`paymentMethod` enum already includes them), COD is the only wired
  option today

## 10. Testing This Yourself

This was built and reviewed without a live network connection, database, or
npm registry access, so **it has not been run end-to-end**. Before treating
it as production-ready:

1. `npm install` in both `server/` and the repo root — confirm no dependency
   errors.
2. Run `npm run seed:admin`, then `npm run dev` in `server/`, then `npm run
   dev` in the root, and walk through Section 5's flow manually.
3. Watch the server console and browser network tab for the first few
   requests — that's the fastest way to catch a typo or env var mismatch.
