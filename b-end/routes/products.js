// routes/products.js - Product Routes

const express = require('express');
const rateLimit = require('express-rate-limit');
const { query, param } = require('express-validator');

// Import controllers
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  getProductCategories,
  searchProducts,
  getLowStockProducts,
  bulkUpdateProducts,
  getProductAnalytics,
  uploadProductImage,
  deleteProductImage,
  getProductReviews,
  addProductReview,
  updateProductReview,
  deleteProductReview
} = require('../controllers/productController');

// Import middleware
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateProduct } = require('../middleware/validation');
const upload = require('../middleware/upload'); // For file uploads

const router = express.Router();

// Rate limiting for product creation/updates (admin operations)
const adminProductLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit admin to 50 product operations per 15 minutes
  message: {
    success: false,
    message: 'Too many product operations, please try again later.'
  }
});

// Rate limiting for general product access
const productLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit to 1000 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

// Validation middleware for product queries
const validateProductQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['name', 'price', 'createdAt', 'stock', 'category'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a positive number'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number'),
  query('category')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search term must be between 2 and 100 characters'),
  query('inStock')
    .optional()
    .isBoolean()
    .withMessage('inStock must be a boolean value')
];

// Validation for product ID parameter
const validateProductId = [
  param('id')
    .notEmpty()
    .withMessage('Product ID is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Invalid product ID format')
];

// Validation for stock update
const validateStockUpdate = [
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('operation')
    .optional()
    .isIn(['set', 'increment', 'decrement'])
    .withMessage('Operation must be set, increment, or decrement')
];

// Validation for search queries
const validateSearch = [
  query('q')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// PUBLIC ROUTES

// @route   GET /api/products
// @desc    Get all products with filtering, sorting, and pagination
// @access  Public
router.get('/', 
  productLimiter,
  validateProductQuery,
  getAllProducts
);

// @route   GET /api/products/search
// @desc    Search products by name, description, or category
// @access  Public
router.get('/search',
  productLimiter,
  validateSearch,
  searchProducts
);

// @route   GET /api/products/categories
// @desc    Get all product categories
// @access  Public
router.get('/categories',
  productLimiter,
  getProductCategories
);

// @route   GET /api/products/:id
// @desc    Get single product by ID
// @access  Public
router.get('/:id',
  productLimiter,
  validateProductId,
  getProductById
);

// @route   GET /api/products/:id/reviews
// @desc    Get product reviews
// @access  Public
router.get('/:id/reviews',
  productLimiter,
  validateProductId,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'rating', 'helpful'])
      .withMessage('Invalid sort field for reviews')
  ],
  getProductReviews
);

// AUTHENTICATED USER ROUTES

// @route   POST /api/products/:id/reviews
// @desc    Add product review
// @access  Private (Authenticated users who purchased the product)
router.post('/:id/reviews',
  authenticateToken,
  validateProductId,
  [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('title')
      .trim()
      .isLength({ min: 5, max: 100 })
      .withMessage('Review title must be between 5 and 100 characters'),
    body('comment')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Review comment must be between 10 and 1000 characters'),
    body('wouldRecommend')
      .optional()
      .isBoolean()
      .withMessage('Would recommend must be a boolean value')
  ],
  addProductReview
);

// @route   PUT /api/products/:productId/reviews/:reviewId
// @desc    Update product review
// @access  Private (Review owner only)
router.put('/:productId/reviews/:reviewId',
  authenticateToken,
  [
    param('productId').notEmpty().withMessage('Product ID is required'),
    param('reviewId').notEmpty().withMessage('Review ID is required'),
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 5, max: 100 })
      .withMessage('Review title must be between 5 and 100 characters'),
    body('comment')
      .optional()
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Review comment must be between 10 and 1000 characters')
  ],
  updateProductReview
);

// @route   DELETE /api/products/:productId/reviews/:reviewId
// @desc    Delete product review
// @access  Private (Review owner or Admin)
router.delete('/:productId/reviews/:reviewId',
  authenticateToken,
  [
    param('productId').notEmpty().withMessage('Product ID is required'),
    param('reviewId').notEmpty().withMessage('Review ID is required')
  ],
  deleteProductReview
);

// ADMIN ONLY ROUTES

// @route   POST /api/products
// @desc    Create new product
// @access  Private (Admin only)
router.post('/',
  authenticateToken,
  requireAdmin,
  adminProductLimiter,
  validateProduct,
  createProduct
);

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private (Admin only)
router.put('/:id',
  authenticateToken,
  requireAdmin,
  adminProductLimiter,
  validateProductId,
  validateProduct,
  updateProduct
);

// @route   DELETE /api/products/:id
// @desc    Delete product (soft delete)
// @access  Private (Admin only)
router.delete('/:id',
  authenticateToken,
  requireAdmin,
  adminProductLimiter,
  validateProductId,
  deleteProduct
);

// @route   PATCH /api/products/:id/stock
// @desc    Update product stock
// @access  Private (Admin only)
router.patch('/:id/stock',
  authenticateToken,
  requireAdmin,
  validateProductId,
  validateStockUpdate,
  updateProductStock
);

// @route   GET /api/products/admin/low-stock
// @desc    Get products with low stock
// @access  Private (Admin only)
router.get('/admin/low-stock',
  authenticateToken,
  requireAdmin,
  [
    query('threshold')
      .optional()
      .isInt({ min: 0, max: 1000 })
      .withMessage('Threshold must be between 0 and 1000')
  ],
  getLowStockProducts
);

// @route   GET /api/products/admin/analytics
// @desc    Get product analytics
// @access  Private (Admin only)
router.get('/admin/analytics',
  authenticateToken,
  requireAdmin,
  [
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Period must be 7d, 30d, 90d, or 1y'),
    query('category')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters')
  ],
  getProductAnalytics
);

// @route   PUT /api/products/admin/bulk-update
// @desc    Bulk update products
// @access  Private (Admin only)
router.put('/admin/bulk-update',
  authenticateToken,
  requireAdmin,
  adminProductLimiter,
  [
    body('productIds')
      .isArray({ min: 1, max: 100 })
      .withMessage('Product IDs must be an array with 1-100 items'),
    body('updates')
      .isObject()
      .withMessage('Updates must be an object'),
    body('updates.price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('updates.category')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    body('updates.isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  bulkUpdateProducts
);

// @route   POST /api/products/:id/images
// @desc    Upload product image
// @access  Private (Admin only)
router.post('/:id/images',
  authenticateToken,
  requireAdmin,
  validateProductId,
  upload.single('image'), // Multer middleware for file upload
  uploadProductImage
);

// @route   DELETE /api/products/:id/images/:imageId
// @desc    Delete product image
// @access  Private (Admin only)
router.delete('/:id/images/:imageId',
  authenticateToken,
  requireAdmin,
  [
    param('id').notEmpty().withMessage('Product ID is required'),
    param('imageId').notEmpty().withMessage('Image ID is required')
  ],
  deleteProductImage
);

// @route   POST /api/products/:id/duplicate
// @desc    Duplicate product
// @access  Private (Admin only)
router.post('/:id/duplicate',
  authenticateToken,
  requireAdmin,
  validateProductId,
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('New product name must be between 2 and 100 characters')
  ],
  duplicateProduct
);

// @route   PUT /api/products/:id/visibility
// @desc    Toggle product visibility
// @access  Private (Admin only)
router.put('/:id/visibility',
  authenticateToken,
  requireAdmin,
  validateProductId,
  [
    body('isActive')
      .isBoolean()
      .withMessage('isActive must be a boolean value')
  ],
  toggleProductVisibility
);

// @route   GET /api/products/:id/stock-history
// @desc    Get product stock history
// @access  Private (Admin only)
router.get('/:id/stock-history',
  authenticateToken,
  requireAdmin,
  validateProductId,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  getProductStockHistory
);

// @route   POST /api/products/import
// @desc    Import products from CSV
// @access  Private (Admin only)
router.post('/import',
  authenticateToken,
  requireAdmin,
  upload.single('csvFile'),
  [
    body('overwriteExisting')
      .optional()
      .isBoolean()
      .withMessage('overwriteExisting must be a boolean'),
    body('validateOnly')
      .optional()
      .isBoolean()
      .withMessage('validateOnly must be a boolean')
  ],
  importProducts
);

// @route   GET /api/products/export
// @desc    Export products to CSV
// @access  Private (Admin only)
router.get('/export',
  authenticateToken,
  requireAdmin,
  [
    query('format')
      .optional()
      .isIn(['csv', 'xlsx', 'json'])
      .withMessage('Format must be csv, xlsx, or json'),
    query('category')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category filter invalid'),
    query('includeInactive')
      .optional()
      .isBoolean()
      .withMessage('includeInactive must be a boolean')
  ],
  exportProducts
);

// Specialized middleware for product routes
router.use((req, res, next) => {
  // Add product-specific headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  next();
});

// Error handling middleware specific to product routes
router.use((error, req, res, next) => {
  // Log product-related errors
  console.error('Product Route Error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    params: req.params,
    query: req.query,
    user: req.user?.userId,
    timestamp: new Date().toISOString()
  });

  // Handle specific product errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Product validation failed',
      errors: error.details
    });
  }

  if (error.name === 'MulterError') {
    let message = 'File upload error';
    if (error.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large. Maximum size is 5MB';
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files. Maximum is 10 files';
    }
    
    return res.status(400).json({
      success: false,
      message
    });
  }

  if (error.message === 'PRODUCT_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  if (error.message === 'INSUFFICIENT_STOCK') {
    return res.status(400).json({
      success: false,
      message: 'Insufficient stock for this operation'
    });
  }

  if (error.message === 'DUPLICATE_SKU') {
    return res.status(409).json({
      success: false,
      message: 'Product SKU already exists'
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    message: 'Product service temporarily unavailable'
  });
});

module.exports = router;