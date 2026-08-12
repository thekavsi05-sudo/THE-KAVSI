import twilio from 'twilio';

let client = null;
let clientChecked = false;

function getClient() {
  if (clientChecked) return client;
  clientChecked = true;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  client = twilio(sid, token);
  return client;
}

// Assumes a 10-digit Indian mobile number if no country code was typed,
// since that's the only shape the checkout form collects/validates today.
function toE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function trackingUrl(order) {
  const base = process.env.CLIENT_URL?.split(',')[0] || '';
  return `${base}/track-order?orderId=${encodeURIComponent(order.orderId)}&phone=${encodeURIComponent(order.phone)}`;
}

function freeformBody(order) {
  const itemsLine = (order.products || []).map((p) => `${p.name} x${p.quantity}`).join(', ');
  return (
    `Hi ${order.customerName}, your KAVSI order ${order.orderId} has been placed! ` +
    `Items: ${itemsLine}. Total: Rs. ${order.totalAmount}. ` +
    `Track it here: ${trackingUrl(order)}`
  );
}

/**
 * Sends a WhatsApp order-confirmation message via Twilio. Best-effort by
 * design: if Twilio isn't configured, or the send fails for any reason, this
 * logs and returns quietly rather than throwing — a notification hiccup must
 * never undo or block an order that has already been created.
 *
 * IMPORTANT — read before you expect this to work for real customers:
 *
 * WhatsApp treats an order confirmation as a business-initiated message
 * (the customer didn't message you first), and Meta/Twilio require
 * business-initiated messages to use a pre-approved Message Template once
 * you're out of Sandbox mode. This is a WhatsApp Business Platform policy —
 * not something any code can bypass. Two setups are supported here:
 *
 *   1) SANDBOX / TESTING (fastest to try, doesn't reach real customers):
 *      - In the Twilio Console, open Messaging → Try it out → WhatsApp
 *        Sandbox. It gives you a sandbox number and a join code.
 *      - From the phone you want to test with, send that join code in
 *        WhatsApp to the sandbox number once.
 *      - Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and
 *        TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 (the sandbox number).
 *      - Leave TWILIO_WHATSAPP_TEMPLATE_SID blank — this sends the
 *        free-form message below, which only Sandbox allows.
 *      - Limitation: ONLY numbers that sent the join code will receive
 *        anything. Fine for testing your own phone, not usable for real
 *        customers who've never heard of your sandbox.
 *
 *   2) PRODUCTION (reaches any customer):
 *      - Apply for a WhatsApp Business sender in the Twilio Console
 *        (Messaging → Senders → WhatsApp senders) — this requires Meta
 *        business verification and takes Twilio/Meta some time to approve.
 *      - Create and submit a Message Template for approval (e.g. "Hi
 *        {{1}}, your order {{2}} has been placed! Total: Rs. {{3}}. Track
 *        it: {{4}}") — approval is typically same-day to a few days.
 *      - Once approved you'll have a Content SID (starts with "HX...").
 *        Set TWILIO_WHATSAPP_TEMPLATE_SID to it, and TWILIO_WHATSAPP_FROM
 *        to your approved sender number.
 *      - With TWILIO_WHATSAPP_TEMPLATE_SID set, this function sends the
 *        approved template (with order details filled into its
 *        placeholders) instead of free-form text — required for delivery
 *        to customers who haven't messaged you first.
 *
 * Leave TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN blank to skip sending
 * entirely — no code changes needed, this file picks up server/.env
 * automatically on the next order.
 */
export async function sendWhatsAppOrderConfirmation(order) {
  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      console.log(`[notify] Skipped WhatsApp confirmation for ${order.orderId} — Twilio not configured (see server/utils/notify.js).`);
      return;
    }
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!from) {
      console.log(`[notify] Skipped WhatsApp confirmation for ${order.orderId} — set TWILIO_WHATSAPP_FROM.`);
      return;
    }
    const to = `whatsapp:${toE164(order.phone)}`;
    const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID;

    if (templateSid) {
      // Production path — approved template required for business-initiated
      // messages. Adjust the numbered variables to match your approved
      // template's placeholders.
      await twilioClient.messages.create({
        from,
        to,
        contentSid: templateSid,
        contentVariables: JSON.stringify({
          1: order.customerName,
          2: order.orderId,
          3: String(order.totalAmount),
          4: trackingUrl(order),
        }),
      });
    } else {
      // Sandbox / testing path — free-form text, only deliverable to
      // numbers that joined your sandbox.
      await twilioClient.messages.create({ from, to, body: freeformBody(order) });
    }
    console.log(`[notify] WhatsApp confirmation sent for ${order.orderId}`);
  } catch (err) {
    console.error(`[notify] Failed to send WhatsApp confirmation for ${order?.orderId}:`, err.message);
  }
}
