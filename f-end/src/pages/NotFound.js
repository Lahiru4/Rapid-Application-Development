import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchSuggestions, setSearchSuggestions] = useState([]);

  // Get the attempted URL
  const attemptedPath = location.pathname;

  useEffect(() => {
    fetchFeaturedProducts();
    generateSearchSuggestions();
  }, []);

  const fetchFeaturedProducts = async () => {
    try {
      const response = await axios.get('/products?limit=3&sortBy=createdAt&sortOrder=desc');
      setFeaturedProducts(response.data.data);
    } catch (error) {
      console.error('Error fetching featured products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const generateSearchSuggestions = () => {
    // Generate helpful suggestions based on the attempted path
    const suggestions = [];
    
    if (attemptedPath.includes('product')) {
      suggestions.push(
        { text: 'Browse All Products', path: '/products', icon: '🛍️' },
        { text: 'Coffee Category', path: '/products?category=coffee', icon: '☕' },
        { text: 'Tea Category', path: '/products?category=tea', icon: '🍵' }
      );
    } else if (attemptedPath.includes('order')) {
      suggestions.push(
        { text: 'My Orders', path: '/orders', icon: '📦' },
        { text: 'Order History', path: '/orders', icon: '📋' }
      );
    } else if (attemptedPath.includes('admin')) {
      if (user?.role === 'admin') {
        suggestions.push(
          { text: 'Admin Dashboard', path: '/admin', icon: '📊' },
          { text: 'Manage Products', path: '/admin/products', icon: '📝' },
          { text: 'Manage Orders', path: '/admin/orders', icon: '📦' }
        );
      }
    } else if (attemptedPath.includes('cart')) {
      suggestions.push(
        { text: 'Shopping Cart', path: '/cart', icon: '🛒' },
        { text: 'Continue Shopping', path: '/products', icon: '🛍️' }
      );
    } else if (attemptedPath.includes('profile') || attemptedPath.includes('account')) {
      if (user) {
        suggestions.push(
          { text: 'My Profile', path: '/profile', icon: '👤' },
          { text: 'Account Settings', path: '/profile', icon: '⚙️' }
        );
      } else {
        suggestions.push(
          { text: 'Sign In', path: '/login', icon: '🔐' },
          { text: 'Create Account', path: '/register', icon: '📝' }
        );
      }
    }

    // Default suggestions if no specific matches
    if (suggestions.length === 0) {
      suggestions.push(
        { text: 'Home Page', path: '/', icon: '🏠' },
        { text: 'Browse Products', path: '/products', icon: '🛍️' },
        { text: 'Contact Support', path: '#contact', icon: '💬' }
      );
    }

    setSearchSuggestions(suggestions);
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleReportIssue = () => {
    const subject = encodeURIComponent('Broken Link Report');
    const body = encodeURIComponent(`I found a broken link: ${window.location.href}\n\nAdditional details: `);
    window.open(`mailto:support@coffeeshop.com?subject=${subject}&body=${body}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          {/* 404 Illustration */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-64 h-64 mx-auto mb-8">
              <svg
                className="w-full h-full text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-8.5a8.5 8.5 0 108.5 8.5"
                />
              </svg>
            </div>
            
            {/* Coffee Cup Animation */}
            <div className="relative inline-block">
              <div className="text-8xl animate-bounce">☕</div>
              <div className="absolute -top-2 -right-2 text-2xl animate-pulse">💔</div>
            </div>
          </div>

          {/* Error Message */}
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Oops! This page went for a coffee break
            </h2>
            <p className="text-xl text-gray-600 mb-2">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <p className="text-lg text-gray-500">
              Don't worry, even our best baristas sometimes lose track of things!
            </p>
          </div>

          {/* Attempted Path Info */}
          {attemptedPath !== '/' && (
            <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg inline-block">
              <p className="text-sm text-yellow-800">
                <strong>Attempted URL:</strong> <code className="bg-yellow-100 px-2 py-1 rounded">{attemptedPath}</code>
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={handleGoBack}
              className="btn-outline flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Go Back
            </button>
            
            <Link to="/" className="btn-primary flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Go Home
            </Link>

            <Link to="/products" className="btn-primary flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Browse Products
            </Link>
          </div>
        </div>

        {/* Helpful Suggestions */}
        {searchSuggestions.length > 0 && (
          <div className="mb-12">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
                Maybe you were looking for...
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {searchSuggestions.map((suggestion, index) => (
                  <Link
                    key={index}
                    to={suggestion.path}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-amber-300 hover:bg-amber-50 transition-all duration-200 group"
                  >
                    <span className="text-2xl mr-4 group-hover:scale-110 transition-transform duration-200">
                      {suggestion.icon}
                    </span>
                    <span className="font-medium text-gray-900 group-hover:text-amber-600 transition-colors duration-200">
                      {suggestion.text}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Featured Products */}
        <div className="mb-12">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
              While you're here, check out our featured products
            </h3>
            
            {loadingProducts ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredProducts.map((product) => (
                  <Link
                    key={product.id}
                    to={`/products/${product.id}`}
                    className="group"
                  >
                    <div className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200">
                      <div className="h-48 bg-gray-200 flex items-center justify-center">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="text-gray-400">
                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h4 className="font-semibold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors duration-200">
                          {product.name}
                        </h4>
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-bold text-amber-600">
                            ${product.price?.toFixed(2)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {featuredProducts.length === 0 && !loadingProducts && (
              <div className="text-center text-gray-500">
                <p>No featured products available at the moment.</p>
              </div>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-8 border border-amber-200">
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-amber-900 mb-4">
              Still can't find what you're looking for?
            </h3>
            <p className="text-amber-800 mb-6">
              Our support team is here to help you find exactly what you need.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="mailto:support@coffeeshop.com"
                className="inline-flex items-center px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Support
              </a>
              
              <button
                onClick={handleReportIssue}
                className="inline-flex items-center px-6 py-3 border border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white font-medium rounded-lg transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Report Issue
              </button>

              <a
                href="tel:+1-555-123-4567"
                className="inline-flex items-center px-6 py-3 border border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white font-medium rounded-lg transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call Us
              </a>
            </div>
          </div>
        </div>

        {/* Fun Stats */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Fun Fact: While you were here...
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600 mb-2">☕</div>
                <p className="text-gray-600">Someone just ordered their favorite coffee</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600 mb-2">📦</div>
                <p className="text-gray-600">Another order was just shipped</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600 mb-2">😊</div>
                <p className="text-gray-600">A customer just left a 5-star review</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;