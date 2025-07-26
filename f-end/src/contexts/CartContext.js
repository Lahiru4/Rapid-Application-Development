import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load cart from localStorage on component mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCartItems(parsedCart);
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      // If there's an error, start with empty cart
      setCartItems([]);
    }
  }, []);

  // Save cart to localStorage whenever cartItems changes
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }, [cartItems]);

  // Add item to cart
  const addToCart = (product, quantity = 1) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      
      if (existingItem) {
        // Update quantity if item already exists
        return prevItems.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Add new item to cart
        return [...prevItems, {
          id: product.id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          stock: product.stock,
          quantity: quantity,
          category: product.category,
          sku: product.sku
        }];
      }
    });
  };

  // Remove item from cart completely
  const removeFromCart = (productId) => {
    setCartItems(prevItems => 
      prevItems.filter(item => item.id !== productId)
    );
  };

  // Update item quantity
  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  // Increase item quantity by 1
  const increaseQuantity = (productId) => {
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  // Decrease item quantity by 1
  const decreaseQuantity = (productId) => {
    setCartItems(prevItems =>
      prevItems.map(item => {
        if (item.id === productId) {
          const newQuantity = item.quantity - 1;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
        }
        return item;
      }).filter(Boolean)
    );
  };

  // Clear entire cart
  const clearCart = () => {
    setCartItems([]);
  };

  // Get cart item count
  const getCartItemCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  // Get cart subtotal (before tax and shipping)
  const getCartSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Calculate tax (8% for example)
  const getTaxAmount = (subtotal = null) => {
    const amount = subtotal || getCartSubtotal();
    return Math.round(amount * 0.08 * 100) / 100;
  };

  // Calculate shipping (free for orders over $50, otherwise $5)
  const getShippingAmount = (subtotal = null) => {
    const amount = subtotal || getCartSubtotal();
    return amount >= 50 ? 0 : 5;
  };

  // Get cart total (subtotal + tax + shipping)
  const getCartTotal = () => {
    const subtotal = getCartSubtotal();
    const tax = getTaxAmount(subtotal);
    const shipping = getShippingAmount(subtotal);
    return Math.round((subtotal + tax + shipping) * 100) / 100;
  };

  // Check if item is in cart
  const isItemInCart = (productId) => {
    return cartItems.some(item => item.id === productId);
  };

  // Get item quantity in cart
  const getItemQuantity = (productId) => {
    const item = cartItems.find(item => item.id === productId);
    return item ? item.quantity : 0;
  };

  // Check if cart is empty
  const isCartEmpty = () => {
    return cartItems.length === 0;
  };

  // Get cart summary for display
  const getCartSummary = () => {
    const subtotal = getCartSubtotal();
    const tax = getTaxAmount(subtotal);
    const shipping = getShippingAmount(subtotal);
    const total = getCartTotal();
    const itemCount = getCartItemCount();

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax,
      shipping,
      total,
      itemCount,
      items: cartItems.length,
      freeShipping: subtotal >= 50
    };
  };

  // Validate cart items (check stock availability)
  const validateCart = async () => {
    // This would typically make API calls to check current stock
    // For now, we'll just check against the stock in cart items
    const invalidItems = [];
    
    cartItems.forEach(item => {
      if (item.quantity > item.stock) {
        invalidItems.push({
          ...item,
          availableStock: item.stock,
          requestedQuantity: item.quantity
        });
      }
    });

    return {
      isValid: invalidItems.length === 0,
      invalidItems
    };
  };

  // Apply discount code (placeholder for future implementation)
  const applyDiscountCode = (code) => {
    // This would typically make an API call to validate the discount code
    // For now, we'll return a placeholder response
    return new Promise((resolve) => {
      setTimeout(() => {
        if (code === 'SAVE10') {
          resolve({
            success: true,
            discount: {
              code: 'SAVE10',
              type: 'percentage',
              value: 10,
              amount: getCartSubtotal() * 0.1
            }
          });
        } else {
          resolve({
            success: false,
            error: 'Invalid discount code'
          });
        }
      }, 1000);
    });
  };

  // Prepare cart data for checkout
  const prepareCheckoutData = () => {
    return {
      items: cartItems.map(item => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price
      })),
      summary: getCartSummary()
    };
  };

  // Context value
  const value = {
    // State
    cartItems,
    loading,

    // Cart operations
    addToCart,
    removeFromCart,
    updateQuantity,
    increaseQuantity,
    decreaseQuantity,
    clearCart,

    // Cart calculations
    getCartItemCount,
    getCartSubtotal,
    getTaxAmount,
    getShippingAmount,
    getCartTotal,
    getCartSummary,

    // Cart utilities
    isItemInCart,
    getItemQuantity,
    isCartEmpty,
    validateCart,
    applyDiscountCode,
    prepareCheckoutData,

    // Aliases for convenience
    itemCount: getCartItemCount(),
    subtotal: getCartSubtotal(),
    total: getCartTotal(),
    isEmpty: isCartEmpty()
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};