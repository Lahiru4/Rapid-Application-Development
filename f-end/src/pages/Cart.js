import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

const Cart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    increaseQuantity,
    decreaseQuantity,
    clearCart,
    getCartSummary,
    isEmpty
  } = useCart();

  const [discountCode, setDiscountCode] = useState('');
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);

  const cartSummary = getCartSummary();

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;

    setDiscountLoading(true);
    setDiscountError('');

    try {
      // This would normally call your API
      // For demo purposes, we'll simulate the discount logic
      if (discountCode.toUpperCase() === 'SAVE10') {
        const discountAmount = cartSummary.subtotal * 0.1;
        setAppliedDiscount({
          code: discountCode.toUpperCase(),
          type: 'percentage',
          value: 10,
          amount: discountAmount
        });
        setDiscountCode('');
      } else if (discountCode.toUpperCase() === 'WELCOME5') {
        setAppliedDiscount({
          code: discountCode.toUpperCase(),
          type: 'fixed',
          value: 5,
          amount: 5
        });
        setDiscountCode('');
      } else {
        setDiscountError('Invalid discount code');
      }
    } catch (error) {
      setDiscountError('Failed to apply discount code');
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountError('');
  };

  const handleProceedToCheckout = () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return;
    }
    navigate('/checkout');
  };

  const calculateFinalTotal = () => {
    let total = cartSummary.total;
    if (appliedDiscount) {
      total -= appliedDiscount.amount;
    }
    return Math.max(0, total);
  };

  if (isEmpty) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <svg className="w-24 h-24 mx-auto mb-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l1.5 6M20 13v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6" />
            </svg>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
            <p className="text-lg text-gray-600 mb-8">
              Looks like you haven't added any items to your cart yet.
            </p>
            <Link
              to="/products"
              className="btn-primary inline-flex items-center text-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          <Link
            to="/products"
            className="text-amber-600 hover:text-amber-700 font-medium flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Continue Shopping
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Cart Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Cart Items ({cartSummary.itemCount})
                  </h2>
                  <button
                    onClick={clearCart}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Clear Cart
                  </button>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="divide-y divide-gray-200">
                {cartItems.map((item) => (
                  <div key={item.id} className="p-6">
                    <div className="flex items-start space-x-4">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        <Link to={`/products/${item.id}`}>
                          <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-400">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </Link>
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/products/${item.id}`}
                          className="text-lg font-medium text-gray-900 hover:text-amber-600 transition-colors duration-200"
                        >
                          {item.name}
                        </Link>
                        <p className="text-gray-600 text-sm mt-1">{item.category}</p>
                        {item.sku && (
                          <p className="text-gray-500 text-xs mt-1">SKU: {item.sku}</p>
                        )}

                        {/* Mobile Price & Quantity */}
                        <div className="mt-3 sm:hidden">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-bold text-amber-600">
                              ${item.price.toFixed(2)}
                            </span>
                            <span className="text-sm text-gray-500">
                              each
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center border border-gray-300 rounded-lg">
                              <button
                                onClick={() => decreaseQuantity(item.id)}
                                className="px-3 py-1 text-gray-600 hover:text-gray-800"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={item.stock}
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                                className="w-16 px-2 py-1 text-center border-0 focus:outline-none"
                              />
                              <button
                                onClick={() => increaseQuantity(item.id)}
                                disabled={item.quantity >= item.stock}
                                className="px-3 py-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop Price & Controls */}
                      <div className="hidden sm:flex sm:flex-col sm:items-end sm:space-y-2">
                        <div className="text-right">
                          <div className="text-lg font-bold text-amber-600">
                            ${item.price.toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-500">each</div>
                        </div>

                        <div className="flex items-center border border-gray-300 rounded-lg">
                          <button
                            onClick={() => decreaseQuantity(item.id)}
                            className="px-3 py-1 text-gray-600 hover:text-gray-800"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={item.stock}
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1 text-center border-0 focus:outline-none"
                          />
                          <button
                            onClick={() => increaseQuantity(item.id)}
                            disabled={item.quantity >= item.stock}
                            className="px-3 py-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Item Total */}
                      <div className="hidden sm:block text-right">
                        <div className="text-xl font-bold text-gray-900">
                          ${(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Stock Warning */}
                    {item.quantity > item.stock && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 text-sm">
                          ⚠️ Only {item.stock} items available. Quantity will be adjusted at checkout.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

              {/* Discount Code */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Code
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="Enter code"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={handleApplyDiscount}
                    disabled={discountLoading || !discountCode.trim()}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {discountLoading ? 'Applying...' : 'Apply'}
                  </button>
                </div>
                {discountError && (
                  <p className="text-red-600 text-sm mt-1">{discountError}</p>
                )}
                
                {/* Applied Discount */}
                {appliedDiscount && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-green-700 font-medium">
                        {appliedDiscount.code} Applied!
                      </span>
                      <button
                        onClick={handleRemoveDiscount}
                        className="text-green-600 hover:text-green-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-green-600 text-sm">
                      Save ${appliedDiscount.amount.toFixed(2)}
                    </p>
                  </div>
                )}

                {/* Demo Codes */}
                <div className="mt-3 text-xs text-gray-500">
                  <p>Try these codes:</p>
                  <div className="flex space-x-2 mt-1">
                    <button
                      onClick={() => setDiscountCode('SAVE10')}
                      className="px-2 py-1 bg-gray-100 rounded text-gray-600 hover:bg-gray-200"
                    >
                      SAVE10
                    </button>
                    <button
                      onClick={() => setDiscountCode('WELCOME5')}
                      className="px-2 py-1 bg-gray-100 rounded text-gray-600 hover:bg-gray-200"
                    >
                      WELCOME5
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Details */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal ({cartSummary.itemCount} items)</span>
                  <span className="font-medium">${cartSummary.subtotal.toFixed(2)}</span>
                </div>

                {appliedDiscount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Discount ({appliedDiscount.code})</span>
                    <span className="text-green-600 font-medium">
                      -${appliedDiscount.amount.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {cartSummary.freeShipping ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      `$${cartSummary.shipping.toFixed(2)}`
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">${cartSummary.tax.toFixed(2)}</span>
                </div>

                {!cartSummary.freeShipping && (
                  <div className="text-xs text-amber-600">
                    Add ${(50 - cartSummary.subtotal).toFixed(2)} more for free shipping!
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="border-t border-gray-200 pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${calculateFinalTotal().toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleProceedToCheckout}
                className="w-full btn-primary text-lg py-3 mb-4"
              >
                {user ? 'Proceed to Checkout' : 'Sign In to Checkout'}
              </button>

              {/* Security Badge */}
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Secure Checkout</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;