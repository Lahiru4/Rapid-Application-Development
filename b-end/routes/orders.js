// routes/orders.js - Order Routes

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query, param } = require('express-validator');

// Import controllers
const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  getOrderStats,
  getOrderActivities,
  addOrderNote,
  updateShippingAddress,
  getOrderInvoice,
  resendOrderConfirmation,
  trackOrder,
  estimateDelivery,
  bulkUpdateOrders,
  exportOrders
} = require('../controllers/orderController');

// Import middleware
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validation');

const router = express.Router();

// Rate limiting for order creation
const orderCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each user to 10 order creation attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many order creation attempts, please try again later.'
  },
  keyGenerator: (req) => {
    // Use user ID for authenticated users, IP for others
    return req.user ? req.user.userId : req.ip;
  }
});

// Rate limiting for general order operations
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit to 100 order-related requests per 15 minutes
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

// Validation for order creation
const validateOrderCreation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required for each item'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
  body('shippingAddress')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Shipping address must be between 10 and 500 characters'),
  body('paymentMethod')
    .optional()
    .isIn(['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  body('discountCode')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Discount code must be between 3 and 50 characters')
];

// Validation for order queries
const validateOrderQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Invalid order status'),
  query('paymentStatus')
    .optional()
    .isIn(['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'])
    .withMessage('Invalid payment status'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'totalAmount', 'status', 'orderNumber'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO date')
];

// Validation for order ID parameter
const validateOrderId = [
  param('id')
    .notEmpty()
    .withMessage('Order ID is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Invalid order ID format')
];

// Validation for status updates
const validateStatusUpdate = [
  body('status')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Invalid order status'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  body('trackingNumber')
    .optional()
    .trim()
    .isLength({ min: 5, max: 50 })
    .withMessage('Tracking number must be between 5 and 50 characters'),
  body('estimatedDelivery')
    .optional()
    .isISO8601()
    .withMessage('Estimated delivery must be a valid date')
];

// Validation for payment status updates
const validatePaymentStatusUpdate = [
  body('paymentStatus')
    .isIn(['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'])
    .withMessage('Invalid payment status'),
  body('transactionId')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Transaction ID must be between 5 and 100 characters'),
  body('paymentMethod')
    .optional()
    .isIn(['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer'])
    .withMessage('Invalid payment method')
];

// Validation for shipping address updates
const validateShippingUpdate = [
  body('shippingAddress')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Shipping address must be between 10 and 500 characters'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason cannot exceed 200 characters')
];

// AUTHENTICATED USER ROUTES

// @route   POST /api/orders
// @desc    Create new order
// @access  Private (Authenticated users)
router.post('/',
  authenticateToken,
  orderCreationLimiter,
  validateOrderCreation,
  createOrder
);

// @route   GET /api/orders
// @desc    Get user orders (own orders for customers, all orders for admin)
// @access  Private (Authenticated users)
router.get('/',
  authenticateToken,
  orderLimiter,
  validateOrderQuery,
  getUserOrders
);

// @route   GET /api/orders/:id
// @desc    Get single order by ID
// @access  Private (Order owner or Admin)
router.get('/:id',
  authenticateToken,
  orderLimiter,
  validateOrderId,
  getOrderById
);

// @route   DELETE /api/orders/:id
// @desc    Cancel order
// @access  Private (Order owner or Admin)
router.delete('/:id',
  authenticateToken,
  validateOrderId,
  [
    body('reason')
      .optional()
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Cancellation reason must be between 5 and 200 characters')
  ],
  cancelOrder
);

// @route   GET /api/orders/:id/activities
// @desc    Get order activities/history
// @access  Private (Order owner or Admin)
router.get('/:id/activities',
  authenticateToken,
  orderLimiter,
  validateOrderId,
  getOrderActivities
);

// @route   GET /api/orders/:id/invoice
// @desc    Get order invoice
// @access  Private (Order owner or Admin)
router.get('/:id/invoice',
  authenticateToken,
  validateOrderId,
  [
    query('format')
      .optional()
      .isIn(['pdf', 'html', 'json'])
      .withMessage('Format must be pdf, html, or json')
  ],
  getOrderInvoice
);

// @route   GET /api/orders/:id/tracking
// @desc    Track order status
// @access  Private (Order owner or Admin)
router.get('/:id/tracking',
  authenticateToken,
  orderLimiter,
  validateOrderId,
  trackOrder
);

// @route   POST /api/orders/:id/resend-confirmation
// @desc    Resend order confirmation email
// @access  Private (Order owner or Admin)
router.post('/:id/resend-confirmation',
  authenticateToken,
  validateOrderId,
  resendOrderConfirmation
);

// @route   PUT /api/orders/:id/shipping-address
// @desc    Update shipping address (only if order not shipped)
// @access  Private (Order owner or Admin)
router.put('/:id/shipping-address',
  authenticateToken,
  validateOrderId,
  validateShippingUpdate,
  updateShippingAddress
);

// @route   POST /api/orders/:id/notes
// @desc    Add note to order
// @access  Private (Order owner or Admin)
router.post('/:id/notes',
  authenticateToken,
  validateOrderId,
  [
    body('note')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Note must be between 5 and 500 characters'),
    body('isPrivate')
      .optional()
      .isBoolean()
      .withMessage('isPrivate must be a boolean value')
  ],
  addOrderNote
);

// ADMIN ONLY ROUTES

// @route   PATCH /api/orders/:id/status
// @desc    Update order status
// @access  Private (Admin only)
router.patch('/:id/status',
  authenticateToken,
  requireAdmin,
  validateOrderId,
  validateStatusUpdate,
  updateOrderStatus
);

// @route   PATCH /api/orders/:id/payment-status
// @desc    Update payment status
// @access  Private (Admin only)
router.patch('/:id/payment-status',
  authenticateToken,
  requireAdmin,
  validateOrderId,
  validatePaymentStatusUpdate,
  updatePaymentStatus
);

// @route   GET /api/orders/admin/stats
// @desc    Get order statistics
// @access  Private (Admin only)
router.get('/admin/stats',
  authenticateToken,
  requireAdmin,
  [
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y', 'custom'])
      .withMessage('Period must be 7d, 30d, 90d, 1y, or custom'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO date'),
    query('groupBy')
      .optional()
      .isIn(['day', 'week', 'month'])
      .withMessage('Group by must be day, week, or month')
  ],
  getOrderStats
);

// @route   PUT /api/orders/admin/bulk-update
// @desc    Bulk update orders
// @access  Private (Admin only)
router.put('/admin/bulk-update',
  authenticateToken,
  requireAdmin,
  [
    body('orderIds')
      .isArray({ min: 1, max: 100 })
      .withMessage('Order IDs must be an array with 1-100 items'),
    body('updates')
      .isObject()
      .withMessage('Updates must be an object'),
    body('updates.status')
      .optional()
      .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
      .withMessage('Invalid status'),
    body('updates.paymentStatus')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'failed', 'refunded'])
      .withMessage('Invalid payment status')
  ],
  bulkUpdateOrders
);

// @route   GET /api/orders/admin/export
// @desc    Export orders to CSV/Excel
// @access  Private (Admin only)
router.get('/admin/export',
  authenticateToken,
  requireAdmin,
  [
    query('format')
      .optional()
      .isIn(['csv', 'xlsx', 'json'])
      .withMessage('Format must be csv, xlsx, or json'),
    query('status')
      .optional()
      .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
      .withMessage('Invalid status filter'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be a valid ISO date'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be a valid ISO date'),
    query('includeItems')
      .optional()
      .isBoolean()
      .withMessage('Include items must be a boolean')
  ],
  exportOrders
);

// @route   GET /api/orders/admin/pending-review
// @desc    Get orders pending admin review
// @access  Private (Admin only)
router.get('/admin/pending-review',
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
    query('priority')
      .optional()
      .isIn(['high', 'medium', 'low'])
      .withMessage('Priority must be high, medium, or low')
  ],
  getPendingReviewOrders
);

// @route   POST /api/orders/:id/estimate-delivery
// @desc    Calculate estimated delivery date
// @access  Private (Admin only)
router.post('/:id/estimate-delivery',
  authenticateToken,
  requireAdmin,
  validateOrderId,
  [
    body('shippingMethod')
      .optional()
      .isIn(['standard', 'express', 'overnight', 'pickup'])
      .withMessage('Invalid shipping method'),
    body('location')
      .optional()
      .isObject()
      .withMessage('Location must be an object'),
    body('location.zipCode')
      .optional()
      .isPostalCode('any')
      .withMessage('Invalid zip code'),
    body('location.country')
      .optional()
      .isISO31661Alpha2()
      .withMessage('Invalid country code')
  ],
  estimateDelivery
);

// @route   POST /api/orders/:id/assign-courier
// @desc    Assign courier to order
// @access  Private (Admin only)
router.post('/:id/assign-courier',
  authenticateToken,
  requireAdmin,
  validateOrderId,
  [
    body('courierId')
      .notEmpty()
      .withMessage('Courier ID is required'),
    body('courierName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Courier name must be between 2 and 100 characters'),
    body('trackingNumber')
      .optional()
      .trim()
      .isLength({ min: 5, max: 50 })
      .withMessage('Tracking number must be between 5 and 50 characters')
  ],
  assignCourier
);

// @route   GET /api/orders/admin/analytics
// @desc    Get detailed order analytics
// @access  Private (Admin only)
router.get('/admin/analytics',
  authenticateToken,
  requireAdmin,
  [
    query('metric')
      .optional()
      .isIn(['revenue', 'orders', 'customers', 'products', 'geography'])
      .withMessage('Invalid metric'),
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Invalid period'),
    query('granularity')
      .optional()
      .isIn(['hour', 'day', 'week', 'month'])
      .withMessage('Invalid granularity')
  ],
  getOrderAnalytics
);

// @route   POST /api/orders/:id/refund-items
// @desc    Refund specific items from an order
// @access  Private (Admin only)
router.post('/:id/refund-items',
  authenticateToken,
  requireAdmin,
  validateOrderId,
  [
    body('items')
      .isArray({ min: 1 })
      .withMessage('Items to refund must be an array with at least one item'),
    body('items.*.productId')
      .notEmpty()
      .withMessage('Product ID is required'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Quantity must be at least 1'),
    body('reason')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Refund reason must be between 5 and 500 characters'),
    body('refundShipping')
      .optional()
      .isBoolean()
      .withMessage('Refund shipping must be a boolean')
  ],
  refundOrderItems
);

// Middleware for order-specific logging
router.use((req, res, next) => {
  // Log order operations for audit purposes
  if (req.method !== 'GET') {
    console.log('Order Operation:', {
      method: req.method,
      url: req.originalUrl,
      user: req.user?.userId,
      userRole: req.user?.role,
      orderId: req.params.id,
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// Error handling middleware specific to order routes
router.use((error, req, res, next) => {
  // Log order-related errors
  console.error('Order Route Error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    params: req.params,
    user: req.user?.userId,
    timestamp: new Date().toISOString()
  });

  // Handle specific order errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Order validation failed',
      errors: error.details
    });
  }

  if (error.message === 'ORDER_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  if (error.message === 'INSUFFICIENT_STOCK') {
    return res.status(400).json({
      success: false,
      message: 'Insufficient stock for one or more items in your order'
    });
  }

  if (error.message === 'ORDER_ALREADY_CANCELLED') {
    return res.status(400).json({
      success: false,
      message: 'Order has already been cancelled'
    });
  }

  if (error.message === 'ORDER_CANNOT_BE_MODIFIED') {
    return res.status(400).json({
      success: false,
      message: 'Order cannot be modified in its current status'
    });
  }

  if (error.message === 'INVALID_ORDER_STATUS_TRANSITION') {
    return res.status(400).json({
      success: false,
      message: 'Invalid order status transition'
    });
  }

  if (error.message === 'PAYMENT_REQUIRED') {
    return res.status(402).json({
      success: false,
      message: 'Payment is required to complete this order'
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    message: 'Order service temporarily unavailable'
  });
});

module.exports = router;