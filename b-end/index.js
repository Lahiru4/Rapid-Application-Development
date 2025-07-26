// server.js - Main Server Entry Point
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 Coffee Shop Backend Server Started');
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Server running on port ${PORT}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
  console.log('📚 Available endpoints:');
  console.log('  - POST /api/auth/register');
  console.log('  - POST /api/auth/login');
  console.log('  - GET  /api/products');
  console.log('  - POST /api/orders');
  console.log('  - POST /api/payment/process');
  console.log('  - GET  /health');
  console.log('✅ Server ready to accept connections');
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  server.close(() => {
    console.log('📦 HTTP server closed');
    console.log('👋 Process terminated gracefully');
    process.exit(0);
  });

  // Force close server after 30 seconds
  setTimeout(() => {
    console.log('⏰ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle different termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = server;