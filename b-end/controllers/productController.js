// controllers/productController.js - Product Management Controller

const { db, admin } = require('../config/database');

/**
 * Get all products with filtering and pagination
 * @route GET /api/products
 * @access Public
 */
const getAllProducts = async (req, res, next) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      inStock
    } = req.query;

    let query = db.collection('products');

    // Apply filters
    if (category) {
      query = query.where('category', '==', category.toLowerCase());
    }

    if (inStock === 'true') {
      query = query.where('stock', '>', 0);
    }

    if (minPrice || maxPrice) {
      if (minPrice) {
        query = query.where('price', '>=', parseFloat(minPrice));
      }
      if (maxPrice) {
        query = query.where('price', '<=', parseFloat(maxPrice));
      }
    }

    // Apply sorting
    const validSortFields = ['name', 'price', 'createdAt', 'stock'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    
    query = query.orderBy(sortField, order);

    // Apply pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    if (offset > 0) {
      // For pagination, we need to get the document to start after
      const offsetQuery = db.collection('products')
        .orderBy(sortField, order)
        .limit(offset);
      
      const offsetSnapshot = await offsetQuery.get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limitNum);

    const snapshot = await query.get();
    let products = [];

    snapshot.forEach(doc => {
      const productData = doc.data();
      products.push({
        id: doc.id,
        ...productData,
        createdAt: productData.createdAt?.toDate(),
        updatedAt: productData.updatedAt?.toDate()
      });
    });

    // Apply text search filter (client-side for Firestore)
    if (search) {
      const searchTerm = search.toLowerCase();
      products = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm) ||
        product.category.toLowerCase().includes(searchTerm)
      );
    }

    // Get total count for pagination
    const totalQuery = db.collection('products');
    const totalSnapshot = await totalQuery.get();
    const totalProducts = totalSnapshot.size;

    res.json({
      success: true,
      data: products,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalProducts / limitNum),
        totalProducts,
        hasNextPage: pageNum * limitNum < totalProducts,
        hasPrevPage: pageNum > 1
      },
      filters: {
        category,
        minPrice,
        maxPrice,
        search,
        sortBy: sortField,
        sortOrder: order,
        inStock
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single product by ID
 * @route GET /api/products/:id
 * @access Public
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const productDoc = await db.collection('products').doc(id).get();

    if (!productDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const productData = productDoc.data();

    res.json({
      success: true,
      data: {
        id: productDoc.id,
        ...productData,
        createdAt: productData.createdAt?.toDate(),
        updatedAt: productData.updatedAt?.toDate()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new product
 * @route POST /api/products
 * @access Private (Admin only)
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      category,
      imageUrl,
      stock,
      sku,
      tags = [],
      specifications = {}
    } = req.body;

    // Check if SKU already exists
    if (sku) {
      const skuQuery = await db.collection('products').where('sku', '==', sku).get();
      if (!skuQuery.empty) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }
    }

    const productData = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category: category.toLowerCase().trim(),
      imageUrl: imageUrl || null,
      stock: parseInt(stock),
      sku: sku || `SKU-${Date.now()}`,
      tags: tags.map(tag => tag.toLowerCase().trim()),
      specifications,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user.userId
    };

    const productRef = await db.collection('products').add(productData);
    const newProduct = await productRef.get();

    // Log activity
    await db.collection('productActivities').add({
      productId: productRef.id,
      action: 'created',
      userId: req.user.userId,
      userEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      changes: productData
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: newProduct.id,
        ...newProduct.data()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product
 * @route PUT /api/products/:id
 * @access Private (Admin only)
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      category,
      imageUrl,
      stock,
      sku,
      tags = [],
      specifications = {},
      isActive
    } = req.body;

    // Check if product exists
    const productDoc = await db.collection('products').doc(id).get();
    if (!productDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const currentData = productDoc.data();

    // Check if SKU already exists (if different from current)
    if (sku && sku !== currentData.sku) {
      const skuQuery = await db.collection('products').where('sku', '==', sku).get();
      if (!skuQuery.empty) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }
    }

    const updateData = {
      ...(name && { name: name.trim() }),
      ...(description && { description: description.trim() }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(category && { category: category.toLowerCase().trim() }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(stock !== undefined && { stock: parseInt(stock) }),
      ...(sku && { sku }),
      ...(tags.length > 0 && { tags: tags.map(tag => tag.toLowerCase().trim()) }),
      ...(Object.keys(specifications).length > 0 && { specifications }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.userId
    };

    await db.collection('products').doc(id).update(updateData);

    // Log activity
    await db.collection('productActivities').add({
      productId: id,
      action: 'updated',
      userId: req.user.userId,
      userEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      changes: updateData,
      previousData: currentData
    });

    const updatedProduct = await db.collection('products').doc(id).get();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: {
        id: updatedProduct.id,
        ...updatedProduct.data()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product
 * @route DELETE /api/products/:id
 * @access Private (Admin only)
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const productDoc = await db.collection('products').doc(id).get();
    if (!productDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const productData = productDoc.data();

    // Check if product is in any pending orders
    const pendingOrdersQuery = await db.collection('orders')
      .where('items', 'array-contains-any', [{ productId: id }])
      .where('status', 'in', ['pending', 'processing'])
      .get();

    if (!pendingOrdersQuery.empty) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete product that is in pending orders. Please complete or cancel orders first.'
      });
    }

    // Soft delete - mark as inactive instead of actual deletion
    await db.collection('products').doc(id).update({
      isActive: false,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: req.user.userId
    });

    // Log activity
    await db.collection('productActivities').add({
      productId: id,
      action: 'deleted',
      userId: req.user.userId,
      userEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      previousData: productData
    });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product stock
 * @route PATCH /api/products/:id/stock
 * @access Private (Admin only)
 */
const updateProductStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stock, operation = 'set' } = req.body; // operation: 'set', 'increment', 'decrement'

    const productDoc = await db.collection('products').doc(id).get();
    if (!productDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const currentData = productDoc.data();
    let newStock;

    switch (operation) {
      case 'increment':
        newStock = currentData.stock + parseInt(stock);
        break;
      case 'decrement':
        newStock = Math.max(0, currentData.stock - parseInt(stock));
        break;
      case 'set':
      default:
        newStock = parseInt(stock);
        break;
    }

    await db.collection('products').doc(id).update({
      stock: newStock,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.userId
    });

    // Log stock activity
    await db.collection('stockActivities').add({
      productId: id,
      operation,
      previousStock: currentData.stock,
      newStock,
      change: newStock - currentData.stock,
      userId: req.user.userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        previousStock: currentData.stock,
        newStock,
        change: newStock - currentData.stock
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product categories
 * @route GET /api/products/categories
 * @access Public
 */
const getProductCategories = async (req, res, next) => {
  try {
    const snapshot = await db.collection('products')
      .where('isActive', '==', true)
      .get();

    const categories = new Set();
    snapshot.forEach(doc => {
      const product = doc.data();
      if (product.category) {
        categories.add(product.category);
      }
    });

    res.json({
      success: true,
      data: Array.from(categories).sort()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search products
 * @route GET /api/products/search
 * @access Public
 */
const searchProducts = async (req, res, next) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchTerm = query.toLowerCase().trim();
    const snapshot = await db.collection('products')
      .where('isActive', '==', true)
      .limit(parseInt(limit))
      .get();

    const products = [];
    snapshot.forEach(doc => {
      const productData = doc.data();
      const product = {
        id: doc.id,
        ...productData
      };

      // Simple text matching (in production, consider using Algolia or Elasticsearch)
      if (
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm) ||
        product.category.toLowerCase().includes(searchTerm) ||
        product.tags?.some(tag => tag.includes(searchTerm))
      ) {
        products.push(product);
      }
    });

    res.json({
      success: true,
      data: products,
      query: searchTerm,
      total: products.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get low stock products
 * @route GET /api/products/low-stock
 * @access Private (Admin only)
 */
const getLowStockProducts = async (req, res, next) => {
  try {
    const { threshold = 10 } = req.query;

    const snapshot = await db.collection('products')
      .where('isActive', '==', true)
      .where('stock', '<=', parseInt(threshold))
      .orderBy('stock', 'asc')
      .get();

    const products = [];
    snapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      data: products,
      threshold: parseInt(threshold),
      total: products.length
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  getProductCategories,
  searchProducts,
  getLowStockProducts
};