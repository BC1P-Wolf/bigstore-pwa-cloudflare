import React, { createContext, useContext, useState, useEffect } from 'react';
import { calculateItemTotal } from '../services/orderService';
import { capitalizeProductName } from '../utils/textUtils';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('vendario_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vendario_cart', JSON.stringify(cartItems));
    } catch (e) {
      console.warn('Erro ao salvar carrinho no cache local:', e);
    }
  }, [cartItems]);

  /**
   * Adiciona um item ao carrinho.
   * Suporta múltiplos itens com links personalizados diferentes.
   */
  const addToCart = (product, quantity = 1, customLink = '') => {
    const minQty = product.minOrderQuantity || 1;
    const initialQty = Math.max(quantity, minQty);
    const trimmedLink = (customLink || '').trim();

    const normCategory = (product.category || '').toLowerCase();
    const isService = normCategory === 'service' || normCategory === 'serviço' || normCategory === 'servico';

    // Se categoria for serviço (ou exigir link), exige link personalizado obrigatório
    if ((isService || product.requiresLink) && !trimmedLink) {
      throw new Error('Informe o link personalizado para prosseguir com este serviço.');
    }

    setCartItems((prevItems) => {
      // Procura se já existe exatamente o mesmo produto com o MESMO link personalizado
      const existingIndex = prevItems.findIndex(
        (item) => item.id === product.id && (item.customLink || '') === trimmedLink
      );

      if (existingIndex > -1) {
        const updated = [...prevItems];
        const newQuantity = updated[existingIndex].quantity + initialQty;
        const calc = calculateItemTotal(product.price, newQuantity, product.quantityPromotions);

        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQuantity,
          discountPercent: calc.discountPercent,
          totalPrice: calc.total
        };
        return updated;
      }

      // Novo item no carrinho
      const calc = calculateItemTotal(product.price, initialQty, product.quantityPromotions);
      const newItem = {
        cartItemId: `${product.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        id: product.id,
        name: capitalizeProductName(product.name),
        price: Number(product.price),
        imageUrl: product.imageUrl || null,
        category: product.category || 'product',
        description: product.description || '',
        minOrderQuantity: minQty,
        quantityPromotions: product.quantityPromotions || [],
        customLink: trimmedLink || null,
        quantity: initialQty,
        discountPercent: calc.discountPercent,
        totalPrice: calc.total
      };

      return [...prevItems, newItem];
    });
  };

  /**
   * Atualiza a quantidade de um item específico do carrinho
   */
  const updateQuantity = (cartItemId, newQty) => {
    setCartItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.cartItemId === cartItemId) {
          const qty = Math.max(item.minOrderQuantity || 1, newQty);
          const calc = calculateItemTotal(item.price, qty, item.quantityPromotions);
          return {
            ...item,
            quantity: qty,
            discountPercent: calc.discountPercent,
            totalPrice: calc.total
          };
        }
        return item;
      });
    });
  };

  /**
   * Remove um item do carrinho
   */
  const removeFromCart = (cartItemId) => {
    setCartItems((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  /**
   * Limpa o carrinho
   */
  const clearCart = () => {
    setCartItems([]);
  };

  /**
   * Calcula totais do carrinho
   */
  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const total = cartItems.reduce((acc, item) => acc + (item.totalPrice || item.price * item.quantity), 0);
  const totalDiscount = Math.max(0, subtotal - total);
  const totalItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const value = {
    cartItems,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal: Number(subtotal.toFixed(2)),
    total: Number(total.toFixed(2)),
    totalDiscount: Number(totalDiscount.toFixed(2)),
    totalItemsCount
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart deve ser usado dentro de CartProvider');
  }
  return context;
}
