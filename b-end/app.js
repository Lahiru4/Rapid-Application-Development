// app.js - Express Application Setup
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Create Express app
const app = express();

// Initialize authentication configuration
try {
  const { initializeAuth } = require('./config/auth');
  initializeAuth();
} catch (error) {
  console.warn('⚠️  Auth config not found, using basic setup');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS: Origin ${origin} not allowed`);
      callback(null, true); // Allow for development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Coffee Shop API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Coffee Shop E-commerce API',
    version: '1.0.0',
    documentation: {
      authentication: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      payments: '/api/payment'
    },
    endpoints: {
      auth: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'POST /api/auth/logout',
        'GET /api/auth/profile'
      ],
      products: [
        'GET /api/products',
        'GET /api/products/:id',
        'POST /api/products (admin)',
        'PUT /api/products/:id (admin)',
        'DELETE /api/products/:id (admin)'
      ],
      orders: [
        'POST /api/orders',
        'GET /api/orders',
        'GET /api/orders/:id',
        'PATCH /api/orders/:id/status (admin)'
      ],
      payments: [
        'POST /api/payment/process',
        'POST /api/payment/intent',
        'POST /api/payment/refund (admin)'
      ]
    }
  });
});

// Import and use routes
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.warn('⚠️  Auth routes not found, skipping...');
}

try {
  const productRoutes = require('./routes/products');
  app.use('/api/products', productRoutes);
  console.log('✅ Product routes loaded');
} catch (error) {
  console.warn('⚠️  Product routes not found, skipping...');
}

try {
  const orderRoutes = require('./routes/orders');
  app.use('/api/orders', orderRoutes);
  console.log('✅ Order routes loaded');
} catch (error) {
  console.warn('⚠️  Order routes not found, skipping...');
}

try {
  const paymentRoutes = require('./routes/payment');
  app.use('/api/payment', paymentRoutes);
  console.log('✅ Payment routes loaded');
} catch (error) {
  console.warn('⚠️  Payment routes not found, skipping...');
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: '/api'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Coffee Shop E-commerce Backend API',
    version: '1.0.0',
    status: 'Server is running',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      payments: '/api/payment'
    }
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Global Error Handler:', {
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details || error.message
    });
  }

  if (error.name === 'UnauthorizedError' || error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry'
    });
  }

  // Generic error response
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// 404 handler for non-API routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    suggestion: 'Try /api for API endpoints or /health for health check'
  });
});

module.exports = app;