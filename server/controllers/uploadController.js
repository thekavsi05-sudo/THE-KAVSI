import { asyncHandler } from '../middleware/errorMiddleware.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

// Bug 39: multer's fileFilter only sees the Content-Type header the client
// *claims* -- trivially spoofable. This checks the actual file bytes
// (magic numbers) so a renamed/relabeled malicious file can't ride through
// as "image/jpeg". Kept intentionally small (no extra dependency): each
// entry is a byte sequence that must appear at the very start of the file.
const MAGIC_BYTES = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WEBP: "RIFF"....\"WEBP\" -- bytes 0-3 and 8-11, so checked separately below.
];

function looksLikeAllowedImage(buffer) {
  if (!buffer || buffer.length < 12) return false;
  for (const { bytes } of MAGIC_BYTES) {
    if (bytes.every((b, i) => buffer[i] === b)) return true;
  }
  // WEBP and AVIF are both RIFF/ISO-BMFF containers without a single fixed
  // short prefix, so check their distinguishing ASCII markers instead.
  const ascii12 = buffer.slice(0, 12).toString('ascii');
  if (ascii12.startsWith('RIFF') && ascii12.slice(8, 12) === 'WEBP') return true;
  if (buffer.slice(4, 12).toString('ascii').includes('ftypavif')) return true;
  return false;
}

// POST /api/admin/upload — multipart form field "images" (multiple)
// Returns [{ url, publicId }] to be stored on the product document.
export const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded' });
  }

  const invalid = files.filter((f) => !looksLikeAllowedImage(f.buffer));
  if (invalid.length > 0) {
    return res.status(400).json({
      success: false,
      message: `File "${invalid[0].originalname}" is not a valid JPEG, PNG, WEBP, or AVIF image.`,
    });
  }

  const results = await Promise.all(
    files.map(async (file) => {
      const result = await uploadBufferToCloudinary(file.buffer, { folder: 'kavsi/products' });
      return { url: result.secure_url, publicId: result.public_id };
    })
  );

  res.status(201).json({ success: true, data: results });
});

// DELETE /api/admin/upload/:publicId — publicId may contain slashes, so it's
// passed as a query param instead of a path segment to avoid encoding issues.
export const deleteImage = asyncHandler(async (req, res) => {
  const { publicId } = req.query;
  if (!publicId) return res.status(400).json({ success: false, message: 'publicId is required' });
  await deleteFromCloudinary(publicId);
  res.json({ success: true, message: 'Image deleted' });
});
