// Lightweight, dependency-free request validation. Each function returns an
// Express middleware; on failure it responds 400 with the list of problems
// instead of letting bad data reach Mongoose/controllers.

function fail(res, errors) {
  return res.status(400).json({ success: false, message: 'Validation failed', errors });
}

export function validateProductInput(req, res, next) {
  const { name, price } = req.body;
  const errors = [];
  if (!name || !String(name).trim()) errors.push('Product name is required');
  if (price === undefined || price === null || Number.isNaN(Number(price)) || Number(price) < 0) {
    errors.push('A valid price is required');
  }
  let images = req.body.images;
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch {
      images = [];
    }
  }
  if (!images || images.length === 0) errors.push('At least one product image is required');
  if (errors.length) return fail(res, errors);
  next();
}

export function validateOrderInput(req, res, next) {
  const { customerName, phone, address, latitude, longitude, products } = req.body;
  const errors = [];
  if (!customerName?.trim()) errors.push('Customer name is required');
  if (!phone || !/^\d{10}$/.test(phone)) errors.push('A valid 10-digit phone number is required');
  if (!address?.city || !address?.pincode) errors.push('Delivery address is incomplete');
  // if (latitude === undefined || longitude === undefined) errors.push('Delivery location (GPS) is required');
  if (!Array.isArray(products) || products.length === 0) errors.push('Order must contain at least one product');
  if (errors.length) return fail(res, errors);
  next();
}

export function validateLogin(req, res, next) {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return fail(res, ['Username and password are required']);
  }
  next();
}
