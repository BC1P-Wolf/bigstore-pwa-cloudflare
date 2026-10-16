import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { createPixPayment } from '../services/mercadopago';
import { capitalizeProductName } from '../utils/textUtils';
import { 
  ShoppingBag, 
  Trash2, 
  Link2, 
  Tag, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle 
} from 'lucide-react';

export default function Cart() {
  const { cartItems, updateQuantity, removeFromCart, clearCart, subtotal, total, totalDiscount } = useCart();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [errorCheckout, setErrorCheckout] = useState('');

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setErrorCheckout('');
    setLoadingCheckout(true);

    try {
      // 1. Gera cobrança Pix E cria pedidos granulares via Cloud Function segura
      // A Cloud Function recebe os cartItems (incluindo customLink) e cria os pedidos no servidor
      const pixData = await createPixPayment({
        amount: total,
        cartItems: cartItems,
        payerEmail: currentUser?.email || 'cliente@vendario.com',
        payerName: userProfile?.displayName || currentUser?.displayName || 'Cliente Vendário',
      });

      // Os pedidos já foram criados pela Cloud Function / API (server-side)
      const createdOrderIds = pixData.orderIds || [];

      // Salva IDs rastreados no localStorage para acesso offline e sincronização garantida
      try {
        const prev = JSON.parse(
          localStorage.getItem('vendario_pwa_created_orders') || '[]'
        );
        const next = Array.from(
          new Set([...prev, ...createdOrderIds, ...(pixData.id ? [pixData.id] : [])])
        );
        localStorage.setItem('vendario_pwa_created_orders', JSON.stringify(next));
      } catch {}

      // 2. Limpa o carrinho de compras após os pedidos serem criados no servidor
      clearCart();

      // 3. Redireciona para a tela de pagamento com o QR Code e timer
      navigate(`/checkout/pix/${pixData.id}`, {
        state: {
          pixData,
          orderIds: createdOrderIds,
          totalAmount: total
        }
      });
    } catch (err) {
      console.error('Erro ao processar checkout:', err);
      setErrorCheckout(err.message || 'Falha ao gerar pagamento Pix. Tente novamente.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="py-12 text-center animate-in fade-in duration-200">
        <div className="w-20 h-20 bg-purple-100 dark:bg-purple-950/50 rounded-3xl flex items-center justify-center mx-auto mb-4 text-purple-600 dark:text-purple-300">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Seu carrinho está vazio
        </h2>
        <p className="text-xs text-slate-500 dark:text-purple-300/80 mt-1 max-w-xs mx-auto">
          Explore nosso catálogo exclusivo de serviços e produtos para turbinar seus resultados.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 inline-flex items-center gap-2 py-3 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          <span>Explorar Catálogo</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1 border-b border-purple-100 dark:border-purple-900/40">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            Meu Carrinho
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-purple-400">
            {cartItems.length} {cartItems.length === 1 ? 'item configurado' : 'itens configurados'}
          </p>
        </div>

        <button
          onClick={clearCart}
          className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-1 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Limpar</span>
        </button>
      </div>

      {errorCheckout && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorCheckout}</span>
        </div>
      )}

      {/* Lista de Itens do Carrinho */}
      <div className="space-y-3">
        {cartItems.map((item) => {
          const normCategory = (item.category || '').toLowerCase();
          const isService = normCategory === 'service' || normCategory === 'serviço' || normCategory === 'servico';

          return (
            <div
              key={item.cartItemId}
              className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl p-4 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                {/* Imagem */}
                <div className="w-14 h-14 rounded-xl bg-purple-950/20 overflow-hidden shrink-0 border border-purple-200/50 dark:border-purple-800">
                  <img
                    src={item.imageUrl || '/default-product.svg'}
                    alt={item.name}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/default-product.svg';
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Título e Preço Unitário */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      isService ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-purple-600/15 text-purple-600 dark:text-purple-400'
                    }`}>
                      {isService ? 'Serviço' : 'Produto'}
                    </span>
                    {item.discountPercent > 0 && (
                      <span className="text-[10px] font-bold bg-green-500/15 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                        -{item.discountPercent}% OFF
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate capitalize">
                    {capitalizeProductName(item.name)}
                  </h3>

                  <p className="text-[11px] text-slate-500 dark:text-purple-400 mt-0.5">
                    Preço base: R$ {item.price.toFixed(2)}
                  </p>
                </div>

                {/* Remover Botão */}
                <button
                  onClick={() => removeFromCart(item.cartItemId)}
                  className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center hover:bg-red-100 transition active:scale-95 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Link Customizado Associado (Se Serviço) */}
              {isService && item.customLink && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-2.5 flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold block">
                      Destino / Link:
                    </span>
                    <span className="text-xs text-slate-800 dark:text-white truncate block font-mono">
                      {item.customLink}
                    </span>
                  </div>
                </div>
              )}

              {/* Controles de Quantidade e Total do Item */}
              <div className="flex items-center justify-between pt-1 border-t border-purple-50 dark:border-purple-900/30">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                    disabled={item.quantity <= (item.minOrderQuantity || 1)}
                    aria-label={`Diminuir quantidade de ${item.name}`}
                    className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-200 font-bold text-sm flex items-center justify-center disabled:opacity-40 transition active:scale-95"
                  >
                    -
                  </button>
                  <span className="font-extrabold text-xs w-6 text-center text-slate-900 dark:text-white">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                    aria-label={`Aumentar quantidade de ${item.name}`}
                    className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-200 font-bold text-sm flex items-center justify-center transition active:scale-95"
                  >
                    +
                  </button>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-purple-700 dark:text-purple-300 block">
                    R$ {(item.totalPrice || item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo da Compra */}
      <div className="bg-white dark:bg-[#16122c] border border-purple-200 dark:border-purple-900/60 rounded-2xl p-4 shadow-md space-y-2.5">
        <h4 className="text-xs font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider">
          Resumo do Pedido
        </h4>

        <div className="flex justify-between text-xs text-slate-600 dark:text-purple-300">
          <span>Subtotal</span>
          <span>R$ {subtotal.toFixed(2)}</span>
        </div>

        {totalDiscount > 0 && (
          <div className="flex justify-between text-xs font-bold text-green-600 dark:text-green-400">
            <span className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              Descontos de Quantidade
            </span>
            <span>- R$ {totalDiscount.toFixed(2)}</span>
          </div>
        )}

        <div className="pt-2 border-t border-purple-100 dark:border-purple-900/50 flex justify-between items-baseline">
          <span className="text-sm font-bold text-slate-900 dark:text-white">Total a Pagar</span>
          <span className="text-xl font-black text-purple-700 dark:text-purple-300">
            R$ {total.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1 text-[11px] text-purple-700 dark:text-purple-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Pagamento instantâneo via Pix</span>
        </div>

        <button
          onClick={handleCheckout}
          disabled={loadingCheckout}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition active:scale-95 mt-3"
        >
          {loadingCheckout ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Pagar via Pix</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
