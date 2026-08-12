export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Centralized error handler
export function errorHandler(err, req, res, next) {
  let statusCode =
    res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500;

  let message = err.message || "Server error";

  // IMPORTANT: Print the real backend error
  console.error("\n========== BACKEND ERROR ==========");
  console.error("Method:", req.method);
  console.error("URL:", req.originalUrl);
  console.error("Status:", statusCode);
  console.error("Name:", err.name);
  console.error("Message:", err.message);
  console.error("Code:", err.code);
  console.error("KeyValue:", err.keyValue);
  console.error("Stack:", err.stack);
  console.error("===================================\n");

  // Mongoose bad ObjectId
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource not found";
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;

    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 400;

    const field = Object.keys(err.keyValue || {})[0];

    message = `${
      field
        ? field.charAt(0).toUpperCase() + field.slice(1)
        : "Value"
    } already exists`;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && {
      stack: err.stack,
    }),
  });
}

/**
 * Wrap an async route handler so thrown errors
 * reach errorHandler instead of hanging the request.
 */
export function asyncHandler(fn) {
  return (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
}