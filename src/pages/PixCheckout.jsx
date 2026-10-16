import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Copy, 
  Check, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ShoppingBag
} from 'lucide-react';
import { ref as dbRef, query as rtdbQuery, orderByChild, equalTo, onValue, limitToFirst } from 'firebase/database';
import { rtdb } from '../services/firebase';
import { verifyPixPaymentOnServer, deleteOrdersByPaymentId } from '../services/mercadopago';

export default function PixCheckout() {
  const { paymentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const stateData = location.state || {};
  const pixData = stateData.pixData || {
    id: paymentId,
    qr_code: '',
    expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    amount: stateData.totalAmount || 0
  };

  const calculateInitialSeconds = () => {
    if (pixData.expiration) {
      const expMs = new Date(pixData.expiration).getTime();
      if (!isNaN(expMs)) {
        return Math.max(0, Math.floor((expMs - Date.now()) / 1000));
      }
    }
    return 900;
  };

  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(calculateInitialSeconds);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const hasPurgedRef = useRef(false);

  // 1. Timer de expiração regressivo do Mercado Pago
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 2. Quando o tempo do Mercado Pago expira (0s), verifica antes se já não foi aprovado e só então exclui pedidos pendentes
  useEffect(() => {
    if (timeLeft === 0 && !paymentConfirmed && !hasPurgedRef.current) {
      hasPurgedRef.current = true;
      const pid = paymentId || pixData.id;
      (async () => {
        if (pid) {
          const check = await verifyPixPaymentOnServer(pid);
          if (check?.approved) {
            setPaymentConfirmed(true);
            setTimeout(() => {
              navigate('/pedidos', { state: { initialTab: 'Na Fila' } });
            }, 1500);
            return;
          }
          await deleteOrdersByPaymentId(pid);
        }
      })();
    }
  }, [timeLeft, paymentConfirmed, paymentId, pixData.id, navigate]);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Garante que o ID do pagamento e pedidos sejam rastreados no dispositivo
  useEffect(() => {
    try {
      const prev = JSON.parse(
        localStorage.getItem('vendario_pwa_created_orders') || '[]'
      );
      const toAdd = [
        ...(stateData.orderIds || []),
        ...(pixData.id ? [pixData.id] : [])
      ];
      if (toAdd.length > 0) {
        const next = Array.from(new Set([...prev, ...toAdd]));
        localStorage.setItem('vendario_pwa_created_orders', JSON.stringify(next));
      }
    } catch {}
  }, [stateData.orderIds, pixData.id]);

  // 3. Listener em tempo real no Realtime Database (RTDB) + verificação inteligente com visibilitychange
  useEffect(() => {
    if (!paymentId || paymentConfirmed) return;

    let unsubscribe = null;
    let lastServerCheckAt = 0;

    const handleConfirmed = () => {
      if (unsubscribe) {
        try { unsubscribe(); } catch {}
        unsubscribe = null;
      }
      setPaymentConfirmed(true);
      setTimeout(() => {
        navigate('/pedidos', { state: { initialTab: 'Na Fila' } });
      }, 2500);
    };

    const startListener = () => {
      if (unsubscribe) return;
      try {
        const ordersRef = dbRef(rtdb, 'orders');
        const q = rtdbQuery(ordersRef, orderByChild('paymentId'), equalTo(paymentId), limitToFirst(5));

        unsubscribe = onValue(q, (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val();
            const orders = Object.values(val);
            const firstOrder = orders[0];
            const ps = String(firstOrder?.paymentStatus || '').trim().toLowerCase();
            const st = String(firstOrder?.status || '').trim().toLowerCase();
            if (firstOrder && (ps === 'approved' || st === 'na fila' || st === 'pending')) {
              handleConfirmed();
            }
          }
        });
      } catch (err) {
        console.warn('Listener RTDB de pedidos offline:', err);
      }
    };

    const stopListener = () => {
      if (unsubscribe) {
        try { unsubscribe(); } catch {}
        unsubscribe = null;
      }
    };

    const checkServerNow = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastServerCheckAt < 15000) return;
      lastServerCheckAt = now;
      const res = await verifyPixPaymentOnServer(paymentId);
      if (res?.approved) {
        handleConfirmed();
      }
    };

    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      startListener();
    }

    // Fallback periódico suave (a cada 45s apenas enquanto a aba estiver visível; o listener RTDB já atualiza em tempo real via webhook)
    const pollInterval = setInterval(() => {
      void checkServerNow();
    }, 45000);

    // Quando o cliente volta do app do banco para a aba do PWA, verifica imediatamente!
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopListener();
      } else {
        startListener();
        void checkServerNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopListener();
    };
  }, [paymentId, paymentConfirmed, navigate]);

  // Função para copiar código Copia e Cola
  const handleCopyCode = async () => {
    if (!pixData.qr_code) return;
    try {
      await navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('textarea');
      input.value = pixData.qr_code;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4 animate-in fade-in duration-300">
      {/* Estado: Pagamento Confirmado com Sucesso */}
      {paymentConfirmed ? (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-3xl p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            Pagamento Confirmado!
          </h2>
          <p className="text-sm text-slate-600 dark:text-purple-300 mt-2">
            Seus pedidos individuais foram gerados e encaminhados para a fila de execução.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Redirecionando para a lista de pedidos...</span>
          </div>
        </div>
      ) : timeLeft === 0 ? (
        /* Estado: Pagamento Expirado no Mercado Pago (Pedido Excluído Totalmente) */
        <div className="bg-white dark:bg-[#16122c] border border-red-200 dark:border-red-900/60 rounded-3xl p-8 text-center shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Pagamento Expirado
          </h2>
          <p className="text-xs text-slate-500 dark:text-purple-300 leading-relaxed max-w-sm mx-auto">
            O tempo limite deste pagamento Pix expirou. O pedido foi <strong>cancelado e totalmente excluído</strong> do sistema.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Fazer Novo Pedido</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Tela de Cobrança Pix Ativa */
        <div className="bg-white dark:bg-[#16122c] border border-purple-200 dark:border-purple-900/60 rounded-3xl p-6 shadow-xl space-y-5">
          {/* Header */}
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full">
              Pix
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
              Pague com Pix Instantâneo
            </h1>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1">
              R$ {Number(pixData.amount || 0).toFixed(2)}
            </div>
          </div>

          {/* Timer de Expiração */}
          <div className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold ${
            timeLeft < 180 
              ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30' 
              : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
          }`}>
            <Clock className="w-4 h-4" />
            <span>Expira em: {formatTimer(timeLeft)}</span>
          </div>

          {/* QR Code Container */}
          <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-inner flex flex-col items-center justify-center max-w-[220px] mx-auto">
            {pixData.qr_code_base64 ? (
              <img
                src={`data:image/png;base64,${pixData.qr_code_base64}`}
                alt="QR Code Pix"
                className="w-44 h-44 object-contain"
              />
            ) : (
              <QRCodeSVG
                value={pixData.qr_code || 'https://vendario.com'}
                size={180}
                level="M"
                includeMargin={false}
              />
            )}
            <span className="text-xs font-medium text-slate-500 mt-2 text-center">
              Abra o app do seu banco e aponte a câmera
            </span>
          </div>

          {/* Código Pix Copia e Cola */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider">
              Código Pix Copia e Cola
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={pixData.qr_code || ''}
                aria-label="Código Pix copia e cola"
                className="w-full pl-3 pr-24 py-2.5 bg-purple-50/50 dark:bg-[#100c22] border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-slate-600 dark:text-purple-200 font-mono truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyCode}
                className={`absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Auto-Detect Status Bar */}
          <div className="bg-purple-50/60 dark:bg-purple-950/20 rounded-2xl p-3 border border-purple-100 dark:border-purple-900/40 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-[11px] text-slate-600 dark:text-purple-300">
              <span className="font-bold text-slate-900 dark:text-white block">
                Aguardando confirmação do Pix...
              </span>
               Assim que o banco confirmar, a tela atualizará automaticamente.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
