const express = require('express');
const {
  processPayment,
  createPaymentIntent,
  confirmPaymentIntent,
  processRefund,
  getPaymentHistory,
  getRefundHistory,
  getPaymentStats,
  handlePaymentWebhook
} = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const { body } = require('express-validator');

const router = express.Router();

// Admin middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Validation for payment processing
const paymentValidation = [
  body('orderId').notEmpty().withMessage('Order ID is required'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
];

// Validation for refund processing
const refundValidation = [
  body('orderId').notEmpty().withMessage('Order ID is required'),
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('reason').optional().trim().isLength({ min: 3 }).withMessage('Reason must be at least 3 characters')
];

// Public routes
router.post('/webhook', handlePaymentWebhook);

// Protected routes (require authentication)
router.use(auth);

// User routes
router.post('/process', paymentValidation, processPayment);
router.post('/intent', createPaymentIntent);
router.post('/confirm', confirmPaymentIntent);
router.get('/history', getPaymentHistory);

// Admin only routes
router.post('/refund', adminOnly, refundValidation, processRefund);
router.get('/refunds', adminOnly, getRefundHistory);
router.get('/stats', adminOnly, getPaymentStats);

module.exports = router;