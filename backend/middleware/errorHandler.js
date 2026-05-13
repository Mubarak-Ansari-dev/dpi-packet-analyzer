// Global error handler — catches all next(err) calls from controllers
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error:   err.message || 'Internal Server Error',
    status:  statusCode,
    path:    req.originalUrl,
  });
};

module.exports = errorHandler;
