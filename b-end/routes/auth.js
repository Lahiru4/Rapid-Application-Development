// routes/auth.js - Authentication Routes

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

// Import controllers
const { register, login, getProfile, refreshToken, logout, changePassword, forgotPassword, resetPassword } = require('../controllers/authController');

// Import middleware
const { authenticateToken } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth routes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More restrictive rate limiting for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.',
    retryAfter: 60 * 60 // 1 hour in seconds
  }
});

// Validation rules for password change
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    })
];

// Validation rules for forgot password
const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

// Validation rules for reset password
const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    })
];

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter, validateRegister, register);

// @route   POST /api/auth/login
// @desc    Login user and return JWT token
// @access  Public
router.post('/login', authLimiter, validateLogin, login);

// @route   POST /api/auth/refresh
// @desc    Refresh access token using refresh token
// @access  Public
router.post('/refresh', refreshToken);

// @route   POST /api/auth/logout
// @desc    Logout user and invalidate tokens
// @access  Private
router.post('/logout', authenticateToken, logout);

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authenticateToken, getProfile);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', 
  authenticateToken,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Please provide a valid phone number'),
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Please provide a valid date'),
    body('address')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Address must not exceed 200 characters')
  ],
  updateProfile
);

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', 
  authenticateToken, 
  validatePasswordChange, 
  changePassword
);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', 
  passwordResetLimiter,
  validateForgotPassword, 
  forgotPassword
);

// @route   POST /api/auth/reset-password
// @desc    Reset password using reset token
// @access  Public
router.post('/reset-password', 
  authLimiter,
  validateResetPassword, 
  resetPassword
);

// @route   POST /api/auth/verify-email
// @desc    Verify email address using verification token
// @access  Public
router.post('/verify-email', 
  [
    body('token')
      .notEmpty()
      .withMessage('Verification token is required')
  ],
  verifyEmail
);

// @route   POST /api/auth/resend-verification
// @desc    Resend email verification
// @access  Private
router.post('/resend-verification', 
  authenticateToken,
  resendEmailVerification
);

// @route   GET /api/auth/sessions
// @desc    Get active user sessions
// @access  Private
router.get('/sessions', authenticateToken, getUserSessions);

// @route   DELETE /api/auth/sessions/:sessionId
// @desc    Revoke specific session
// @access  Private
router.delete('/sessions/:sessionId', authenticateToken, revokeSession);

// @route   DELETE /api/auth/sessions
// @desc    Revoke all sessions except current
// @access  Private
router.delete('/sessions', authenticateToken, revokeAllSessions);

// @route   GET /api/auth/login-history
// @desc    Get user login history
// @access  Private
router.get('/login-history', authenticateToken, getLoginHistory);

// @route   POST /api/auth/enable-2fa
// @desc    Enable two-factor authentication
// @access  Private
router.post('/enable-2fa', authenticateToken, enableTwoFactorAuth);

// @route   POST /api/auth/verify-2fa
// @desc    Verify two-factor authentication code
// @access  Private
router.post('/verify-2fa', 
  authenticateToken,
  [
    body('code')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('2FA code must be 6 digits')
  ],
  verifyTwoFactorAuth
);

// @route   POST /api/auth/disable-2fa
// @desc    Disable two-factor authentication
// @access  Private
router.post('/disable-2fa', 
  authenticateToken,
  [
    body('password')
      .notEmpty()
      .withMessage('Password is required to disable 2FA'),
    body('code')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('2FA code must be 6 digits')
  ],
  disableTwoFactorAuth
);

// @route   GET /api/auth/check-token
// @desc    Check if token is valid (for frontend validation)
// @access  Private
router.get('/check-token', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: {
      id: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name
    }
  });
});

// @route   POST /api/auth/impersonate
// @desc    Admin impersonate user (for support purposes)
// @access  Private (Admin only)
router.post('/impersonate',
  authenticateToken,
  requireAdmin,
  [
    body('userId')
      .notEmpty()
      .withMessage('User ID is required'),
    body('reason')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Reason for impersonation is required (minimum 10 characters)')
  ],
  impersonateUser
);

// @route   POST /api/auth/stop-impersonation
// @desc    Stop impersonating user
// @access  Private (Admin only)
router.post('/stop-impersonation', authenticateToken, stopImpersonation);

// Error handling middleware specific to auth routes
router.use((error, req, res, next) => {
  // Log authentication errors
  console.error('Auth Route Error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Handle specific auth errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }

  if (error.message === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later'
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    message: 'Authentication service temporarily unavailable'
  });
});

module.exports = router;