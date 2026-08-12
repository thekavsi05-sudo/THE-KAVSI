import twilio from 'twilio';

// Twilio's WhatsApp API is the fastest way to get real automated WhatsApp
// messages working: their free Sandbox lets you send/receive immediately
// (each recipient just sends "join <code>" once to the Sandbox number), and
// the exact same code moves to a paid, production WhatsApp Business number
// later by changing TWILIO_WHATSAPP_FROM — no code changes needed.
//
// Left null until TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are set in
// server/.env, same pattern as razorpayClient — the app still boots, this
// feature just no-ops (and logs why) until configured.
const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

/** Indian 10-digit mobile numbers need a +91 country code for WhatsApp. */
function toWhatsAppNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `whatsapp:+${withCountryCode}`;
}

/**
 * Sends an order-confirmation WhatsApp message to the customer. Intended to
 * be called fire-and-forget right after an order is created — a failure
 * here should never fail or delay the order itself.
 */
export async function sendOrderConfirmationWhatsApp(order) {
  if (!client) {
    console.log(`[WhatsApp] Skipped for ${order.orderId} — TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not set.`);
    return;
  }
  if (!process.env.TWILIO_WHATSAPP_FROM) {
    console.log(`[WhatsApp] Skipped for ${order.orderId} — TWILIO_WHATSAPP_FROM not set.`);
    return;
  }

  const itemLines = order.products.map((p) => `• ${p.name} × ${p.quantity}`).join('\n');
  const body =
    `Hi ${order.customerName}, your KAVSI order *${order.orderId}* is confirmed! 🎉\n\n` +
    `${itemLines}\n\n` +
    `Total: Rs. ${Number(order.totalAmount).toLocaleString('en-IN')}\n` +
    `Payment: ${order.paymentMethod}\n\n` +
    `Track it anytime: ${process.env.CLIENT_URL?.split(',')[0] || ''}/track-order\n` +
    `Thank you for shopping with KAVSI!`;

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM, // e.g. 'whatsapp:+14155238886' (sandbox) or your approved WABA number
    to: toWhatsAppNumber(order.phone),
    body,
  });
}
