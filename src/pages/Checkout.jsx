import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";
import LocationPicker from "../components/LocationPicker";
import { useCart } from "../context/CartContext";
import {
  placeOrder,
  checkVariantStock,
  createRazorpayOrder,
  calculateOrderTotal,
  registerNotificationToken,
} from "../services/api";
import { loadRazorpayScript } from "../utils/loadRazorpay";

const emptyForm = {
  fullName: "",
  mobile: "",
  altMobile: "",
  houseNumber: "",
  street: "",
  landmark: "",
  area: "",
  city: "",
  state: "",
  pincode: "",
};

export default function Checkout() {
  const { items, totalPrice, clearCart, updateQuantity, removeFromCart } =
    useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [location, setLocation] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Razorpay"); // 'Razorpay' | 'COD'
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [stockIssues, setStockIssues] = useState([]);
  const [checkingStock, setCheckingStock] = useState(true);

  const [pricing, setPricing] = useState({
    subtotal: 0,
    couponDiscount: 0,
    deliveryCharge: 0,
    totalAmount: 0,
  });

  const [calculatingPrice, setCalculatingPrice] = useState(true);

  // One key per checkout page visit. If the user double-clicks "Place
  // Order", or their network retries the request, this same key goes out
  // both times — the backend recognizes the repeat and returns the
  // already-created order instead of placing a duplicate one. Generating a
  // new key would defeat the protection, so this must NOT be regenerated on
  // every render/submit.
  const idempotencyKeyRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  // Re-validate every cart item's stock the moment someone reaches checkout —
  // items may have been sitting in the bag for a while, or another customer
  // could have bought the last unit in the meantime. This is a UX head-start;
  // placeOrder() below still re-validates everything again, authoritatively.
  useEffect(() => {
    let cancelled = false;
    async function verify() {
      setCheckingStock(true);
      const results = await Promise.all(
        items.map(async (item) => {
          const { available, stock } = await checkVariantStock(
            item.productId,
            item.size,
            item.color,
          );
          if (available && stock >= item.quantity) return null;
          return {
            ...item,
            availableStock: stock,
            reason: stock === 0 ? "Out of stock" : `Only ${stock} left`,
          };
        }),
      );
      if (!cancelled) {
        setStockIssues(results.filter(Boolean));
        setCheckingStock(false);
      }
    }
    if (items.length > 0) verify();
    else setCheckingStock(false);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useEffect(() => {
    let cancelled = false;

    async function calculatePrice() {
      if (items.length === 0) {
        setCalculatingPrice(false);
        return;
      }

      try {
        setCalculatingPrice(true);

        const products = items.map((item) => ({
          productId: item.productId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        }));

        const result = await calculateOrderTotal(
          products,
          undefined,
          form.mobile,
        );

        if (!cancelled) {
          setPricing({
            subtotal: Number(result.subtotal || 0),
            couponDiscount: Number(result.couponDiscount || 0),
            deliveryCharge: Number(result.deliveryCharge || 0),
            totalAmount: Number(result.totalAmount || 0),
          });
        }
      } catch (error) {
        console.error("Price calculation failed:", error);

        if (!cancelled) {
          toast.error(
            error?.response?.data?.message || "Could not calculate order total",
          );
        }
      } finally {
        if (!cancelled) {
          setCalculatingPrice(false);
        }
      }
    }

    calculatePrice();

    return () => {
      cancelled = true;
    };
  }, [items, form.mobile]);

  function resolveIssue(issue) {
    if (issue.availableStock <= 0) {
      removeFromCart(issue.key);
    } else {
      updateQuantity(issue.key, issue.availableStock);
    }
    setStockIssues((prev) => prev.filter((i) => i.key !== issue.key));
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-24 text-center">
        <p className="font-display text-2xl mb-3">Nothing to check out</p>
        <Link to="/shop" className="btn-primary">
          Shop Now
        </Link>
      </div>
    );
  }

  function update(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function validate() {
    const req = [
      "fullName",
      "mobile",
      "houseNumber",
      "street",
      "area",
      "city",
      "state",
      "pincode",
    ];
    const next = {};
    req.forEach((f) => {
      if (!form[f]?.trim()) next[f] = "Required";
    });
    if (form.mobile && !/^\d{10}$/.test(form.mobile))
      next.mobile = "Enter a valid 10-digit number";
    if (form.pincode && !/^\d{6}$/.test(form.pincode))
      next.pincode = "Enter a valid 6-digit pincode";
    // Map-based location is disabled for now (see LocationPicker.jsx) — the
    // typed address fields above are sufficient, so no location check here.
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleStockConflict(err) {
    // The backend re-validated stock and found something no longer available —
    // this can happen even after the checkout-load check above (e.g. someone
    // else bought the last unit while this customer was filling the form).
    const unavailable = err?.response?.data?.unavailable;
    if (err?.response?.status === 409 && Array.isArray(unavailable)) {
      const issues = unavailable
        .map((u) => ({
          key: items.find(
            (i) =>
              i.productId === u.productId &&
              i.size === u.size &&
              i.color === u.color,
          )?.key,
          productId: u.productId,
          name: u.name,
          size: u.size,
          color: u.color,
          availableStock: u.availableStock ?? 0,
          reason: u.reason,
        }))
        .filter((i) => i.key);
      setStockIssues(issues);
      toast.error(
        "Some items sold out while you were checking out — please review your bag",
      );
      return true;
    }
    return false;
  }

  function buildOrderPayload(extra = {}) {
    // Build a single-line address from the typed fields. If the map
    // location picker is re-enabled in future, prefer its geocoded
    // address (and send latitude/longitude) when available.
    const fullAddress =
      location?.address ||
      [
        form.houseNumber,
        form.street,
        form.landmark,
        form.area,
        form.city,
        form.state,
        form.pincode,
      ]
        .filter(Boolean)
        .join(", ");

    return {
      customerName: form.fullName,
      phone: form.mobile,
      alternatePhone: form.altMobile,
      address: {
        houseNumber: form.houseNumber,
        street: form.street,
        landmark: form.landmark,
        area: form.area,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      },
      ...(location?.latitude
        ? { latitude: location.latitude, longitude: location.longitude }
        : {}),
      fullAddress,
      products: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        size: i.size,
        color: i.color,
      })),
      totalAmount: pricing.totalAmount,
      idempotencyKey: idempotencyKeyRef.current,
      ...extra,
    };
  }

  async function registerCustomerFCM() {
    try {
      const token = localStorage.getItem("kavsi_fcm_token");

      if (!token || !form.mobile) {
        return;
      }

      await registerNotificationToken(token, form.mobile);

      console.log("FCM token linked to customer phone:", form.mobile);
    } catch (error) {
      // Notification registration should NEVER prevent checkout.
      console.error("Failed to link FCM token to customer:", error);
    }
  }

  async function placeCodOrder() {
    const order = await placeOrder(buildOrderPayload({ paymentMethod: "COD" }));
    clearCart();
    // Bug 7: React Router `state` doesn't survive a refresh. Stash the phone
    // number used for this order so OrderConfirmation can re-fetch it (via
    // the same orderId+phone lookup TrackOrder already uses) if the state
    // is gone, and route by orderId so the URL itself is meaningful/shareable.
    sessionStorage.setItem("kavsi_last_order_phone", order.phone);
    navigate(`/order-confirmation/${order.orderId}`, { state: { order } });
  }

  /** Returns true once the Razorpay modal is open (submit lock stays on
   * until its callbacks fire), or false if we bailed out before that point
   * (submit lock should be released immediately by the caller). */
  async function placeOnlineOrder() {
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      toast.error(
        "Could not load the payment gateway. Check your connection and try again.",
      );
      return false;
    }

    const productsForPricing = items.map((i) => ({
      productId: i.productId,
      size: i.size,
      color: i.color,
      quantity: i.quantity,
    }));
    let razorpayOrder;
    try {
      razorpayOrder = await createRazorpayOrder(
        productsForPricing,
        undefined,
        form.mobile,
      );
    } catch (err) {
      if (err?.response?.status === 503) {
        toast.error(
          "Online payment isn\u2019t set up yet — please choose Cash on Delivery for now.",
        );
      } else if (!handleStockConflict(err)) {
        toast.error("Could not start payment. Please try again.");
      }
      return false;
    }

    // Opens Razorpay's hosted Checkout modal. We only ever create the KAVSI
    // order (below, in the handler) AFTER Razorpay confirms success — if the
    // customer closes the modal or the payment fails, no order is created.
    const razorpay = new window.Razorpay({
      key: razorpayOrder.keyId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      order_id: razorpayOrder.razorpayOrderId,
      name: " THE KAVSI",
      description: `Order for ${items.length} item${items.length > 1 ? "s" : ""}`,
      prefill: { name: form.fullName, contact: form.mobile },
      theme: { color: "#6E2439" },
      handler: async (response) => {
        try {
          await registerCustomerFCM();
          const order = await placeOrder(
            buildOrderPayload({
              paymentMethod: "Razorpay",
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          );
          clearCart();
          sessionStorage.setItem("kavsi_last_order_phone", order.phone);
          navigate(`/order-confirmation/${order.orderId}`, {
            state: { order },
          });
        } catch (err) {
          if (!handleStockConflict(err)) {
            toast.error(
              "Payment succeeded but the order could not be created — contact support with your payment ID: " +
                response.razorpay_payment_id,
            );
          }
        } finally {
          setSubmitting(false);
        }
      },
      modal: {
        ondismiss: () => setSubmitting(false),
      },
    });
    razorpay.on("payment.failed", (response) => {
      console.error("RAZORPAY PAYMENT FAILED:", response);

      const error = response?.error;

      console.error("Razorpay error details:", {
        code: error?.code,
        description: error?.description,
        source: error?.source,
        step: error?.step,
        reason: error?.reason,
        orderId: error?.metadata?.order_id,
        paymentId: error?.metadata?.payment_id,
      });

      toast.error(
        error?.description ||
          error?.reason ||
          "Payment failed. Please try again.",
      );

      setSubmitting(false);
    });
    razorpay.open();
    return true;
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    if (stockIssues.length > 0) {
      toast.error(
        "Please resolve the stock issues in your bag before placing the order",
      );
      return;
    }
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSubmitting(true);
    try {
      if (paymentMethod === "COD") {
        await registerCustomerFCM();
        await placeCodOrder();
        setSubmitting(false);
      } else {
        // For Razorpay, setSubmitting(false) happens in the widget's
        // handler/dismiss/failure callbacks once the modal opens — but if
        // it never opened (script/pricing failure), release the lock now.
        const modalOpened = await placeOnlineOrder();
        if (!modalOpened) setSubmitting(false);
      }
    } catch (err) {
      if (!handleStockConflict(err)) {
        toast.error("Could not place order. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <h1 className="text-3xl mb-8">Checkout</h1>
      <form
        onSubmit={handlePlaceOrder}
        className="grid md:grid-cols-[1fr_360px] gap-10"
      >
        <div className="space-y-8">
          <section>
            <h2 className="font-display text-lg mb-4">
              Contact & Delivery Details
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Full Name"
                value={form.fullName}
                onChange={(v) => update("fullName", v)}
                error={errors.fullName}
                full
              />
              <Field
                label="Mobile Number"
                value={form.mobile}
                onChange={(v) =>
                  update("mobile", v.replace(/\D/g, "").slice(0, 10))
                }
                error={errors.mobile}
              />
              <Field
                label="Alternate Mobile (optional)"
                value={form.altMobile}
                onChange={(v) =>
                  update("altMobile", v.replace(/\D/g, "").slice(0, 10))
                }
              />
              <Field
                label="House / Flat Number"
                value={form.houseNumber}
                onChange={(v) => update("houseNumber", v)}
                error={errors.houseNumber}
              />
              <Field
                label="Street"
                value={form.street}
                onChange={(v) => update("street", v)}
                error={errors.street}
              />
              <Field
                label="Landmark (optional)"
                value={form.landmark}
                onChange={(v) => update("landmark", v)}
              />
              <Field
                label="Area"
                value={form.area}
                onChange={(v) => update("area", v)}
                error={errors.area}
              />
              <Field
                label="City"
                value={form.city}
                onChange={(v) => update("city", v)}
                error={errors.city}
              />
              <Field
                label="State"
                value={form.state}
                onChange={(v) => update("state", v)}
                error={errors.state}
              />
              <Field
                label="Pincode"
                value={form.pincode}
                onChange={(v) =>
                  update("pincode", v.replace(/\D/g, "").slice(0, 6))
                }
                error={errors.pincode}
              />
            </div>
          </section>

          <section>
            <LocationPicker value={location} onChange={setLocation} />
            {errors.location && (
              <p className="text-xs text-wine mt-2">{errors.location}</p>
            )}
          </section>

          <section>
            <h2 className="font-display text-lg mb-3">Payment Method</h2>
            <div className="space-y-2">
              <label
                className={`border px-4 py-3 flex items-center gap-3 text-sm cursor-pointer ${
                  paymentMethod === "Razorpay"
                    ? "border-wine bg-wine/5"
                    : "border-ink/15"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "Razorpay"}
                  onChange={() => setPaymentMethod("Razorpay")}
                  className="accent-wine"
                />
                ONLINE PAYMENT (UPI / Card / Netbanking)
              </label>
              <label
                className={`border px-4 py-3 flex items-center gap-3 text-sm cursor-pointer ${
                  paymentMethod === "COD"
                    ? "border-wine bg-wine/5"
                    : "border-ink/15"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "COD"}
                  onChange={() => setPaymentMethod("COD")}
                  className="accent-wine"
                />
                CASH ON DELIVERY
              </label>
            </div>
          </section>
        </div>

        <aside className="border border-ink/10 p-6 h-fit space-y-4">
          <h2 className="font-display text-lg">Order Summary</h2>

          {stockIssues.length > 0 && (
            <div className="border border-wine/40 bg-wine/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-wine flex items-center gap-1.5">
                <AlertTriangle size={13} /> {stockIssues.length} item
                {stockIssues.length > 1 ? "s need" : " needs"} your attention
              </p>
              {stockIssues.map((issue) => (
                <div
                  key={issue.key}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-ink/70">
                    {issue.name} ({issue.size}/{issue.color}) — {issue.reason}
                  </span>
                  <button
                    type="button"
                    onClick={() => resolveIssue(issue)}
                    className="text-wine underline shrink-0"
                  >
                    {issue.availableStock > 0
                      ? `Reduce to ${issue.availableStock}`
                      : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.key}
                className="flex justify-between text-xs text-ink/70"
              >
                <span>
                  {item.name} × {item.quantity} ({item.size}/{item.color})
                </span>
                <span>
                  ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-ink/10 pt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{pricing.subtotal.toLocaleString("en-IN")}</span>
            </div>

            {pricing.couponDiscount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Coupon Discount</span>
                <span>-₹{pricing.couponDiscount.toLocaleString("en-IN")}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Delivery Charge</span>
              <span>
                {pricing.deliveryCharge > 0
                  ? `₹${pricing.deliveryCharge.toLocaleString("en-IN")}`
                  : "FREE"}
              </span>
            </div>

            <div className="flex justify-between text-base font-semibold border-t border-ink/10 pt-4">
              <span>Total</span>

              <span>
                {calculatingPrice
                  ? "Calculating..."
                  : `₹${pricing.totalAmount.toLocaleString("en-IN")}`}
              </span>
            </div>
          </div>
          <button
            type="submit"
            disabled={
              submitting ||
              checkingStock ||
              calculatingPrice ||
              stockIssues.length > 0
            }
            className="btn-primary w-full"
          >
            {calculatingPrice
              ? "Calculating total…"
              : submitting
                ? paymentMethod === "Razorpay"
                  ? "Opening Payment…"
                  : "Placing Order…"
                : checkingStock
                  ? "Checking availability…"
                  : stockIssues.length > 0
                    ? "Resolve Bag Issues to Continue"
                    : paymentMethod === "Razorpay"
                      ? "Proceed to Pay"
                      : "Place Order"}
          </button>
        </aside>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, error, full }) {
  return (
    <label className={`block text-xs ${full ? "sm:col-span-2" : ""}`}>
      <span className="font-medium text-ink/80">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input-field mt-1.5 ${error ? "border-wine" : ""}`}
      />
      {error && <span className="text-wine mt-1 block">{error}</span>}
    </label>
  );
}
