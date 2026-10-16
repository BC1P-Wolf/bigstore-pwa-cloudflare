import React, { useState, useEffect } from 'react';
import { X, Link2, AlertCircle, Tag, Check } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { calculateItemTotal } from '../services/orderService';
import { useNavigate } from 'react-router-dom';
import { capitalizeProductName } from '../utils/textUtils';

const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';

export default function ProductModal({ product, isOpen, onClose }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const minQty = product?.minOrderQuantity || 1;
  const [quantity, setQuantity] = useState(minQty);
  const [customLink, setCustomLink] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [product?.imageUrl]);

  if (!isOpen || !product) return null;

  const normCategory = (product.category || '').toLowerCase();
  const isService = normCategory === 'service' || normCategory === 'serviço' || normCategory === 'servico';
  const calculation = calculateItemTotal(product.price, quantity, product.quantityPromotions);
  const imgSrc = !imgError && product.imageUrl ? product.imageUrl : DEFAULT_PRODUCT_IMAGE;

  const handleQuantityChange = (delta) => {
    const next = quantity + delta;
    if (next >= minQty) {
      setQuantity(next);
    }
  };

  const validateAndExecute = (actionType) => {
    setErrorMessage('');

    // Validação estrita: link obrigatório para categoria serviço
    if (isService && !customLink.trim()) {
      setErrorMessage('Este item é um serviço. O preenchimento do link personalizado é obrigatório.');
      return;
    }

    try {
      addToCart(product, quantity, customLink);

      if (actionType === 'buyNow') {
        onClose();
        navigate('/carrinho');
      } else {
        setAddedSuccess(true);
        setTimeout(() => {
          setAddedSuccess(false);
          onClose();
        }, 1000);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Erro ao processar item.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#16122c] rounded-t-3xl sm:rounded-3xl border border-purple-200 dark:border-purple-900/60 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="relative h-44 bg-gradient-to-tr from-purple-900 via-purple-800 to-indigo-900 overflow-hidden shrink-0">
          <img 
            src={imgSrc} 
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover opacity-85"
          />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-4">
            <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md backdrop-blur-md ${
              isService 
                ? 'bg-amber-500/90 text-white' 
                : 'bg-purple-600/90 text-white'
            }`}>
              {isService ? '⚡ Serviço Digital' : '📦 Produto'}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
              {capitalizeProductName(product.name)}
            </h2>
            <p className="text-sm text-slate-600 dark:text-purple-300/80 mt-1 leading-relaxed">
              {product.description || 'Produto de alta qualidade disponível para entrega imediata.'}
            </p>
          </div>

          {/* Faixas de Desconto por Quantidade */}
          {product.quantityPromotions && product.quantityPromotions.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 mb-2">
                <Tag className="w-4 h-4" />
                <span>Promoção por Quantidade:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.quantityPromotions.map((promo, idx) => (
                  <span
                    key={idx}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                      quantity >= promo.quantity
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white dark:bg-[#20193d] text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                    }`}
                  >
                    A partir de {promo.quantity} un: <strong>-{promo.discountPercent}%</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Campo Obrigatório para Categoria de Serviço */}
          {isService && (
            <div className="space-y-1.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <label className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                <Link2 className="w-4 h-4" />
                <span>Link do Serviço *</span>
              </label>
              <p className="text-xs text-slate-600 dark:text-purple-300/90 mb-1">
                Insira o link da conta, perfil, publicação ou canal de destino deste serviço:
              </p>
              <input
                type="text"
                value={customLink}
                onChange={(e) => {
                  setCustomLink(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Ex: https://instagram.com/seu.perfil"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#100c22] border border-amber-300 dark:border-amber-500/40 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />
            </div>
          )}

          {/* Quantidade */}
          <div className="flex items-center justify-between p-3 bg-purple-50/60 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/40">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">
                Quantidade
              </span>
              {minQty > 1 && (
                <span className="text-[10px] text-purple-500 dark:text-purple-400">
                  Mínimo: {minQty} unidades
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= minQty}
                className="w-9 h-9 rounded-xl bg-white dark:bg-purple-900/60 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-200 flex items-center justify-center font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition"
              >
                -
              </button>
              <span className="font-extrabold text-base w-8 text-center text-slate-900 dark:text-white">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => handleQuantityChange(1)}
                className="w-9 h-9 rounded-xl bg-white dark:bg-purple-900/60 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-200 flex items-center justify-center font-bold text-lg active:scale-95 transition"
              >
                +
              </button>
            </div>
          </div>

          {/* Resumo de Preço e Desconto */}
          <div className="p-3 bg-white dark:bg-[#1f173b] rounded-2xl border border-purple-200 dark:border-purple-800/60 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-purple-300 block">Valor Final:</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-700 dark:text-purple-300">
                  R$ {calculation.total.toFixed(2)}
                </span>
                {calculation.discountPercent > 0 && (
                  <span className="text-xs line-through text-slate-400 dark:text-purple-400/60">
                    R$ {calculation.subtotal.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {calculation.discountPercent > 0 && (
              <span className="text-xs font-bold bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 px-2.5 py-1 rounded-full">
                {calculation.discountPercent}% OFF aplicado!
              </span>
            )}
          </div>

          {/* Alerta de Erro */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50 dark:bg-[#120e26] border-t border-purple-100 dark:border-purple-900/50 grid grid-cols-2 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => validateAndExecute('addToCart')}
            disabled={addedSuccess}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-purple-950/40 hover:bg-purple-50 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-200 font-bold text-xs uppercase tracking-wider transition active:scale-95"
          >
            {addedSuccess ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400">Adicionado!</span>
              </>
            ) : (
              <>
                <span>No Carrinho</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => validateAndExecute('buyNow')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition active:scale-95"
          >
            <span>Comprar Agora</span>
          </button>
        </div>
      </div>
    </div>
  );
}
