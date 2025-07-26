// src/App.js - Complete Coffee Shop Frontend Application
import React, { useState, useEffect, createContext, useContext, useReducer } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, User, Coffee, Package, CreditCard, LogOut, Edit, Save, X, Star, Heart, Search, Filter, MapPin, Phone, Mail, Clock } from 'lucide-react';

// API Configuration
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Context for authentication and cart
const AuthContext = createContext();
const CartContext = createContext();

// API Service
const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        ...(options.body && { body: JSON.stringify(options.body) })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }
      
      return data;
    } catch (error) {
      // If backend is not running, return mock data for development
      if (error.message.includes('fetch')) {
        console.warn('Backend not available, using mock data');
        return this.getMockData(endpoint, options.method || 'GET');
      }
      throw error;
    }
  },

  // Mock data for development without backend
  getMockData(endpoint, method) {
    if (endpoint === '/auth/login' && method === 'POST') {
      const mockUser = { id: '1', email: 'user@example.com', name: 'John Doe', role: 'customer' };
      const mockToken = 'mock-jwt-token';
      localStorage.setItem('token', mockToken);
      localStorage.setItem('user', JSON.stringify(mockUser));
      return { success: true, user: mockUser, token: mockToken };
    }

    if (endpoint === '/auth/register' && method === 'POST') {
      const mockUser = { id: '1', email: 'user@example.com', name: 'John Doe', role: 'customer' };
      const mockToken = 'mock-jwt-token';
      localStorage.setItem('token', mockToken);
      localStorage.setItem('user', JSON.stringify(mockUser));
      return { success: true, user: mockUser, token: mockToken };
    }

    if (endpoint === '/products') {
      return {
        success: true,
        data: [
          {
            id: '1',
            name: 'Espresso',
            description: 'Rich and bold espresso shot made from premium arabica beans',
            price: 2.50,
            category: 'coffee',
            imageUrl: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=300&h=200&fit=crop',
            stock: 100,
            rating: 4.8,
            reviews: 245
          },
          {
            id: '2',
            name: 'Cappuccino',
            description: 'Perfect blend of espresso, steamed milk, and velvety foam',
            price: 4.50,
            category: 'coffee',
            imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=300&h=200&fit=crop',
            stock: 85,
            rating: 4.7,
            reviews: 189
          },
          {
            id: '3',
            name: 'Croissant',
            description: 'Buttery, flaky French pastry baked fresh daily',
            price: 3.00,
            category: 'pastry',
            imageUrl: 'https://images.unsplash.com/photo-1555507036-ab794f575c5f?w=300&h=200&fit=crop',
            stock: 25,
            rating: 4.6,
            reviews: 127
          },
          {
            id: '4',
            name: 'Latte',
            description: 'Smooth espresso with steamed milk and light foam',
            price: 4.00,
            category: 'coffee',
            imageUrl: 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=300&h=200&fit=crop',
            stock: 92,
            rating: 4.9,
            reviews: 312
          },
          {
            id: '5',
            name: 'Blueberry Muffin',
            description: 'Moist muffin packed with fresh blueberries',
            price: 2.75,
            category: 'pastry',
            imageUrl: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=300&h=200&fit=crop',
            stock: 18,
            rating: 4.4,
            reviews: 89
          },
          {
            id: '6',
            name: 'Iced Coffee',
            description: 'Refreshing cold brew coffee served over ice',
            price: 3.25,
            category: 'coffee',
            imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300&h=200&fit=crop',
            stock: 156,
            rating: 4.5,
            reviews: 203
          }
        ]
      };
    }

    if (endpoint.startsWith('/orders') && method === 'POST') {
      return {
        success: true,
        data: {
          id: 'mock-order-' + Date.now(),
          orderNumber: 'ORD-' + Date.now(),
          status: 'pending',
          totalAmount: 10.50,
          items: []
        }
      };
    }

    if (endpoint === '/orders') {
      return {
        success: true,
        data: [
          {
            id: '1',
            orderNumber: 'ORD-001',
            status: 'delivered',
            totalAmount: 12.50,
            createdAt: new Date('2024-01-15'),
            items: [
              { name: 'Cappuccino', quantity: 2, price: 4.50 },
              { name: 'Croissant', quantity: 1, price: 3.00 }
            ]
          }
        ]
      };
    }

    return { success: true, data: [] };
  }
};

// Cart reducer
const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM':
      const existingItem = state.find(item => item.id === action.payload.id);
      if (existingItem) {
        return state.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...state, { ...action.payload, quantity: 1 }];
    
    case 'REMOVE_ITEM':
      return state.filter(item => item.id !== action.payload);
    
    case 'UPDATE_QUANTITY':
      if (action.payload.quantity <= 0) {
        return state.filter(item => item.id !== action.payload.id);
      }
      return state.map(item =>
        item.id === action.payload.id
          ? { ...item, quantity: action.payload.quantity }
          : item
      );
    
    case 'CLEAR_CART':
      return [];
    
    default:
      return state;
  }
};

// Authentication Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await api.request('/auth/login', {
        method: 'POST',
        body: { email, password }
      });

      if (response.success && response.user) {
        setUser(response.user);
        return { success: true };
      }
      return { success: false, message: response.message || 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: error.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      const response = await api.request('/auth/register', {
        method: 'POST',
        body: userData
      });

      if (response.success && response.user) {
        setUser(response.user);
        return { success: true };
      }
      return { success: false, message: response.message || 'Registration failed' };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: error.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Cart Provider
const CartProvider = ({ children }) => {
  const [cart, dispatch] = useReducer(cartReducer, []);

  const addToCart = (product) => {
    dispatch({ type: 'ADD_ITEM', payload: product });
  };

  const removeFromCart = (productId) => {
    dispatch({ type: 'REMOVE_ITEM', payload: productId });
  };

  const updateQuantity = (productId, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartItemCount
    }}>
      {children}
    </CartContext.Provider>
  );
};

// Notification Component
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-transform duration-300`}>
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button onClick={onClose} className="ml-4">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// Loading Component
const Loading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

// Hero Section Component
const HeroSection = () => (
  <div className="bg-gradient-to-r from-coffee-800 to-coffee-600 text-white py-20">
    <div className="max-w-6xl mx-auto px-6 text-center">
      <h1 className="text-5xl font-bold mb-6">Welcome to Coffee Haven</h1>
      <p className="text-xl mb-8 max-w-2xl mx-auto">
        Discover the perfect blend of premium coffee, fresh pastries, and exceptional service. 
        Every cup tells a story, every bite brings joy.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button className="btn-primary text-lg px-8 py-3">
          <Coffee className="inline mr-2" size={20} />
          Order Now
        </button>
        <button className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-coffee-800 font-medium py-3 px-8 rounded-lg transition-colors duration-200">
          View Menu
        </button>
      </div>
    </div>
  </div>
);

// Product Card Component
const ProductCard = ({ product, onAddToCart, isAdmin, onEdit, onDelete }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="card hover:shadow-lg transition-shadow duration-300">
      <div className="relative">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-48 object-cover"
          onError={(e) => {
            e.target.src = `https://via.placeholder.com/300x200/f3a63c/ffffff?text=${encodeURIComponent(product.name)}`;
          }}
        />
        <div className="absolute top-2 right-2">
          <button className="bg-white rounded-full p-1 shadow-md hover:shadow-lg transition-shadow">
            <Heart size={16} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>
        {product.stock < 10 && product.stock > 0 && (
          <div className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded text-xs font-medium">
            Low Stock
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
            Out of Stock
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-800 line-clamp-1">{product.name}</h3>
          <span className="text-2xl font-bold text-primary-600">${product.price}</span>
        </div>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={i < Math.floor(product.rating || 4.5) ? 'fill-current' : 'text-gray-300'}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600 ml-1">
              ({product.reviews || 0})
            </span>
          </div>
          <span className="text-sm text-gray-500">Stock: {product.stock}</span>
        </div>

        <div className="flex gap-2">
          {!isAdmin ? (
            <>
              <button
                onClick={() => onAddToCart(product)}
                disabled={product.stock === 0}
                className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <ShoppingCart size={14} className="inline mr-1" />
                {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="btn-secondary text-sm px-3"
              >
                Details
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onEdit(product)}
                className="flex-1 bg-yellow-500 text-white py-2 px-3 rounded hover:bg-yellow-600 text-sm"
              >
                <Edit size={14} className="inline mr-1" />
                Edit
              </button>
              <button
                onClick={() => onDelete(product.id)}
                className="flex-1 bg-red-500 text-white py-2 px-3 rounded hover:bg-red-600 text-sm"
              >
                <Trash2 size={14} className="inline mr-1" />
                Delete
              </button>
            </>
          )}
        </div>

        {showDetails && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Category:</strong> {product.category}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Rating:</strong> {product.rating || 4.5}/5
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Shopping Cart Modal Component
const ShoppingCartModal = ({ isOpen, onClose }) => {
  const { cart, updateQuantity, removeFromCart, getCartTotal, clearCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const [showCheckout, setShowCheckout] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleCheckout = async () => {
    if (!shippingAddress.trim()) {
      setNotification({ message: 'Please provide a shipping address', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        totalAmount: getCartTotal(),
        shippingAddress
      };

      const response = await api.request('/orders', {
        method: 'POST',
        body: orderData
      });
      
      if (response.success) {
        // Process payment (mock)
        const paymentResponse = await api.request('/payment/process', {
          method: 'POST',
          body: {
            orderId: response.data.id,
            paymentMethod: 'credit_card',
            amount: getCartTotal()
          }
        });

        if (paymentResponse.success) {
          setNotification({ message: 'Order placed successfully!', type: 'success' });
          clearCart();
          setShippingAddress('');
          setShowCheckout(false);
          onClose();
        } else {
          setNotification({ message: 'Payment failed: ' + paymentResponse.message, type: 'error' });
        }
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setNotification({ message: 'Checkout failed. Please try again.', type: 'error' });
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-90vh overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Shopping Cart</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Your cart is empty</p>
            <button onClick={onClose} className="btn-primary mt-4">
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6 max-h-60 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{item.name}</h4>
                    <p className="text-primary-600 font-medium">${item.price}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="bg-gray-200 p-1 rounded hover:bg-gray-300 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="mx-2 min-w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="bg-gray-200 p-1 rounded hover:bg-gray-300 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="bg-red-500 text-white p-1 rounded hover:bg-red-600 ml-2 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between text-xl font-bold mb-4">
                <span>Total: ${getCartTotal().toFixed(2)}</span>
              </div>

              {!showCheckout ? (
                <button
                  onClick={() => setShowCheckout(true)}
                  disabled={!user}
                  className="w-full btn-primary disabled:opacity-50"
                >
                  {user ? 'Proceed to Checkout' : 'Login to Checkout'}
                </button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Shipping Address
                    </label>
                    <textarea
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="input-field"
                      rows="3"
                      placeholder="Enter your complete shipping address..."
                      required
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleCheckout}
                      disabled={loading}
                      className="flex-1 btn-primary disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Place Order'}
                    </button>
                    <button
                      onClick={() => setShowCheckout(false)}
                      className="flex-1 btn-secondary"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </div>
  );
};

// Login/Register Modal Component
const AuthModal = ({ isOpen, onClose, mode, setMode }) => {
  const { login, register } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'customer'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = mode === 'login'
      ? await login(formData.email, formData.password)
      : await register(formData);

    if (result.success) {
      onClose();
      setFormData({ email: '', password: '', name: '', role: 'customer' });
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {mode === 'login' ? 'Welcome Back' : 'Join Coffee Haven'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="Enter your full name"
                required
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-field"
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input-field"
              placeholder="Enter your password"
              required
            />
          </div>

          {mode === 'register' && (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Account Type
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="input-field"
              >
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Header Component
const Header = () => {
  const { user, logout } = useContext(AuthContext);
  const { getCartItemCount } = useContext(CartContext);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showCartModal, setShowCartModal] = useState(false);

  return (
    <>
      <header className="bg-white shadow-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-primary-600 p-2 rounded-lg">
                <Coffee size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Coffee Haven</h1>
                <p className="text-sm text-gray-600">Premium Coffee & Pastries</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#menu" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">Menu</a>
              <a href="#about" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">About</a>
              <a href="#contact" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">Contact</a>
            </nav>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <span className="text-sm text-gray-600 hidden sm:block">
                    Welcome, {user.name}!
                  </span>
                  <button
                    onClick={() => setShowCartModal(true)}
                    className="relative bg-primary-100 hover:bg-primary-200 p-3 rounded-lg transition-colors"
                  >
                    <ShoppingCart size={20} className="text-primary-600" />
                    {getCartItemCount() > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {getCartItemCount()}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={logout}
                    className="bg-gray-100 hover:bg-gray-200 p-3 rounded-lg transition-colors"
                  >
                    <LogOut size={20} className="text-gray-600" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowCartModal(true)}
                    className="relative bg-primary-100 hover:bg-primary-200 p-3 rounded-lg transition-colors"
                  >
                    <ShoppingCart size={20} className="text-primary-600" />
                    {getCartItemCount() > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {getCartItemCount()}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setShowAuthModal(true);
                    }}
                    className="btn-primary"
                  >
                    <User size={16} className="inline mr-2" />
                    Sign In
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
        setMode={setAuthMode}
      />

      <ShoppingCartModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
      />
    </>
  );
};

// Products Section Component
const ProductsSection = () => {
  const { addToCart } = useContext(CartContext);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let filtered = products;

    if (selectedCategory) {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchTerm]);

  const fetchProducts = async () => {
    try {
      const response = await api.request('/products');
      if (response.success) {
        setProducts(response.data);
        setFilteredProducts(response.data);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(response.data.map(product => product.category))];
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <section id="menu" className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Our Menu</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Crafted with passion, served with love. Explore our selection of premium coffee and fresh pastries.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          
          <div className="relative">
            <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field pl-10 pr-8"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Coffee size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
                isAdmin={false}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// Footer Component
const Footer = () => (
  <footer className="bg-coffee-800 text-white py-12">
    <div className="max-w-6xl mx-auto px-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Coffee size={24} className="text-primary-400" />
            <h3 className="text-xl font-bold">Coffee Haven</h3>
          </div>
          <p className="text-gray-300 mb-4">
            Your neighborhood coffee shop serving premium blends and fresh pastries since 2020.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2 text-gray-300">
            <li><a href="#menu" className="hover:text-primary-400 transition-colors">Menu</a></li>
            <li><a href="#about" className="hover:text-primary-400 transition-colors">About Us</a></li>
            <li><a href="#contact" className="hover:text-primary-400 transition-colors">Contact</a></li>
            <li><a href="#careers" className="hover:text-primary-400 transition-colors">Careers</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-4">Contact Info</h4>
          <div className="space-y-2 text-gray-300">
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              <span>123 Coffee Street, Bean City</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={16} />
              <span>(555) 123-BREW</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={16} />
              <span>hello@coffeehaven.com</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-4">Hours</h4>
          <div className="space-y-2 text-gray-300">
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <div>
                <p>Mon - Fri: 6:00 AM - 8:00 PM</p>
                <p>Sat - Sun: 7:00 AM - 9:00 PM</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-coffee-700 mt-8 pt-8 text-center text-gray-300">
        <p>&copy; 2024 Coffee Haven. All rights reserved. Made with ❤️ and lots of ☕</p>
      </div>
    </div>
  </footer>
);

// Main App Component
const App = () => {
  const [notification, setNotification] = useState(null);

  return (
    <AuthProvider>
      <CartProvider>
        <div className="min-h-screen bg-white">
          <Header />
          <main>
            <HeroSection />
            <ProductsSection />
          </main>
          <Footer />
          
          {notification && (
            <Notification
              message={notification.message}
              type={notification.type}
              onClose={() => setNotification(null)}
            />
          )}
        </div>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;