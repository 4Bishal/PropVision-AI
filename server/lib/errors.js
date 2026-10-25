export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error instanceof AppError ? error.status : 500;
  let code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
  let message = error instanceof AppError ? error.message : 'An internal error occurred';
  if (error.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'Request body must be valid JSON';
  } else if (error.type === 'entity.too.large') {
    status = 413; code = 'BODY_TOO_LARGE'; message = 'Request body exceeds 32 KB';
  } else if (error.name === 'ValidationError' || error.name === 'CastError') {
    status = 422; code = 'DATABASE_VALIDATION_ERROR'; message = 'Invalid property data';
  } else if (error.name?.startsWith('Mongo') || error.name?.startsWith('Mongoose')) {
    status = 503; code = 'DATABASE_UNAVAILABLE'; message = 'Property database is unavailable';
  }
  if (status >= 500) {
    // Avoid logging request payloads, MongoDB URIs, or Axios configs/headers.
    console.error(JSON.stringify({ request_id: req.id, code, error: error.name }));
  }
  res.status(status).json({ error: { code, message,
    ...(error instanceof AppError && error.details !== undefined ? { details: error.details } : {}),
    request_id: req.id } });
}
