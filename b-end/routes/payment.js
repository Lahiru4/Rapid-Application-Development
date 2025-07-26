// routes/payment.js - Payment Routes

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query, param } = require('express-validator');
const crypto = require('crypto');

// Import controllers
const {
  processPayment,
  createPaymentIntent,
  confirmPaymentIntent,
  processRefund,
  getPaymentHistory,
  getRefundHistory,
  getPaymentStats,
  handlePaymentWebhook,
  getPaymentMethods,
  savePaymentMethod,
  deletePaymentMethod,
  validatePaymentMethod,
  getTransactionDetails,
  disputeTransaction,
  getPaymentAnalytics,
  processPartialRefund,
  schedulePayment,
  cancelScheduledPayment
} = require('../controllers/paymentController');

// Import middleware
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for payment operations
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each user to 20 payment attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many payment attempts, please try again later.'
  },
  keyGenerator: (req) => {
    return req.user ? req.user.userId : req.ip;
  }
});

// Stricter rate limiting for payment processing
const paymentProcessingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit to 5 payment processing attempts per 5 minutes
  message: {
    success: false,
    message: 'Too many payment processing attempts, please wait before trying again.'
  },
  keyGenerator: (req) => {
    return req.user ? req.user.userId : req.ip;
  }
});

// Rate limiting for refund operations (admin only)
const refundLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit admin to 50 refund operations per 15 minutes
  message: {
    success: false,
    message: 'Too many refund operations, please try again later.'
  }
});

// Validation for payment processing
const validatePaymentProcessing = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required'),
  body('paymentMethod')
    .isIn(['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer', 'crypto'])
    .withMessage('Invalid payment method'),
  body('amount')
    .isFloat({ min: 0.01, max: 100000 })
    .withMessage('Amount must be between 0.01 and 100,000'),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD'])
    .withMessage('Invalid currency'),
  body('cardDetails')
    .optional()
    .isObject()
    .withMessage('Card details must be an object'),
  body('cardDetails.number')
    .optional()
    .isCreditCard()
    .withMessage('Invalid card number'),
  body('cardDetails.expiryMonth')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Invalid expiry month'),
  body('cardDetails.expiryYear')
    .optional()
    .isInt({ min: new Date().getFullYear(), max: new Date().getFullYear() + 20 })
    .withMessage('Invalid expiry year'),
  body('cardDetails.cvv')
    .optional()
    .isLength({ min: 3, max: 4 })
    .isNumeric()
    .withMessage('Invalid CVV'),
  body('billingAddress')
    .optional()
    .isObject()
    .withMessage('Billing address must be an object')
];

// Validation for payment intent creation
const validatePaymentIntent = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required'),
  body('paymentMethod')
    .optional()
    .isIn(['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD'])
    .withMessage('Invalid currency'),
  body('setupFutureUsage')
    .optional()
    .isBoolean()
    .withMessage('Setup future usage must be a boolean')
];

// Validation for payment intent confirmation
const validatePaymentConfirmation = [
  body('paymentIntentId')
    .notEmpty()
    .withMessage('Payment intent ID is required'),
  body('paymentMethodDetails')
    .optional()
    .isObject()
    .withMessage('Payment method details must be an object')
];

// Validation for refund processing
const validateRefund = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be positive'),
  body('reason')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Refund reason must be between 5 and 500 characters'),
  body('refundType')
    .optional()
    .isIn(['full', 'partial', 'shipping_only'])
    .withMessage('Invalid refund type'),
  body('notifyCustomer')
    .optional()
    .isBoolean()
    .withMessage('Notify customer must be a boolean')
];

// Validation for payment method saving
const validateSavePaymentMethod = [
  body('type')
    .isIn(['credit_card', 'debit_card', 'bank_account'])
    .withMessage('Invalid payment method type'),
  body('cardDetails')
    .if(body('type').equals('credit_card').or(body('type').equals('debit_card')))
    .isObject()
    .withMessage('Card details required for card payments'),
  body('cardDetails.number')
    .if(body('type').equals('credit_card').or(body('type').equals('debit_card')))
    .isCreditCard()
    .withMessage('Invalid card number'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('Is default must be a boolean'),
  body('nickname')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Nickname must be between 1 and 50 characters')
];

// Validation for scheduled payments
const validateScheduledPayment = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required'),
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required'),
  body('scheduledDate')
    .isISO8601()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Scheduled date must be in the future');
      }
      return true;
    }),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be positive'),
  body('recurrence')
    .optional()
    .isIn(['none', 'daily', 'weekly', 'monthly', 'yearly'])
    .withMessage('Invalid recurrence type')
];

// Validation for payment queries
const validatePaymentQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'])
    .withMessage('Invalid payment status'),
  query('paymentMethod')
    .optional()
    .isIn(['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO date')
];

// Webhook signature verification middleware
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['webhook-signature'] || req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!signature) {
    return res.status(401).json({
      success: false,
      message: 'Missing webhook signature'
    });
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET || 'default_secret')
      .update(payload)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Webhook signature verification failed'
    });
  }
};

// AUTHENTICATED USER ROUTES

// @route   POST /api/payment/process
// @desc    Process payment for an order
// @access  Private (Authenticated users)
router.post('/process',
  authenticateToken,
  paymentProcessingLimiter,
  validatePaymentProcessing,
  processPayment
);

// @route   POST /api/payment/intent
// @desc    Create payment intent
// @access  Private (Authenticated users)
router.post('/intent',
  authenticateToken,
  paymentLimiter,
  validatePaymentIntent,
  createPaymentIntent
);

// @route   POST /api/payment/confirm
// @desc    Confirm payment intent
// @access  Private (Authenticated users)
router.post('/confirm',
  authenticateToken,
  paymentProcessingLimiter,
  validatePaymentConfirmation,
  confirmPaymentIntent
);

// @route   GET /api/payment/history
// @desc    Get payment history for user
// @access  Private (Authenticated users)
router.get('/history',
  authenticateToken,
  validatePaymentQuery,
  getPaymentHistory
);

// @route   GET /api/payment/methods
// @desc    Get saved payment methods for user
// @access  Private (Authenticated users)
router.get('/methods',
  authenticateToken,
  getPaymentMethods
);

// @route   POST /api/payment/methods
// @desc    Save new payment method
// @access  Private (Authenticated users)
router.post('/methods',
  authenticateToken,
  validateSavePaymentMethod,
  savePaymentMethod
);

// @route   DELETE /api/payment/methods/:id
// @desc    Delete saved payment method
// @access  Private (Authenticated users)
router.delete('/methods/:id',
  authenticateToken,
  [
    param('id')
      .notEmpty()
      .withMessage('Payment method ID is required')
  ],
  deletePaymentMethod
);

// @route   POST /api/payment/methods/:id/validate
// @desc    Validate payment method
// @access  Private (Authenticated users)
router.post('/methods/:id/validate',
  authenticateToken,
  [
    param('id')
      .notEmpty()
      .withMessage('Payment method ID is required')
  ],
  validatePaymentMethod
);

// @route   GET /api/payment/transactions/:id
// @desc    Get transaction details
// @access  Private (Transaction owner or Admin)
router.get('/transactions/:id',
  authenticateToken,
  [
    param('id')
      .notEmpty()
      .withMessage('Transaction ID is required')
  ],
  getTransactionDetails
);

// @route   POST /api/payment/transactions/:id/dispute
// @desc    Dispute a transaction
// @access  Private (Transaction owner)
router.post('/transactions/:id/dispute',
  authenticateToken,
  [
    param('id')
      .notEmpty()
      .withMessage('Transaction ID is required'),
    body('reason')
      .isIn(['unauthorized', 'duplicate', 'fraud', 'product_not_received', 'product_unacceptable', 'other'])
      .withMessage('Invalid dispute reason'),
    body('description')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('evidence')
      .optional()
      .isArray()
      .withMessage('Evidence must be an array')
  ],
  disputeTransaction
);

// @route   POST /api/payment/schedule
// @desc    Schedule a payment
// @access  Private (Authenticated users)
router.post('/schedule',
  authenticateToken,
  paymentLimiter,
  validateScheduledPayment,
  schedulePayment
);

// @route   DELETE /api/payment/schedule/:id
// @desc    Cancel scheduled payment
// @access  Private (Payment owner or Admin)
router.delete('/schedule/:id',
  authenticateToken,
  [
    param('id')
      .notEmpty()
      .withMessage('Scheduled payment ID is required')
  ],
  cancelScheduledPayment
);

// @route   GET /api/payment/schedule
// @desc    Get scheduled payments for user
// @access  Private (Authenticated users)
router.get('/schedule',
  authenticateToken,
  [
    query('status')
      .optional()
      .isIn(['pending', 'active', 'paused', 'cancelled', 'completed'])
      .withMessage('Invalid schedule status')
  ],
  getScheduledPayments
);

// ADMIN ONLY ROUTES

// @route   POST /api/payment/refund
// @desc    Process refund
// @access  Private (Admin only)
router.post('/refund',
  authenticateToken,
  requireAdmin,
  refundLimiter,
  validateRefund,
  processRefund
);

// @route   POST /api/payment/partial-refund
// @desc    Process partial refund
// @access  Private (Admin only)
router.post('/partial-refund',
  authenticateToken,
  requireAdmin,
  refundLimiter,
  [
    body('orderId')
      .notEmpty()
      .withMessage('Order ID is required'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('Items to refund must be specified'),
    body('items.*.productId')
      .notEmpty()
      .withMessage('Product ID is required for each item'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Quantity must be at least 1'),
    body('reason')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Refund reason is required')
  ],
  processPartialRefund
);

// @route   GET /api/payment/refunds
// @desc    Get refund history
// @access  Private (Admin only)
router.get('/refunds',
  authenticateToken,
  requireAdmin,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled'])
      .withMessage('Invalid refund status'),
    query('orderId')
      .optional()
      .notEmpty()
      .withMessage('Order ID cannot be empty')
  ],
  getRefundHistory
);

// @route   GET /api/payment/admin/stats
// @desc    Get payment statistics
// @access  Private (Admin only)
router.get('/admin/stats',
  authenticateToken,
  requireAdmin,
  [
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y', 'custom'])
      .withMessage('Invalid period'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO date'),
    query('breakdown')
      .optional()
      .isIn(['daily', 'weekly', 'monthly'])
      .withMessage('Invalid breakdown period')
  ],
  getPaymentStats
);

// @route   GET /api/payment/admin/analytics
// @desc    Get detailed payment analytics
// @access  Private (Admin only)
router.get('/admin/analytics',
  authenticateToken,
  requireAdmin,
  [
    query('metric')
      .optional()
      .isIn(['revenue', 'transactions', 'success_rate', 'payment_methods', 'refunds'])
      .withMessage('Invalid metric'),
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Invalid period'),
    query('groupBy')
      .optional()
      .isIn(['payment_method', 'currency', 'country', 'status'])
      .withMessage('Invalid group by field')
  ],
  getPaymentAnalytics
);

// @route   GET /api/payment/admin/failed-payments
// @desc    Get failed payments for review
// @access  Private (Admin only)
router.get('/admin/failed-payments',
  authenticateToken,
  requireAdmin,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('reason')
      .optional()
      .isIn(['insufficient_funds', 'card_declined', 'expired_card', 'invalid_card', 'network_error'])
      .withMessage('Invalid failure reason')
  ],
  getFailedPayments
);

// @route   POST /api/payment/admin/retry-payment
// @desc    Retry failed payment
// @access  Private (Admin only)
router.post('/admin/retry-payment',
  authenticateToken,
  requireAdmin,
  [
    body('paymentId')
      .notEmpty()
      .withMessage('Payment ID is required'),
    body('useNewPaymentMethod')
      .optional()
      .isBoolean()
      .withMessage('Use new payment method must be a boolean'),
    body('notifyCustomer')
      .optional()
      .isBoolean()
      .withMessage('Notify customer must be a boolean')
  ],
  retryFailedPayment
);

// @route   PUT /api/payment/admin/gateway-config
// @desc    Update payment gateway configuration
// @access  Private (Admin only)
router.put('/admin/gateway-config',
  authenticateToken,
  requireAdmin,
  [
    body('gateway')
      .isIn(['stripe', 'paypal', 'square', 'braintree'])
      .withMessage('Invalid payment gateway'),
    body('isActive')
      .isBoolean()
      .withMessage('Is active must be a boolean'),
    body('settings')
      .isObject()
      .withMessage('Settings must be an object')
  ],
  updateGatewayConfig
);

// PUBLIC ROUTES (with signature verification)

// @route   POST /api/payment/webhook
// @desc    Handle payment gateway webhooks
// @access  Public (with signature verification)
router.post('/webhook',
  verifyWebhookSignature,
  [
    body('event')
      .notEmpty()
      .withMessage('Event type is required'),
    body('data')
      .isObject()
      .withMessage('Event data is required')
  ],
  handlePaymentWebhook
);

// @route   GET /api/payment/currencies
// @desc    Get supported currencies
// @access  Public
router.get('/currencies', (req, res) => {
  const supportedCurrencies = [
    { code: 'USD', name: 'US Dollar', symbol: ' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A }
  ];

  res.json({
    success: true,
    data: supportedCurrencies
  });
});

// @route   GET /api/payment/supported-methods
// @desc    Get supported payment methods
// @access  Public
router.get('/supported-methods', (req, res) => {
  const supportedMethods = [
    {
      id: 'credit_card',
      name: 'Credit Card',
      types: ['visa', 'mastercard', 'amex', 'discover'],
      isActive: true
    },
    {
      id: 'debit_card',
      name: 'Debit Card',
      types: ['visa', 'mastercard'],
      isActive: true
    },
    {
      id: 'paypal',
      name: 'PayPal',
      isActive: true
    },
    {
      id: 'apple_pay',
      name: 'Apple Pay',
      isActive: true
    },
    {
      id: 'google_pay',
      name: 'Google Pay',
      isActive: true
    },
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      isActive: true
    }
  ];

  res.json({
    success: true,
    data: supportedMethods
  });
});

// Middleware for payment security headers
router.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  });
  next();
});

// Middleware for PCI DSS compliance logging
router.use((req, res, next) => {
  // Log payment operations for PCI compliance (sanitize sensitive data)
  if (req.method !== 'GET' && req.originalUrl.includes('/payment/')) {
    const sanitizedBody = { ...req.body };
    
    // Remove sensitive card data from logs
    if (sanitizedBody.cardDetails) {
      sanitizedBody.cardDetails = {
        ...sanitizedBody.cardDetails,
        number: sanitizedBody.cardDetails.number ? '****' + sanitizedBody.cardDetails.number.slice(-4) : undefined,
        cvv: sanitizedBody.cardDetails.cvv ? '***' : undefined
      };
    }

    console.log('Payment Operation:', {
      method: req.method,
      url: req.originalUrl,
      user: req.user?.userId,
      userRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: sanitizedBody,
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// Error handling middleware specific to payment routes
router.use((error, req, res, next) => {
  // Log payment errors (without sensitive data)
  console.error('Payment Route Error:', {
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    user: req.user?.userId,
    timestamp: new Date().toISOString()
  });

  // Handle specific payment errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Payment validation failed',
      errors: error.details
    });
  }

  if (error.message === 'PAYMENT_FAILED') {
    return res.status(402).json({
      success: false,
      message: 'Payment processing failed',
      errorCode: 'PAYMENT_DECLINED'
    });
  }

  if (error.message === 'INSUFFICIENT_FUNDS') {
    return res.status(402).json({
      success: false,
      message: 'Insufficient funds',
      errorCode: 'INSUFFICIENT_FUNDS'
    });
  }

  if (error.message === 'INVALID_CARD') {
    return res.status(400).json({
      success: false,
      message: 'Invalid card details',
      errorCode: 'INVALID_CARD'
    });
  }

  if (error.message === 'CARD_DECLINED') {
    return res.status(402).json({
      success: false,
      message: 'Card was declined',
      errorCode: 'CARD_DECLINED'
    });
  }

  if (error.message === 'PAYMENT_INTENT_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      message: 'Payment intent not found'
    });
  }

  if (error.message === 'REFUND_FAILED') {
    return res.status(400).json({
      success: false,
      message: 'Refund processing failed'
    });
  }

  if (error.message === 'GATEWAY_ERROR') {
    return res.status(502).json({
      success: false,
      message: 'Payment gateway temporarily unavailable',
      errorCode: 'GATEWAY_ERROR'
    });
  }

  if (error.message === 'WEBHOOK_VERIFICATION_FAILED') {
    return res.status(401).json({
      success: false,
      message: 'Webhook verification failed'
    });
  }

  // Generic error response (don't expose sensitive details)
  res.status(500).json({
    success: false,
    message: 'Payment service temporarily unavailable',
    errorCode: 'INTERNAL_ERROR'
  });
});

module.exports = router;