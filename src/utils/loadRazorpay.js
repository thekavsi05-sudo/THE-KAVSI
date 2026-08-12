let razorpayScriptPromise = null

/**
 * Lazily injects Razorpay's Checkout.js (which defines window.Razorpay).
 * Loaded on demand — not on every page load — since it's only needed at
 * the moment someone chooses online payment at checkout. Cached so a
 * second call (e.g. retrying a failed payment) doesn't re-inject the tag.
 */
export function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true)
  if (razorpayScriptPromise) return razorpayScriptPromise

  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
  return razorpayScriptPromise
}
