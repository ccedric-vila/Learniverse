function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.status || err.statusCode || 500;
  res.status(status).json({
    message: status < 500 ? err.message : 'Internal server error',
  });
}

module.exports = { errorHandler };