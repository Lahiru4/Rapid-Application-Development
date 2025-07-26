const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT Configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  issuer: process.env.JWT_ISSUER || 'coffee-shop-api',
  audience: process.env.JWT_AUDIENCE || 'coffee-shop-users'
};

// Bcrypt Configuration
const bcryptConfig = {
  saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
};

// Token Generation
const generateToken = (payload, options = {}) => {
  const tokenOptions = {
    expiresIn: options.expiresIn || jwtConfig.expiresIn,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    ...options
  };

  return jwt.sign(payload, jwtConfig.secret, tokenOptions);
};

// Token Verification
const verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    }, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};

// Decode token without verification (useful for getting user info from expired tokens)
const decodeToken = (token) => {
  return jwt.decode(token);
};

// Password Hashing
const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(bcryptConfig.saltRounds);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};

// Password Verification
const verifyPassword = async (plainPassword, hashedPassword) => {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    throw new Error('Password verification failed');
  }
};

// Generate Access Token
const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'access'
  };

  return generateToken(payload, { expiresIn: '15m' });
};

// Generate Refresh Token
const generateRefreshToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    type: 'refresh'
  };

  return generateToken(payload, { expiresIn: '7d' });
};

// Generate Reset Password Token
const generateResetToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    type: 'reset',
    timestamp: Date.now()
  };

  return generateToken(payload, { expiresIn: '1h' });
};

// Token Blacklist (In production, use Redis or database)
const tokenBlacklist = new Set();

// Add token to blacklist
const blacklistToken = (token) => {
  tokenBlacklist.add(token);
};

// Check if token is blacklisted
const isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};

// Extract token from request header
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

// Validate JWT configuration
const validateJWTConfig = () => {
  if (!jwtConfig.secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  if (jwtConfig.secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  return true;
};

// Token payload validation
const validateTokenPayload = (payload) => {
  const requiredFields = ['userId', 'email', 'type'];
  
  for (const field of requiredFields) {
    if (!payload[field]) {
      throw new Error(`Token payload missing required field: ${field}`);
    }
  }

  return true;
};

// Create user session data
const createUserSession = (user) => {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    lastLogin: new Date()
  };
};

// Check password strength
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonalphas = /\W/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasNonalphas) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Generate random secure token (for password reset, email verification, etc.)
const generateSecureToken = (length = 32) => {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
};

// Calculate token expiration time
const getTokenExpiration = (token) => {
  try {
    const decoded = decodeToken(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Check if token is about to expire (within next 5 minutes)
const isTokenExpiringSoon = (token) => {
  const expiration = getTokenExpiration(token);
  if (!expiration) return true;

  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return expiration <= fiveMinutesFromNow;
};

// Auth response formatter
const formatAuthResponse = (user, tokens) => {
  return {
    success: true,
    message: 'Authentication successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: jwtConfig.expiresIn
    }
  };
};

// Initialize auth configuration
const initializeAuth = () => {
  try {
    validateJWTConfig();
    console.log('✅ Authentication configuration validated successfully');
    return true;
  } catch (error) {
    console.error('❌ Authentication configuration error:', error.message);
    process.exit(1);
  }
};

module.exports = {
  // Configuration
  jwtConfig,
  bcryptConfig,
  
  // Token operations
  generateToken,
  verifyToken,
  decodeToken,
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  
  // Password operations
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  
  // Token management
  blacklistToken,
  isTokenBlacklisted,
  extractTokenFromHeader,
  getTokenExpiration,
  isTokenExpiringSoon,
  
  // Utilities
  generateSecureToken,
  createUserSession,
  formatAuthResponse,
  
  // Validation
  validateJWTConfig,
  validateTokenPayload,
  
  // Initialization
  initializeAuth
};