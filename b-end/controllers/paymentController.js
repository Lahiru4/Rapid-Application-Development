// controllers/paymentController.js - Payment Processing Controller

const { db, admin } = require('../config/database');
const crypto = require('crypto');

/**
 * Process payment (Dummy implementation for educational purposes)
 * @route POST /api/payment/process
 * @access Private (Authenticated users)
 */
const processPayment = async (req, res, next) => {
  try {
    const {
      orderId,
      paymentMethod,
      amount,
      currency = 'USD',
      cardDetails = {},
      billingAddress = {}
    } = req.body;

    // Validate order exists and belongs to user
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderData = orderDoc.data();

    // Check if user owns the order
    if (orderData.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if order is in correct status
    if (orderData.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be paid in current status'
      });
    }

    // Check if payment is already processed
    if (orderData.paymentStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment already completed for this order'
      });
    }

    // Validate amount matches order total
    if (Math.abs(amount - orderData.totalAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount does not match order total'
      });
    }

    // Validate payment method
    const validPaymentMethods = ['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    // Dummy payment processing logic
    const paymentResult = await simulatePaymentProcessing({
      orderId,
      paymentMethod,
      amount,
      currency,
      cardDetails,
      billingAddress
    });

    if (paymentResult.success) {
      // Update order with payment information
      await db.collection('orders').doc(orderId).update({
        paymentStatus: 'completed',
        paymentMethod,
        transactionId: paymentResult.transactionId,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentDetails: {
          method: paymentMethod,
          currency,
          amount,
          transactionId: paymentResult.transactionId,
          gateway: paymentResult.gateway
        },
        status: 'confirmed', // Auto-confirm order on successful payment
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create payment record
      await db.collection('payments').add({
        orderId,
        userId: req.user.userId,
        transactionId: paymentResult.transactionId,
        amount,
        currency,
        paymentMethod,
        status: 'completed',
        gateway: paymentResult.gateway,
        gatewayResponse: paymentResult.gatewayResponse,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log payment activity
      await db.collection('orderActivities').add({
        orderId,
        action: 'payment_completed',
        userId: req.user.userId,
        userEmail: req.user.email,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          paymentMethod,
          amount,
          transactionId: paymentResult.transactionId
        }
      });

      res.json({
        success: true,
        message: 'Payment processed successfully',
        data: {
          transactionId: paymentResult.transactionId,
          status: 'completed',
          amount,
          currency,
          paymentMethod
        }
      });
    } else {
      // Payment failed - update order status
      await db.collection('orders').doc(orderId).update({
        paymentStatus: 'failed',
        paymentFailureReason: paymentResult.error,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create failed payment record
      await db.collection('payments').add({
        orderId,
        userId: req.user.userId,
        amount,
        currency,
        paymentMethod,
        status: 'failed',
        failureReason: paymentResult.error,
        gatewayResponse: paymentResult.gatewayResponse,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(400).json({
        success: false,
        message: paymentResult.error || 'Payment processing failed',
        errorCode: paymentResult.errorCode
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Create payment intent (for frontend payment form)
 * @route POST /api/payment/intent
 * @access Private (Authenticated users)
 */
const createPaymentIntent = async (req, res, next) => {
  try {
    const { orderId, paymentMethod = 'credit_card' } = req.body;

    // Validate order
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderData = orderDoc.data();

    if (orderData.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate payment intent (dummy data)
    const paymentIntent = {
      id: `pi_${crypto.randomBytes(16).toString('hex')}`,
      orderId,
      amount: orderData.totalAmount,
      currency: 'USD',
      paymentMethod,
      clientSecret: `pi_${crypto.randomBytes(24).toString('hex')}_secret_${crypto.randomBytes(8).toString('hex')}`,
      status: 'requires_payment_method',
      createdAt: new Date().toISOString()
    };

    // Store payment intent
    await db.collection('paymentIntents').doc(paymentIntent.id).set({
      ...paymentIntent,
      userId: req.user.userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    });

    res.json({
      success: true,
      data: paymentIntent
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm payment intent
 * @route POST /api/payment/confirm
 * @access Private (Authenticated users)
 */
const confirmPaymentIntent = async (req, res, next) => {
  try {
    const { paymentIntentId, paymentMethodDetails = {} } = req.body;

    // Get payment intent
    const intentDoc = await db.collection('paymentIntents').doc(paymentIntentId).get();
    
    if (!intentDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Payment intent not found'
      });
    }

    const intentData = intentDoc.data();

    // Check if expired
    if (intentData.expiresAt.toDate() < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent expired'
      });
    }

    // Check ownership
    if (intentData.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Process the actual payment
    const paymentResult = await processPayment({
      body: {
        orderId: intentData.orderId,
        paymentMethod: intentData.paymentMethod,
        amount: intentData.amount,
        currency: intentData.currency,
        cardDetails: paymentMethodDetails
      },
      user: { userId: req.user.userId }
    }, res, next);

    // Update payment intent status
    await db.collection('paymentIntents').doc(paymentIntentId).update({
      status: paymentResult.success ? 'succeeded' : 'failed',
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(paymentResult.transactionId && { transactionId: paymentResult.transactionId })
    });

    res.json({
      success: paymentResult.success,
      data: {
        paymentIntentId,
        status: paymentResult.success ? 'succeeded' : 'failed',
        ...(paymentResult.transactionId && { transactionId: paymentResult.transactionId })
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process refund
 * @route POST /api/payment/refund
 * @access Private (Admin only)
 */
const processRefund = async (req, res, next) => {
  try {
    const { orderId, amount, reason = 'Customer request' } = req.body;

    // Get order
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderData = orderDoc.data();

    // Check if order was paid
    if (orderData.paymentStatus !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Order payment not completed'
      });
    }

    // Validate refund amount
    const refundAmount = amount || orderData.totalAmount;
    if (refundAmount > orderData.totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount cannot exceed order total'
      });
    }

    // Check existing refunds
    const existingRefundsSnapshot = await db.collection('refunds')
      .where('orderId', '==', orderId)
      .where('status', '==', 'completed')
      .get();

    let totalRefunded = 0;
    existingRefundsSnapshot.forEach(doc => {
      totalRefunded += doc.data().amount;
    });

    if (totalRefunded + refundAmount > orderData.totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Total refund amount would exceed order total'
      });
    }

    // Simulate refund processing
    const refundResult = await simulateRefundProcessing({
      orderId,
      transactionId: orderData.transactionId,
      amount: refundAmount,
      originalAmount: orderData.totalAmount,
      paymentMethod: orderData.paymentMethod
    });

    if (refundResult.success) {
      const refundId = `ref_${crypto.randomBytes(16).toString('hex')}`;

      // Create refund record
      await db.collection('refunds').add({
        refundId,
        orderId,
        userId: orderData.userId,
        amount: refundAmount,
        originalTransactionId: orderData.transactionId,
        refundTransactionId: refundResult.refundTransactionId,
        reason,
        status: 'completed',
        processedBy: req.user.userId,
        gateway: refundResult.gateway,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update order payment status
      const isFullRefund = (totalRefunded + refundAmount) >= orderData.totalAmount;
      
      await db.collection('orders').doc(orderId).update({
        paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
        refundedAmount: admin.firestore.FieldValue.increment(refundAmount),
        lastRefundAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(isFullRefund && { status: 'cancelled' })
      });

      // Log refund activity
      await db.collection('orderActivities').add({
        orderId,
        action: 'refund_processed',
        userId: req.user.userId,
        userEmail: req.user.email,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          refundAmount,
          reason,
          refundId,
          isFullRefund
        }
      });

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: {
          refundId,
          amount: refundAmount,
          status: 'completed',
          refundTransactionId: refundResult.refundTransactionId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: refundResult.error || 'Refund processing failed'
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment history
 * @route GET /api/payment/history
 * @access Private (Authenticated users)
 */
const getPaymentHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, paymentMethod } = req.query;

    let query = db.collection('payments');

    // If not admin, only show user's payments
    if (req.user.role !== 'admin') {
      query = query.where('userId', '==', req.user.userId);
    }

    // Apply filters
    if (status) {
      query = query.where('status', '==', status);
    }

    if (paymentMethod) {
      query = query.where('paymentMethod', '==', paymentMethod);
    }

    // Apply sorting and pagination
    query = query.orderBy('createdAt', 'desc');

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    if (offset > 0) {
      const offsetQuery = db.collection('payments')
        .orderBy('createdAt', 'desc')
        .limit(offset);
      
      const offsetSnapshot = await offsetQuery.get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limitNum);

    const snapshot = await query.get();
    const payments = [];

    snapshot.forEach(doc => {
      const paymentData = doc.data();
      payments.push({
        id: doc.id,
        ...paymentData,
        createdAt: paymentData.createdAt?.toDate(),
        processedAt: paymentData.processedAt?.toDate(),
        failedAt: paymentData.failedAt?.toDate()
      });
    });

    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: pageNum,
        hasNextPage: payments.length === limitNum,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get refund history
 * @route GET /api/payment/refunds
 * @access Private (Admin only)
 */
const getRefundHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, orderId } = req.query;

    let query = db.collection('refunds');

    // Apply filters
    if (status) {
      query = query.where('status', '==', status);
    }

    if (orderId) {
      query = query.where('orderId', '==', orderId);
    }

    // Apply sorting and pagination
    query = query.orderBy('createdAt', 'desc');

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    if (offset > 0) {
      const offsetQuery = db.collection('refunds')
        .orderBy('createdAt', 'desc')
        .limit(offset);
      
      const offsetSnapshot = await offsetQuery.get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limitNum);

    const snapshot = await query.get();
    const refunds = [];

    snapshot.forEach(doc => {
      const refundData = doc.data();
      refunds.push({
        id: doc.id,
        ...refundData,
        createdAt: refundData.createdAt?.toDate(),
        processedAt: refundData.processedAt?.toDate()
      });
    });

    res.json({
      success: true,
      data: refunds,
      pagination: {
        currentPage: pageNum,
        hasNextPage: refunds.length === limitNum,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment statistics (Admin only)
 * @route GET /api/payment/stats
 * @access Private (Admin only)
 */
const getPaymentStats = async (req, res, next) => {
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

    // Get payments in date range
    const paymentsSnapshot = await db.collection('payments')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .get();

    // Get refunds in date range
    const refundsSnapshot = await db.collection('refunds')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .get();

    const stats = {
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      totalRevenue: 0,
      totalRefunds: 0,
      refundedAmount: 0,
      netRevenue: 0,
      averageTransactionValue: 0,
      paymentMethodBreakdown: {},
      dailyStats: {},
      successRate: 0
    };

    // Process payments
    paymentsSnapshot.forEach(doc => {
      const payment = doc.data();
      stats.totalPayments++;

      if (payment.status === 'completed') {
        stats.successfulPayments++;
        stats.totalRevenue += payment.amount || 0;

        // Payment method breakdown
        const method = payment.paymentMethod || 'unknown';
        if (!stats.paymentMethodBreakdown[method]) {
          stats.paymentMethodBreakdown[method] = {
            count: 0,
            amount: 0
          };
        }
        stats.paymentMethodBreakdown[method].count++;
        stats.paymentMethodBreakdown[method].amount += payment.amount || 0;
      } else if (payment.status === 'failed') {
        stats.failedPayments++;
      }

      // Daily stats
      const paymentDate = payment.createdAt.toDate().toISOString().split('T')[0];
      if (!stats.dailyStats[paymentDate]) {
        stats.dailyStats[paymentDate] = {
          payments: 0,
          revenue: 0,
          refunds: 0,
          refundAmount: 0
        };
      }
      stats.dailyStats[paymentDate].payments++;
      if (payment.status === 'completed') {
        stats.dailyStats[paymentDate].revenue += payment.amount || 0;
      }
    });

    // Process refunds
    refundsSnapshot.forEach(doc => {
      const refund = doc.data();
      if (refund.status === 'completed') {
        stats.totalRefunds++;
        stats.refundedAmount += refund.amount || 0;

        // Daily stats
        const refundDate = refund.createdAt.toDate().toISOString().split('T')[0];
        if (!stats.dailyStats[refundDate]) {
          stats.dailyStats[refundDate] = {
            payments: 0,
            revenue: 0,
            refunds: 0,
            refundAmount: 0
          };
        }
        stats.dailyStats[refundDate].refunds++;
        stats.dailyStats[refundDate].refundAmount += refund.amount || 0;
      }
    });

    // Calculate derived stats
    stats.netRevenue = stats.totalRevenue - stats.refundedAmount;
    stats.averageTransactionValue = stats.successfulPayments > 0 ? stats.totalRevenue / stats.successfulPayments : 0;
    stats.successRate = stats.totalPayments > 0 ? (stats.successfulPayments / stats.totalPayments) * 100 : 0;

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
 * Webhook handler for payment gateway notifications
 * @route POST /api/payment/webhook
 * @access Public (with verification)
 */
const handlePaymentWebhook = async (req, res, next) => {
  try {
    const { event, data } = req.body;
    const signature = req.headers['webhook-signature'];

    // Verify webhook signature (dummy implementation)
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    switch (event) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(data);
        break;
      case 'payment.failed':
        await handlePaymentFailed(data);
        break;
      case 'refund.completed':
        await handleRefundCompleted(data);
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    next(error);
  }
};

// Helper functions

/**
 * Simulate payment processing (dummy implementation)
 */
const simulatePaymentProcessing = async (paymentData) => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simulate success/failure (90% success rate)
  const success = Math.random() > 0.1;

  if (success) {
    return {
      success: true,
      transactionId: `txn_${crypto.randomBytes(16).toString('hex')}`,
      gateway: 'dummy_gateway',
      gatewayResponse: {
        status: 'completed',
        authCode: crypto.randomBytes(8).toString('hex').toUpperCase(),
        last4: paymentData.cardDetails?.number?.slice(-4) || '1234'
      }
    };
  } else {
    const errors = [
      'Insufficient funds',
      'Card declined',
      'Invalid card number',
      'Expired card',
      'Network error'
    ];
    
    return {
      success: false,
      error: errors[Math.floor(Math.random() * errors.length)],
      errorCode: `E${Math.floor(Math.random() * 9000) + 1000}`,
      gatewayResponse: {
        status: 'failed',
        declineCode: 'generic_decline'
      }
    };
  }
};

/**
 * Simulate refund processing (dummy implementation)
 */
const simulateRefundProcessing = async (refundData) => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Simulate success (95% success rate for refunds)
  const success = Math.random() > 0.05;

  if (success) {
    return {
      success: true,
      refundTransactionId: `ref_${crypto.randomBytes(16).toString('hex')}`,
      gateway: 'dummy_gateway'
    };
  } else {
    return {
      success: false,
      error: 'Refund processing failed'
    };
  }
};

/**
 * Verify webhook signature (dummy implementation)
 */
const verifyWebhookSignature = (payload, signature) => {
  // In a real implementation, you would verify the signature using your payment gateway's method
  // For example, with Stripe you would use their signature verification
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET || 'dummy_secret')
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
};

/**
 * Handle successful payment webhook
 */
const handlePaymentSucceeded = async (data) => {
  const { transactionId, orderId } = data;
  
  // Update order status
  await db.collection('orders').doc(orderId).update({
    paymentStatus: 'completed',
    status: 'confirmed',
    transactionId,
    webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp()
  });
};

/**
 * Handle failed payment webhook
 */
const handlePaymentFailed = async (data) => {
  const { transactionId, orderId, failureReason } = data;
  
  // Update order status
  await db.collection('orders').doc(orderId).update({
    paymentStatus: 'failed',
    paymentFailureReason: failureReason,
    webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp()
  });
};

/**
 * Handle completed refund webhook
 */
const handleRefundCompleted = async (data) => {
  const { refundId, orderId } = data;
  
  // Update refund status
  await db.collection('refunds')
    .where('refundId', '==', refundId)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        doc.ref.update({
          status: 'completed',
          webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
    });
};

module.exports = {
  processPayment,
  createPaymentIntent,
  confirmPaymentIntent,
  processRefund,
  getPaymentHistory,
  getRefundHistory,
  getPaymentStats,
  handlePaymentWebhook
};