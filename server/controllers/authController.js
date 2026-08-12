import Admin from '../models/Admin.js';
import generateToken from '../utils/generateToken.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// POST /api/auth/admin/login
export const adminLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username: username.toLowerCase() }).select('+password');

  // Deliberately vague message either way — never reveal whether the
  // username exists (spec section 29: secure error messages).
  const invalid = () => res.status(401).json({ success: false, message: 'Invalid username or password' });

  if (!admin) return invalid();

  if (admin.isLocked()) {
    const minsLeft = Math.ceil((admin.lockUntil - Date.now()) / 60000);
    return res.status(423).json({
      success: false,
      message: `Too many failed attempts. Try again in ${minsLeft} minute(s).`,
    });
  }

  const match = await admin.comparePassword(password);
  if (!match) {
    admin.failedLoginAttempts += 1;
    if (admin.failedLoginAttempts >= MAX_ATTEMPTS) {
      admin.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      admin.failedLoginAttempts = 0;
    }
    await admin.save();
    return invalid();
  }

  admin.failedLoginAttempts = 0;
  admin.lockUntil = undefined;
  await admin.save();

  const token = generateToken(admin);
  res.json({ success: true, token, admin: { id: admin._id, username: admin.username, role: admin.role } });
});

// GET /api/auth/admin/me
export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, admin: { id: req.admin._id, username: req.admin.username, role: req.admin.role } });
});

// PUT /api/auth/admin/change-password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
  }
  const admin = await Admin.findById(req.admin._id).select('+password');
  const match = await admin.comparePassword(currentPassword);
  if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  admin.password = newPassword;
  await admin.save();
  res.json({ success: true, message: 'Password updated' });
});
