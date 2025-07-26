const express = require('express');
const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  getOrderStats,
  getOrderActivities
} = require('../controllers/orderController');
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

// Validation for creating orders
const orderValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required for each item'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('shippingAddress')
    .trim()
    .notEmpty()
    .withMessage('Shipping address is required')
];

// All routes require authentication
router.use(auth);

// Order routes
router.post('/', orderValidation, createOrder);
router.get('/', getUserOrders);
router.get('/stats', adminOnly, getOrderStats);
router.get('/:id', getOrderById);
router.get('/:id/activities', getOrderActivities);
router.patch('/:id/status', adminOnly, updateOrderStatus);
router.patch('/:id/payment', adminOnly, updatePaymentStatus);
router.delete('/:id', cancelOrder);

module.exports = router;