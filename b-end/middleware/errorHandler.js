const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500
  };

  // Firebase errors
  if (err.code) {
    switch (err.code) {
      case 'auth/email-already-exists':
        error.message = 'Email already exists';
        error.status = 400;
        break;
      case 'auth/invalid-email':
        error.message = 'Invalid email address';
        error.status = 400;
        break;
      case 'auth/weak-password':
        error.message = 'Password is too weak';
        error.status = 400;
        break;
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    error.status = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    error.status = 401;
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    error.message = 'Validation failed';
    error.status = 400;
  }

  res.status(error.status).json({
    success: false,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;