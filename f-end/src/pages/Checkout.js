import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cartItems, getCartSummary, clearCart, isEmpty } = useCart();
  
  const [step, setStep] = useState(1); // 1: Shipping, 2: Payment, 3: Review
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [shippingInfo, setShippingInfo] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States'
  });

  const [paymentInfo, setPaymentInfo] = useState({
    paymentMethod: 'credit_card',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    billingAddressSame: true,
    billingAddress: {
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'United States'
    }
  });

  const [orderNotes, setOrderNotes] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const cartSummary = getCartSummary();

  // Redirect if cart is empty or user not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return;
    }
    
    if (isEmpty) {
      navigate('/cart');
      return;
    }
  }, [user, isEmpty, navigate]);

  const handleShippingChange = (e) => {
    const { name, value } = e.target;
    setShippingInfo(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear validation error
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handlePaymentChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'billingAddressSame') {
      setPaymentInfo(prev => ({
        ...prev,
        [name]: checked,
        billingAddress: checked ? {
          address: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'United States'
        } : prev.billingAddress
      }));
    } else if (name.startsWith('billing.')) {
      const field = name.split('.')[1];
      setPaymentInfo(prev => ({
        ...prev,
        billingAddress: {
          ...prev.billingAddress,
          [field]: value
        }
      }));
    } else {
      setPaymentInfo(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Clear validation error
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateShipping = () => {
    const errors = {};
    const required = ['fullName', 'email', 'phone', 'address', 'city', 'state', 'zipCode'];
    
    required.forEach(field => {
      if (!shippingInfo[field]?.trim()) {
        errors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
      }
    });

    // Email validation
    if (shippingInfo.email && !/\S+@\S+\.\S+/.test(shippingInfo.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Phone validation
    if (shippingInfo.phone && !/^\(\d{3}\)\s\d{3}-\d{4}$/.test(shippingInfo.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePayment = () => {
    const errors = {};

    if (paymentInfo.paymentMethod === 'credit_card') {
      if (!paymentInfo.cardNumber?.trim()) {
        errors.cardNumber = 'Card number is required';
      } else if (!/^\d{16}$/.test(paymentInfo.cardNumber.replace(/\s/g, ''))) {
        errors.cardNumber = 'Please enter a valid 16-digit card number';
      }

      if (!paymentInfo.expiryDate?.trim()) {
        errors.expiryDate = 'Expiry date is required';
      } else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(paymentInfo.expiryDate)) {
        errors.expiryDate = 'Please enter a valid expiry date (MM/YY)';
      }

      if (!paymentInfo.cvv?.trim()) {
        errors.cvv = 'CVV is required';
      } else if (!/^\d{3,4}$/.test(paymentInfo.cvv)) {
        errors.cvv = 'Please enter a valid CVV';
      }

      if (!paymentInfo.cardholderName?.trim()) {
        errors.cardholderName = 'Cardholder name is required';
      }

      // Validate billing address if different from shipping
      if (!paymentInfo.billingAddressSame) {
        const billingRequired = ['address', 'city', 'state', 'zipCode'];
        billingRequired.forEach(field => {
          if (!paymentInfo.billingAddress[field]?.trim()) {
            errors[`billing.${field}`] = `Billing ${field} is required`;
          }
        });
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (step === 1 && validateShipping()) {
      setStep(2);
    } else if (step === 2 && validatePayment()) {
      setStep(3);
    }
  };

  const handlePreviousStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const formatPhoneNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 6) {
      return `(${v.substring(0, 3)}) ${v.substring(3, 6)}-${v.substring(6, 10)}`;
    } else if (v.length >= 3) {
      return `(${v.substring(0, 3)}) ${v.substring(3)}`;
    }
    return v;
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError('');

    try {
      // Prepare order data
      const orderData = {
        items: cartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity
        })),
        shippingAddress: `${shippingInfo.address}, ${shippingInfo.city}, ${shippingInfo.state} ${shippingInfo.zipCode}, ${shippingInfo.country}`,
        paymentMethod: paymentInfo.paymentMethod,
        notes: orderNotes
      };

      // Create order
      const orderResponse = await axios.post('/orders', orderData);
      const order = orderResponse.data.data;

      // Process payment
      const paymentData = {
        orderId: order.id,
        paymentMethod: paymentInfo.paymentMethod,
        amount: cartSummary.total,
        currency: 'USD'
      };

      if (paymentInfo.paymentMethod === 'credit_card') {
        paymentData.cardDetails = {
          number: paymentInfo.cardNumber.replace(/\s/g, ''),
          expMonth: paymentInfo.expiryDate.split('/')[0],
          expYear: '20' + paymentInfo.expiryDate.split('/')[1],
          cvc: paymentInfo.cvv,
          holderName: paymentInfo.cardholderName
        };

        paymentData.billingAddress = paymentInfo.billingAddressSame 
          ? `${shippingInfo.address}, ${shippingInfo.city}, ${shippingInfo.state} ${shippingInfo.zipCode}, ${shippingInfo.country}`
          : `${paymentInfo.billingAddress.address}, ${paymentInfo.billingAddress.city}, ${paymentInfo.billingAddress.state} ${paymentInfo.billingAddress.zipCode}, ${paymentInfo.billingAddress.country}`;
      }

      await axios.post('/payment/process', paymentData);

      // Clear cart and redirect to success page
      clearCart();
      navigate(`/orders/${order.id}`, { 
        state: { 
          orderCreated: true,
          message: 'Your order has been placed successfully!' 
        }
      });

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order. Please try again.');
      console.error('Order placement error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user || isEmpty) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          
          {/* Progress Steps */}
          <div className="mt-6">
            <div className="flex items-center">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    step >= stepNum 
                      ? 'bg-amber-600 border-amber-600 text-white' 
                      : 'border-gray-300 text-gray-500'
                  }`}>
                    {step > stepNum ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    step >= stepNum ? 'text-amber-600' : 'text-gray-500'
                  }`}>
                    {stepNum === 1 ? 'Shipping' : stepNum === 2 ? 'Payment' : 'Review'}
                  </span>
                  {stepNum < 3 && (
                    <div className={`ml-4 w-12 h-0.5 ${
                      step > stepNum ? 'bg-amber-600' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              {/* Step 1: Shipping Information */}
              {step === 1 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Shipping Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Full Name *</label>
                      <input
                        type="text"
                        name="fullName"
                        value={shippingInfo.fullName}
                        onChange={handleShippingChange}
                        className={`form-input ${validationErrors.fullName ? 'border-red-500' : ''}`}
                        placeholder="Enter your full name"
                      />
                      {validationErrors.fullName && (
                        <p className="form-error">{validationErrors.fullName}</p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">Email Address *</label>
                      <input
                        type="email"
                        name="email"
                        value={shippingInfo.email}
                        onChange={handleShippingChange}
                        className={`form-input ${validationErrors.email ? 'border-red-500' : ''}`}
                        placeholder="Enter your email"
                      />
                      {validationErrors.email && (
                        <p className="form-error">{validationErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">Phone Number *</label>
                      <input
                        type="tel"
                        name="phone"
                        value={shippingInfo.phone}
                        onChange={(e) => {
                          const formatted = formatPhoneNumber(e.target.value);
                          handleShippingChange({ target: { name: 'phone', value: formatted } });
                        }}
                        className={`form-input ${validationErrors.phone ? 'border-red-500' : ''}`}
                        placeholder="(555) 123-4567"
                      />
                      {validationErrors.phone && (
                        <p className="form-error">{validationErrors.phone}</p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">Country *</label>
                      <select
                        name="country"
                        value={shippingInfo.country}
                        onChange={handleShippingChange}
                        className="form-input"
                      >
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                        <option value="United Kingdom">United Kingdom</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="form-label">Street Address *</label>
                      <input
                        type="text"
                        name="address"
                        value={shippingInfo.address}
                        onChange={handleShippingChange}
                        className={`form-input ${validationErrors.address ? 'border-red-500' : ''}`}
                        placeholder="123 Main Street"
                      />
                      {validationErrors.address && (
                        <p className="form-error">{validationErrors.address}</p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">City *</label>
                      <input
                        type="text"
                        name="city"
                        value={shippingInfo.city}
                        onChange={handleShippingChange}
                        className={`form-input ${validationErrors.city ? 'border-red-500' : ''}`}
                        placeholder="Enter city"
                      />
                      {validationErrors.city && (
                        <p className="form-error">{validationErrors.city}</p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">State *</label>
                      <input
                        type="text"
                        name="state"
                        value={shippingInfo.state}
                        onChange={handleShippingChange}
                        className={`form-input ${validationErrors.state ? 'border-red-500' : ''}`}
                        placeholder="Enter state"
                      />
                      {validationErrors.state && (
                        <p className="form-error">{validationErrors.state}</p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">ZIP Code *</label>
                      <input
                        type="text"
                        name="zipCode"
                        value={shippingInfo.zipCode}
                        onChange={handleShippingChange}
                        className={`form-input ${validationErrors.zipCode ? 'border-red-500' : ''}`}
                        placeholder="12345"
                      />
                      {validationErrors.zipCode && (
                        <p className="form-error">{validationErrors.zipCode}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Payment Information */}
              {step === 2 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Information</h2>
                  
                  {/* Payment Method Selection */}
                  <div className="mb-6">
                    <label className="form-label">Payment Method *</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { value: 'credit_card', label: 'Credit Card', icon: '💳' },
                        { value: 'paypal', label: 'PayPal', icon: '🅿️' },
                        { value: 'apple_pay', label: 'Apple Pay', icon: '🍎' }
                      ].map((method) => (
                        <label
                          key={method.value}
                          className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors duration-200 ${
                            paymentInfo.paymentMethod === method.value
                              ? 'border-amber-600 bg-amber-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method.value}
                            checked={paymentInfo.paymentMethod === method.value}
                            onChange={handlePaymentChange}
                            className="sr-only"
                          />
                          <span className="text-2xl mr-3">{method.icon}</span>
                          <span className="font-medium">{method.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Credit Card Form */}
                  {paymentInfo.paymentMethod === 'credit_card' && (
                    <div className="space-y-4">
                      <div>
                        <label className="form-label">Cardholder Name *</label>
                        <input
                          type="text"
                          name="cardholderName"
                          value={paymentInfo.cardholderName}
                          onChange={handlePaymentChange}
                          className={`form-input ${validationErrors.cardholderName ? 'border-red-500' : ''}`}
                          placeholder="John Doe"
                        />
                        {validationErrors.cardholderName && (
                          <p className="form-error">{validationErrors.cardholderName}</p>
                        )}
                      </div>

                      <div>
                        <label className="form-label">Card Number *</label>
                        <input
                          type="text"
                          name="cardNumber"
                          value={paymentInfo.cardNumber}
                          onChange={(e) => {
                            const formatted = formatCardNumber(e.target.value);
                            handlePaymentChange({ target: { name: 'cardNumber', value: formatted } });
                          }}
                          className={`form-input ${validationErrors.cardNumber ? 'border-red-500' : ''}`}
                          placeholder="1234 5678 9012 3456"
                          maxLength="19"
                        />
                        {validationErrors.cardNumber && (
                          <p className="form-error">{validationErrors.cardNumber}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">Expiry Date *</label>
                          <input
                            type="text"
                            name="expiryDate"
                            value={paymentInfo.expiryDate}
                            onChange={(e) => {
                              const formatted = formatExpiryDate(e.target.value);
                              handlePaymentChange({ target: { name: 'expiryDate', value: formatted } });
                            }}
                            className={`form-input ${validationErrors.expiryDate ? 'border-red-500' : ''}`}
                            placeholder="MM/YY"
                            maxLength="5"
                          />
                          {validationErrors.expiryDate && (
                            <p className="form-error">{validationErrors.expiryDate}</p>
                          )}
                        </div>

                        <div>
                          <label className="form-label">CVV *</label>
                          <input
                            type="text"
                            name="cvv"
                            value={paymentInfo.cvv}
                            onChange={handlePaymentChange}
                            className={`form-input ${validationErrors.cvv ? 'border-red-500' : ''}`}
                            placeholder="123"
                            maxLength="4"
                          />
                          {validationErrors.cvv && (
                            <p className="form-error">{validationErrors.cvv}</p>
                          )}
                        </div>
                      </div>

                      {/* Billing Address */}
                      <div className="pt-4 border-t">
                        <div className="flex items-center mb-4">
                          <input
                            type="checkbox"
                            name="billingAddressSame"
                            checked={paymentInfo.billingAddressSame}
                            onChange={handlePaymentChange}
                            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                          />
                          <label className="ml-2 text-sm text-gray-700">
                            Billing address same as shipping address
                          </label>
                        </div>

                        {!paymentInfo.billingAddressSame && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <label className="form-label">Billing Address *</label>
                              <input
                                type="text"
                                name="billing.address"
                                value={paymentInfo.billingAddress.address}
                                onChange={handlePaymentChange}
                                className={`form-input ${validationErrors['billing.address'] ? 'border-red-500' : ''}`}
                                placeholder="123 Billing Street"
                              />
                              {validationErrors['billing.address'] && (
                                <p className="form-error">{validationErrors['billing.address']}</p>
                              )}
                            </div>

                            <div>
                              <label className="form-label">Billing City *</label>
                              <input
                                type="text"
                                name="billing.city"
                                value={paymentInfo.billingAddress.city}
                                onChange={handlePaymentChange}
                                className={`form-input ${validationErrors['billing.city'] ? 'border-red-500' : ''}`}
                                placeholder="Billing City"
                              />
                              {validationErrors['billing.city'] && (
                                <p className="form-error">{validationErrors['billing.city']}</p>
                              )}
                            </div>

                            <div>
                              <label className="form-label">Billing State *</label>
                              <input
                                type="text"
                                name="billing.state"
                                value={paymentInfo.billingAddress.state}
                                onChange={handlePaymentChange}
                                className={`form-input ${validationErrors['billing.state'] ? 'border-red-500' : ''}`}
                                placeholder="State"
                              />
                              {validationErrors['billing.state'] && (
                                <p className="form-error">{validationErrors['billing.state']}</p>
                              )}
                            </div>

                            <div>
                              <label className="form-label">Billing ZIP *</label>
                              <input
                                type="text"
                                name="billing.zipCode"
                                value={paymentInfo.billingAddress.zipCode}
                                onChange={handlePaymentChange}
                                className={`form-input ${validationErrors['billing.zipCode'] ? 'border-red-500' : ''}`}
                                placeholder="12345"
                              />
                              {validationErrors['billing.zipCode'] && (
                                <p className="form-error">{validationErrors['billing.zipCode']}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Demo Card Info */}
                  {paymentInfo.paymentMethod === 'credit_card' && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">Demo Mode - Use Test Card:</h4>
                      <p className="text-blue-700 text-sm">
                        Card: 4242 4242 4242 4242 | Expiry: 12/25 | CVV: 123
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Review Order */}
              {step === 3 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Review Your Order</h2>
                  
                  {/* Order Items */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Order Items</h3>
                    <div className="space-y-4">
                      {cartItems.map((item) => (
                        <div key={item.id} className="flex items-center space-x-4 py-4 border-b border-gray-200">
                          <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-400">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.name}</h4>
                            <p className="text-gray-600 text-sm">Quantity: {item.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                            <p className="text-gray-600 text-sm">${item.price.toFixed(2)} each</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping Information */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Shipping Information</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="font-medium">{shippingInfo.fullName}</p>
                      <p>{shippingInfo.email}</p>
                      <p>{shippingInfo.phone}</p>
                      <p>{shippingInfo.address}</p>
                      <p>{shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}</p>
                      <p>{shippingInfo.country}</p>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="font-medium capitalize">{paymentInfo.paymentMethod.replace('_', ' ')}</p>
                      {paymentInfo.paymentMethod === 'credit_card' && (
                        <>
                          <p>**** **** **** {paymentInfo.cardNumber.slice(-4)}</p>
                          <p>{paymentInfo.cardholderName}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Order Notes */}
                  <div className="mb-6">
                    <label className="form-label">Order Notes (Optional)</label>
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="form-input"
                      rows="3"
                      placeholder="Any special instructions for your order..."
                    />
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex">
                        <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <button
                  onClick={handlePreviousStep}
                  disabled={step === 1}
                  className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                {step < 3 ? (
                  <button
                    onClick={handleNextStep}
                    className="btn-primary flex items-center"
                  >
                    Next
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    className="btn-primary flex items-center"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        Place Order
                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              {/* Items */}
              <div className="space-y-3 mb-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">${cartSummary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {cartSummary.freeShipping ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      `${cartSummary.shipping.toFixed(2)}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">${cartSummary.tax.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${cartSummary.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Security Badge */}
              <div className="mt-6 text-center">
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Secure SSL Encryption</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;