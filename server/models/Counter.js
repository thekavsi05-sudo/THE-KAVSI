import mongoose from 'mongoose';

// A single-document-per-key counter, incremented with findOneAndUpdate($inc),
// which MongoDB guarantees is atomic even under heavy concurrency. This
// replaces the old countDocuments()+1 approach in generateOrderId.js, which
// could hand out the same order number to two orders created in the same
// instant.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "order-2026"
  seq: { type: Number, default: 0 },
});

export default mongoose.model('Counter', counterSchema);
