// middleware/adminAuth.js - Admin Authentication Middleware
const jwt = require('jsonwebtoken');

// Mock admin users for development (in production, use database)
const mockAdmins = [
  {
    id: '1',
    email: 'admin@coffeehaven.com',
    password: 'admin123', // In production, this should be hashed
    name: 'Admin User',
    role: 'admin',
    permissions: ['read', 'write', 'delete', 'manage_users']
  },
  {
    id: '2',
    email: 'manager@coffeehaven.com',
    password: 'manager123',
    name: 'Manager User',
    role: 'manager',
    permissions: ['read', 'write']
  }
];

/**
 * Authenticate admin token
 * Verifies JWT token and checks if user is admin
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Admin access token required'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired admin token'
      });
    }

    // Check if user exists and is admin
    const admin = mockAdmins.find(a => a.id === decoded.userId);
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin user not found'
      });
    }

    if (admin.role !== 'admin' && admin.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Add admin info to request
    req.admin = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions
    };

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

/**
 * Require specific admin role
 * @param {string} requiredRole - Required role (admin, manager)
 */
const requireAdminRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.admin.role !== requiredRole && req.admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `${requiredRole} access required`
      });
    }

    next();
  };
};

/**
 * Require specific permission
 * @param {string} permission - Required permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.admin.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission '${permission}' required`
      });
    }

    next();
  };
};

/**
 * Admin login function
 * @param {string} email - Admin email
 * @param {string} password - Admin password
 * @returns {Object} - Login result
 */
const adminLogin = async (email, password) => {
  try {
    // Find admin by email
    const admin = mockAdmins.find(a => a.email === email);
    
    if (!admin) {
      return {
        success: false,
        message: 'Invalid admin credentials'
      };
    }

    // Check password (in production, use bcrypt.compare)
    if (admin.password !== password) {
      return {
        success: false,
        message: 'Invalid admin credentials'
      };
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: admin.id,
        email: admin.email,
        role: admin.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '8h' } // Admin sessions expire in 8 hours
    );

    // Return success with user data (without password)
    const { password: _, ...adminWithoutPassword } = admin;
    
    return {
      success: true,
      token,
      admin: adminWithoutPassword
    };
  } catch (error) {
    console.error('Admin login error:', error);
    return {
      success: false,
      message: 'Server error during login'
    };
  }
};

/**
 * Check if user is super admin
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.admin.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required'
    });
  }

  next();
};

/**
 * Log admin actions for audit trail
 */
const logAdminAction = (action) => {
  return (req, res, next) => {
    // Log admin action
    console.log('Admin Action Log:', {
      adminId: req.admin?.id,
      adminEmail: req.admin?.email,
      action,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // In production, save to database or audit log service
    
    next();
  };
};

/**
 * Rate limiting for admin actions
 */
const adminRateLimit = {
  // Track admin action counts
  actionCounts: new Map(),
  
  // Rate limit specific admin actions
  limitAction: (maxActions = 100, windowMs = 15 * 60 * 1000) => {
    return (req, res, next) => {
      const adminId = req.admin?.id;
      const now = Date.now();
      const windowStart = now - windowMs;

      if (!adminId) {
        return next();
      }

      // Get admin's action history
      if (!this.actionCounts.has(adminId)) {
        this.actionCounts.set(adminId, []);
      }

      const actions = this.actionCounts.get(adminId);
      
      // Remove old actions outside the window
      const recentActions = actions.filter(time => time > windowStart);
      
      // Check if limit exceeded
      if (recentActions.length >= maxActions) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded for admin actions'
        });
      }

      // Add current action
      recentActions.push(now);
      this.actionCounts.set(adminId, recentActions);

      next();
    };
  }
};

/**
 * Validate admin session
 */
const validateAdminSession = async (req, res, next) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin session invalid'
      });
    }

    // Check if admin still exists and is active
    const admin = mockAdmins.find(a => a.id === req.admin.id);
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin account no longer exists'
      });
    }

    // Update session info
    req.admin.lastActivity = new Date();
    
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Session validation failed'
    });
  }
};

/**
 * Get admin profile
 */
const getAdminProfile = async (adminId) => {
  try {
    const admin = mockAdmins.find(a => a.id === adminId);
    
    if (!admin) {
      return null;
    }

    // Return admin data without password
    const { password: _, ...adminProfile } = admin;
    return adminProfile;
  } catch (error) {
    console.error('Get admin profile error:', error);
    return null;
  }
};

/**
 * Update admin profile
 */
const updateAdminProfile = async (adminId, updateData) => {
  try {
    const adminIndex = mockAdmins.findIndex(a => a.id === adminId);
    
    if (adminIndex === -1) {
      return {
        success: false,
        message: 'Admin not found'
      };
    }

    // Update allowed fields only
    const allowedFields = ['name', 'email'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    // Apply updates
    mockAdmins[adminIndex] = {
      ...mockAdmins[adminIndex],
      ...updates,
      updatedAt: new Date()
    };

    // Return updated profile without password
    const { password: _, ...updatedProfile } = mockAdmins[adminIndex];
    
    return {
      success: true,
      admin: updatedProfile
    };
  } catch (error) {
    console.error('Update admin profile error:', error);
    return {
      success: false,
      message: 'Failed to update profile'
    };
  }
};

module.exports = {
  authenticateAdmin,
  requireAdminRole,
  requirePermission,
  requireSuperAdmin,
  adminLogin,
  logAdminAction,
  adminRateLimit,
  validateAdminSession,
  getAdminProfile,
  updateAdminProfile,
  mockAdmins // Export for development/testing
};