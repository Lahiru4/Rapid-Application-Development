const express = require('express');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  getProductCategories,
  searchProducts,
  getLowStockProducts
} = require('../controllers/productController');
const auth = require('../middleware/auth');
const { body } = require('express-validator');

const router = express.Router();

// Validation for creating/updating products
const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer')
];

// Public routes
router.get('/', getAllProducts);
router.get('/search', searchProducts);
router.get('/categories', getProductCategories);
router.get('/:id', getProductById);

// Protected routes (require authentication)
router.post('/', auth, productValidation, createProduct);
router.put('/:id', auth, productValidation, updateProduct);
router.delete('/:id', auth, deleteProduct);
router.patch('/:id/stock', auth, updateProductStock);
router.get('/admin/low-stock', auth, getLowStockProducts);

module.exports = router;