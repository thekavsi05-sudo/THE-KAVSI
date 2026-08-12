import ContactMessage from '../models/ContactMessage.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/contact
export const submitContactMessage = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  const errors = [];
  if (!name?.trim()) errors.push('Name is required');
  if (!email?.trim() || !EMAIL_RE.test(email.trim())) errors.push('A valid email is required');
  if (phone && !/^\d{10}$/.test(phone.trim())) errors.push('Phone number must be 10 digits');
  if (!message?.trim()) errors.push('Message is required');
  if (message && message.trim().length > 2000) errors.push('Message is too long');
  if (errors.length) return res.status(400).json({ success: false, message: 'Validation failed', errors });

  const doc = await ContactMessage.create({ name: name.trim(), email: email.trim(), phone, subject, message: message.trim() });
  res.status(201).json({ success: true, message: 'Message sent — we will get back to you shortly', data: doc });
});

// GET /api/admin/contact-messages
export const getAdminMessages = asyncHandler(async (req, res) => {
  const messages = await ContactMessage.find({}).sort({ createdAt: -1 });
  res.json({ success: true, data: messages });
});

// PUT /api/admin/contact-messages/:id
export const updateMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findByIdAndUpdate(req.params.id, { isRead: !!req.body.isRead }, { new: true });
  if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
  res.json({ success: true, data: message });
});

// DELETE /api/admin/contact-messages/:id
export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findByIdAndDelete(req.params.id);
  if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
  res.json({ success: true, message: 'Message deleted' });
});
