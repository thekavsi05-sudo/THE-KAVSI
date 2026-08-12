import Counter from '../models/Counter.js';

/**
 * Generates a human-friendly, year-scoped, zero-padded sequential order ID
 * like THE-KAVSI-2026-000001.
 *
 * Concurrency-safe: uses a MongoDB atomic $inc on a per-year counter
 * document instead of counting existing orders, so two orders created in
 * the same millisecond can never collide on the same number.
 *
 * Pass the active transaction session (when called from inside
 * session.withTransaction) so the counter increment is part of the same
 * transaction and rolls back together with everything else if the order
 * ultimately fails to be created.
 */
export default async function generateOrderId(session) {
  const year = new Date().getFullYear();
  const counterId = `order-${year}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session }
  );

  const seq = String(counter.seq).padStart(6, '0');
  return `THE-KAVSI-${year}-${seq}`;
}
