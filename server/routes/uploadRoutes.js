import express from 'express';
import multer from 'multer';
import { uploadImages, deleteImage } from '../controllers/uploadController.js';
import protect from '../middleware/authMiddleware.js';

// Bug 39: allow only the specific image formats we actually want to serve
// product photos as. Notably excludes image/svg+xml -- an SVG can carry
// embedded <script>, making "any image/*" a stored-XSS vector, not just a
// format-tolerance nicety.
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 }, // 5MB per file, 8 files max
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP, or AVIF images are allowed'));
    }
    cb(null, true);
  },
});

const router = express.Router();
router.use(protect);
router.post('/', upload.array('images', 8), uploadImages);
router.delete('/', deleteImage);

export default router;
