// controllers/orderController.js - Order Management Controller

const { db, admin } = require('../config/database');

/**
 * Create new order
 * @route POST /api/orders
 * @access Private (Authenticated users)
 */
const createOrder = async (req, res, next) => {
  try {
    const {
      items,
      shippingAddress,
      paymentMethod = 'pending',
      notes = '',
      discountCode = null
    } = req.body;

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    // Start a transaction to ensure data consistency
    const orderResult = await db.runTransaction(async (transaction) => {
      const orderItems = [];
      let totalAmount = 0;
      let totalItems = 0;

      // Validate each item and check stock availability
      for (const item of items) {
        const productRef = db.collection('products').doc(item.productId);
        const productDoc = await transaction.get(productRef);

        if (!productDoc.exists) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const product = productDoc.data();

        // Check if product is active
        if (!product.isActive) {
          throw new Error(`Product is no longer available: ${product.name}`);
        }

        // Check stock availability
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
        }

        // Calculate item total
        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;
        totalItems += item.quantity;

        // Prepare order item
        orderItems.push({
          productId: item.productId,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          total: itemTotal,
          sku: product.sku,
          imageUrl: product.imageUrl
        });

        // Update product stock
        transaction.update(productRef, {
          stock: admin.firestore.FieldValue.increment(-item.quantity),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Apply discount if provided
      let discountAmount = 0;
      let discountDetails = null;

      if (discountCode) {
        const discountRef = db.collection('discounts').doc(discountCode);
        const discountDoc = await transaction.get(discountRef);

        if (discountDoc.exists) {
          const discount = discountDoc.data();
          
          // Validate discount
          if (discount.isActive && 
              (!discount.expiresAt || discount.expiresAt.toDate() > new Date()) &&
              (!discount.minAmount || totalAmount >= discount.minAmount) &&
              (!discount.usageLimit || discount.usageCount < discount.usageLimit)) {
            
            if (discount.type === 'percentage') {
              discountAmount = (totalAmount * discount.value) / 100;
            } else if (discount.type === 'fixed') {
              discountAmount = Math.min(discount.value, totalAmount);
            }

            discountAmount = Math.round(discountAmount * 100) / 100; // Round to 2 decimal places
            totalAmount -= discountAmount;

            discountDetails = {
              code: discountCode,
              type: discount.type,
              value: discount.value,
              amount: discountAmount
            };

            // Update discount usage count
            transaction.update(discountRef, {
              usageCount: admin.firestore.FieldValue.increment(1),
              lastUsedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }

      // Calculate tax (8% for example)
      const taxRate = 0.08;
      const taxAmount = Math.round(totalAmount * taxRate * 100) / 100;
      const finalTotal = Math.round((totalAmount + taxAmount) * 100) / 100;

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create order data
      const orderData = {
        orderNumber,
        userId: req.user.userId,
        userEmail: req.user.email,
        items: orderItems,
        itemCount: totalItems,
        subtotal: totalAmount,
        taxAmount,
        discountAmount,
        discountDetails,
        totalAmount: finalTotal,
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod,
        shippingAddress: {
          fullAddress: shippingAddress,
          // You can expand this to include structured address fields
        },
        notes,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      };

      // Create order
      const orderRef = db.collection('orders').doc();
      transaction.set(orderRef, orderData);

      return {
        orderId: orderRef.id,
        orderData: {
          ...orderData,
          id: orderRef.id
        }
      };
    });

    // Log order creation
    await db.collection('orderActivities').add({
      orderId: orderResult.orderId,
      action: 'created',
      userId: req.user.userId,
      userEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        itemCount: orderResult.orderData.itemCount,
        totalAmount: orderResult.orderData.totalAmount
      }
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: orderResult.orderData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user orders with filtering
 * @route GET /api/orders
 * @access Private (Authenticated users)
 */
const getUserOrders = async (req, res, next) => {
  try {
    const {
      status,
      paymentStatus,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = db.collection('orders');

    // If not admin, only show user's own orders
    if (req.user.role !== 'admin') {
      query = query.where('userId', '==', req.user.userId);
    }

    // Apply filters BEFORE sorting to avoid index conflicts
    if (status) {
      query = query.where('status', '==', status);
    }

    if (paymentStatus) {
      query = query.where('paymentStatus', '==', paymentStatus);
    }

    // For complex sorting, we need to be careful with indexes
    // Let's simplify the sorting to avoid index requirements
    const validSortFields = ['createdAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    
    // Apply sorting
    query = query.orderBy(sortField, order);

    // Apply pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    
    // For better performance, use simple limit instead of offset
    query = query.limit(limitNum);

    const snapshot = await query.get();
    const orders = [];

    snapshot.forEach(doc => {
      const orderData = doc.data();
      orders.push({
        id: doc.id,
        ...orderData,
        createdAt: orderData.createdAt?.toDate(),
        updatedAt: orderData.updatedAt?.toDate(),
        estimatedDelivery: orderData.estimatedDelivery?.toDate()
      });
    });

    // Get total count separately (simpler query)
    let countQuery = db.collection('orders');
    if (req.user.role !== 'admin') {
      countQuery = countQuery.where('userId', '==', req.user.userId);
    }
    
    const totalSnapshot = await countQuery.get();
    const totalOrders = totalSnapshot.size;

    res.json({
      success: true,
      data: orders,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalOrders / limitNum),
        totalOrders,
        hasNextPage: orders.length === limitNum,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error in getUserOrders:', error);
    next(error);
  }
};

/**
 * Get single order by ID
 * @route GET /api/orders/:id
 * @access Private (Authenticated users)
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const orderDoc = await db.collection('orders').doc(id).get();

    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderData = orderDoc.data();

    // Check if user has access to this order
    if (req.user.role !== 'admin' && orderData.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: {
        id: orderDoc.id,
        ...orderData,
        createdAt: orderData.createdAt?.toDate(),
        updatedAt: orderData.updatedAt?.toDate(),
        estimatedDelivery: orderData.estimatedDelivery?.toDate()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status
 * @route PATCH /api/orders/:id/status
 * @access Private (Admin only)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes = '' } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const orderDoc = await db.collection('orders').doc(id).get();

    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const currentOrder = orderDoc.data();
    const previousStatus = currentOrder.status;

    // Handle stock restoration for cancelled orders
    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      await db.runTransaction(async (transaction) => {
        // Restore stock for cancelled orders
        for (const item of currentOrder.items) {
          const productRef = db.collection('products').doc(item.productId);
          transaction.update(productRef, {
            stock: admin.firestore.FieldValue.increment(item.quantity),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // Update order status
        transaction.update(db.collection('orders').doc(id), {
          status,
          previousStatus,
          statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          statusUpdatedBy: req.user.userId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(notes && { statusNotes: notes })
        });
      });
    } else {
      // Regular status update
      await db.collection('orders').doc(id).update({
        status,
        previousStatus,
        statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        statusUpdatedBy: req.user.userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(notes && { statusNotes: notes })
      });
    }

    // Log status change
    await db.collection('orderActivities').add({
      orderId: id,
      action: 'status_updated',
      userId: req.user.userId,
      userEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        previousStatus,
        newStatus: status,
        notes
      }
    });

    // Get updated order
    const updatedOrder = await db.collection('orders').doc(id).get();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        id: updatedOrder.id,
        ...updatedOrder.data()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order payment status
 * @route PATCH /api/orders/:id/payment
 * @access Private (Admin only)
 */
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus, transactionId, paymentMethod } = req.body;

    const validPaymentStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded'];
    
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }

    const orderDoc = await db.collection('orders').doc(id).get();

    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const updateData = {
      paymentStatus,
      paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentUpdatedBy: req.user.userId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (transactionId) {
      updateData.transactionId = transactionId;
    }

    if (paymentMethod) {
      updateData.paymentMethod = paymentMethod;
    }

    if (paymentStatus === 'completed') {
      updateData.paidAt = admin.firestore.FieldValue.serverTimestamp();
      // Automatically update order status to confirmed if payment is completed
      updateData.status = 'confirmed';
    }

    await db.collection('orders').doc(id).update(updateData);

    // Log payment status change
    await db.collection('orderActivities').add({
      orderId: id,
      action: 'payment_updated',
      userId: req.user.userId,
      userEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        paymentStatus,
        transactionId,
        paymentMethod
      }
    });

    const updatedOrder = await db.collection('orders').doc(id).get();

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: {
        id: updatedOrder.id,
        ...updatedOrder.data()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel order
 * @route DELETE /api/orders/:id
 * @access Private (Owner or Admin)
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by user' } = req.body;

    const orderDoc = await db.collection('orders').doc(id).get();

    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderData = orderDoc.data();

    // Check if user has permission to cancel
    if (req.user.role !== 'admin' && orderData.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if order can be cancelled
    const nonCancellableStatuses = ['shipped', 'delivered', 'cancelled'];
    if (nonCancellableStatuses.includes(orderData.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${orderData.status}`
      });
    }

    await db.runTransaction(async (transaction) => {
      // Restore stock
      for (const item of orderData.items) {
        const productRef = db.collection('products').doc(item.productId);
        transaction.update(productRef, {
          stock: admin.firestore.FieldValue.increment(item.quantity),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Update order
      transaction.update(db.collection('orders').doc(id), {
        status: 'cancelled',
        paymentStatus: 'refunded',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledBy: req.user.userId,
        cancellationReason: reason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // Log cancellation
    await db.collection('orderActivities').add({
      orderId: id,
      action: 'cancelled',
      userId: req.user.userId,
      userEmail: req.user.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        reason,
        previousStatus: orderData.status
      }
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order statistics (Admin only)
 * @route GET /api/orders/stats
 * @access Private (Admin only)
 */
const getOrderStats = async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    let startDate;
    const endDate = new Date();

    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get orders in date range
    const ordersSnapshot = await db.collection('orders')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .get();

    const stats = {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      statusBreakdown: {},
      paymentStatusBreakdown: {},
      topProducts: {},
      dailyStats: {}
    };

    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      stats.totalOrders++;
      stats.totalRevenue += order.totalAmount || 0;

      // Status breakdown
      stats.statusBreakdown[order.status] = (stats.statusBreakdown[order.status] || 0) + 1;
      
      // Payment status breakdown
      stats.paymentStatusBreakdown[order.paymentStatus] = (stats.paymentStatusBreakdown[order.paymentStatus] || 0) + 1;

      // Top products
      if (order.items) {
        order.items.forEach(item => {
          if (!stats.topProducts[item.productId]) {
            stats.topProducts[item.productId] = {
              name: item.name,
              quantity: 0,
              revenue: 0
            };
          }
          stats.topProducts[item.productId].quantity += item.quantity;
          stats.topProducts[item.productId].revenue += item.total;
        });
      }

      // Daily stats
      const orderDate = order.createdAt.toDate().toISOString().split('T')[0];
      if (!stats.dailyStats[orderDate]) {
        stats.dailyStats[orderDate] = {
          orders: 0,
          revenue: 0
        };
      }
      stats.dailyStats[orderDate].orders++;
      stats.dailyStats[orderDate].revenue += order.totalAmount || 0;
    });

    // Calculate average order value
    stats.averageOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;

    // Convert top products to array and sort
    stats.topProducts = Object.entries(stats.topProducts)
      .map(([productId, data]) => ({ productId, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    res.json({
      success: true,
      data: stats,
      period,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order activities/history
 * @route GET /api/orders/:id/activities
 * @access Private (Owner or Admin)
 */
const getOrderActivities = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if order exists and user has access
    const orderDoc = await db.collection('orders').doc(id).get();
    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderData = orderDoc.data();
    if (req.user.role !== 'admin' && orderData.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const activitiesSnapshot = await db.collection('orderActivities')
      .where('orderId', '==', id)
      .orderBy('timestamp', 'desc')
      .get();

    const activities = [];
    activitiesSnapshot.forEach(doc => {
      const activity = doc.data();
      activities.push({
        id: doc.id,
        ...activity,
        timestamp: activity.timestamp?.toDate()
      });
    });

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  getOrderStats,
  getOrderActivities
};