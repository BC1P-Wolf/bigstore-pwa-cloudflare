import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ref as dbRef, onValue, query as rtdbQuery, orderByChild, equalTo, limitToLast } from 'firebase/database';
import { rtdb } from '../services/firebase';
import StatusBadge from '../components/StatusBadge';
import ChatModal from '../components/ChatModal';
import { 
  Package, 
  MessageSquare, 
  Link2, 
  Clock, 
  ShoppingBag, 
  CheckCircle, 
  QrCode, 
  ArrowRight, 
  UserCheck, 
  ChevronLeft,
  ChevronRight,
  Archive,
  Calendar,
  Eye,
  X,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  getMercadoPagoExpirationTime,
  isOrderPaymentExpired,
  deleteOrderTotally
} from '../services/mercadopago';
import { getSyncCachedProducts } from '../services/catalogCache';
import { capitalizeProductName } from '../utils/textUtils';
import { fetchDashboardApi } from '../services/apiConfig';

/**
 * Categoriza o pedido ativo em uma das 4 categorias canônicas:
 * 1. 'Em Progresso': Operador assumiu o atendimento
 * 2. 'Na Fila': Pago e aguardando operador assumir
 * 3. 'Aguardando Pagamento': Pix pendente de pagamento
 * 4. 'Concluído': Atendimento finalizado
 */
export function getOrderCategory(order) {
  const st = String(order?.status || '').trim().toLowerCase();
  const ps = String(order?.paymentStatus || '').trim().toLowerCase();

  if (st === 'concluído' || st === 'concluido' || st === 'completed') {
    return 'Concluído';
  }
  if (st === 'em progresso' || st === 'in_progress') {
    return 'Em Progresso';
  }
  if (ps === 'approved' || st === 'na fila' || st === 'pending') {
    return 'Na Fila';
  }
  if (
    ps === 'pending' ||
    st === 'aguardando pagamento' ||
    st === 'pending_payment'
  ) {
    return 'Aguardando Pagamento';
  }
  return 'Na Fila';
}

/**
 * 📜 Modal dedicado para exibição de Pedido Arquivado e seu Histórico de Conversa
 */
function ArchivedOrderModal({ order, isOpen, onClose }) {
  if (!isOpen || !order) return null;

  const chatEntries = order.chatHistory
    ? Object.entries(order.chatHistory).map(([id, msg]) => ({
        id,
        ...msg,
        createdAtMillis:
          typeof msg.createdAt === 'number'
            ? msg.createdAt
            : typeof msg.createdAtMillis === 'number'
            ? msg.createdAtMillis
            : Date.now(),
      })).sort((a, b) => (a.createdAtMillis || 0) - (b.createdAtMillis || 0))
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#15112b] rounded-3xl border border-purple-200 dark:border-purple-800/60 shadow-2xl overflow-hidden flex flex-col h-[600px] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-800 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Arquivo Histórico</h3>
                <span className="text-[10px] bg-purple-600/70 text-purple-200 px-2 py-0.5 rounded-full font-bold">
                  Imutável
                </span>
              </div>
              <p className="text-[11px] text-purple-200 truncate max-w-[220px]">
                Pedido #{order.id?.slice(-8) || order.id} • {order.customerName || 'Cliente'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumo do Pedido */}
        <div className="bg-purple-50 dark:bg-purple-950/40 p-3.5 border-b border-purple-100 dark:border-purple-900/40 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 dark:text-purple-100">
              {order.productName || 'Serviço'}
            </span>
            <span className="font-extrabold text-purple-700 dark:text-purple-300">
              R$ {Number(order.totalPrice || order.total || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-purple-400">
            <span>Cliente: <strong>{order.customerName || order.customerEmail || 'Não informado'}</strong></span>
            <span>Operador: <strong>{order.assignedOperatorName || 'Não atribuído'}</strong></span>
          </div>
          {order.customLink && (
            <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 truncate bg-white/60 dark:bg-black/30 p-1.5 rounded-lg border border-purple-100 dark:border-purple-900/40">
              Link: {order.customLink}
            </div>
          )}
        </div>

        {/* Histórico da Conversa */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#faf8ff] dark:bg-[#100d22]">
          <div className="text-center pb-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-purple-400 bg-purple-100/50 dark:bg-purple-950/50 px-2.5 py-1 rounded-full">
              Histórico de Mensagens Preservado
            </span>
          </div>

          {chatEntries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-purple-400/60">
              <MessageSquare className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-xs font-medium">Nenhuma mensagem registrada neste pedido.</p>
              <p className="text-[11px] text-slate-400">O pedido foi atendido sem troca de mensagens ou fotos no chat.</p>
            </div>
          ) : (
            chatEntries.map((msg) => {
              const isCustomer = msg.senderRole === 'customer';
              const isOwnerSender = msg.senderRole === 'owner';
              const timeStr = msg.createdAtMillis
                ? new Date(msg.createdAtMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-baseline gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-purple-400">
                      {isCustomer
                        ? (msg.senderName || 'Cliente')
                        : isOwnerSender
                        ? 'Administrador'
                        : (msg.senderName || 'Operador')}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-purple-500">
                      {timeStr}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm space-y-1.5 ${
                      isCustomer
                        ? 'bg-gradient-to-r from-purple-700 to-indigo-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-[#20193d] border border-purple-100 dark:border-purple-800 text-slate-800 dark:text-purple-100 rounded-tl-none'
                    }`}
                  >
                    {msg.imageUrl && (
                      <a
                        href={msg.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl overflow-hidden border border-white/20 hover:opacity-90 transition"
                      >
                        <img
                          src={msg.imageUrl}
                          alt="Anexo arquivado"
                          className="rounded-xl max-h-48 object-cover w-full"
                          loading="lazy"
                        />
                      </a>
                    )}
                    {msg.text && <div>{msg.text}</div>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white dark:bg-[#15112b] border-t border-purple-100 dark:border-purple-900/50 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 dark:text-purple-400">
            Total de mensagens: <strong>{chatEntries.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isOwner = userProfile?.role === 'owner';

  // Navegação Principal de Abas (igual à fila de operadores: Pedidos Ativos vs Pedidos Concluídos)
  const initialMainTab = location.state?.mainTab || (location.state?.initialTab === 'Concluído' ? 'completed' : 'active');
  const [mainTab, setMainTab] = useState(initialMainTab);

  // Sub-abas de Pedidos Ativos: 'Em Progresso' | 'Na Fila' | 'Aguardando Pagamento'
  const initialActiveCategory = location.state?.initialTab && location.state?.initialTab !== 'Concluído'
    ? location.state.initialTab
    : 'Em Progresso';
  const [activeFilter, setActiveFilter] = useState(initialActiveCategory);

  // Sub-visão na aba Concluídos: 'today' (Concluídos de hoje no RTDB) | 'archived' (Histórico Arquivado no Storage)
  const [completedSubTab, setCompletedSubTab] = useState('today');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedPage, setCompletedPage] = useState(1);
  const [activeChatOrder, setActiveChatOrder] = useState(null);
  const [now, setNow] = useState(Date.now());
  const unsubscribeRef = useRef(null);

  // Estados do Arquivo Histórico (Cloud Storage)
  const [archiveDates, setArchiveDates] = useState([]);
  const [loadingArchiveDates, setLoadingArchiveDates] = useState(false);
  const [archiveDatePage, setArchiveDatePage] = useState(1);
  const [selectedArchiveDate, setSelectedArchiveDate] = useState(null);
  const [archivedOrdersOfDay, setArchivedOrdersOfDay] = useState([]);
  const [loadingDayArchive, setLoadingDayArchive] = useState(false);
  const [selectedArchivedModalOrder, setSelectedArchivedModalOrder] = useState(null);
  const DATES_PER_PAGE = 5;

  const hasPendingPaymentOrders = orders.some(
    (o) => getOrderCategory(o) === 'Aguardando Pagamento'
  );

  // 1. Relógio para pedidos 'Aguardando Pagamento'
  useEffect(() => {
    if (!hasPendingPaymentOrders) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [hasPendingPaymentOrders]);

  // 2. Monitor de expiração contínuo do Mercado Pago
  useEffect(() => {
    if (!orders || orders.length === 0) return;
    const pendingOrders = orders.filter((o) => getOrderCategory(o) === 'Aguardando Pagamento');
    if (pendingOrders.length === 0) return;

    const expired = pendingOrders.filter((o) => isOrderPaymentExpired(o));
    if (expired.length > 0) {
      const expiredIds = new Set(expired.map((o) => o.id));
      setOrders((prev) => prev.filter((o) => !expiredIds.has(o.id)));
      expired.forEach((o) => {
        deleteOrderTotally(o.id).catch(() => {});
      });
    }
  }, [orders, now]);

  // 3. Listener em tempo real do RTDB
  useEffect(() => {
    if (!currentUser?.uid) {
      setOrders([]);
      setLoading(false);
      return;
    }

    let active = true;
    let unsubUid = null;
    let unsubGuest = null;

    const cachedOrdersKey = `vendario_pwa_cached_orders_${currentUser.uid}`;
    const saved = localStorage.getItem(cachedOrdersKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrders(parsed);
          setLoading(false);
        }
      } catch {}
    }

    const connectListeners = () => {
      try {
        const ordersRef = dbRef(rtdb, 'orders');
        const userOrdersQuery = rtdbQuery(
          ordersRef,
          orderByChild('customerId'),
          equalTo(currentUser.uid),
          limitToLast(100)
        );

        unsubUid = onValue(userOrdersQuery, (snap) => {
          if (!active) return;
          const val = snap.val() || {};
          const currentArr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
          setOrders(currentArr);
          setLoading(false);
          try {
            localStorage.setItem(cachedOrdersKey, JSON.stringify(currentArr));
          } catch {}
        });
      } catch (err) {
        console.warn('Erro ao conectar listener de pedidos no RTDB:', err);
        setLoading(false);
      }
    };

    const disconnectListeners = () => {
      if (unsubUid) {
        try { unsubUid(); } catch {}
        unsubUid = null;
      }
      if (unsubGuest) {
        try { unsubGuest(); } catch {}
        unsubGuest = null;
      }
    };

    connectListeners();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        disconnectListeners();
      } else if (document.visibilityState === 'visible') {
        connectListeners();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    unsubscribeRef.current = disconnectListeners;

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnectListeners();
      unsubscribeRef.current = null;
    };
  }, [currentUser?.uid]);

  // 4. Carrega a lista de datas arquivadas no Cloud Storage (somente se for Administrador)
  useEffect(() => {
    if (!isOwner || mainTab !== 'completed' || completedSubTab !== 'archived') return;
    if (archiveDates.length > 0) return;

    let active = true;
    setLoadingArchiveDates(true);

    const loadDates = async () => {
      try {
        // Verifica cache de datas em sessionStorage (economiza requisições)
        const cachedDatesRaw = sessionStorage.getItem('vendario_archive_dates');
        if (cachedDatesRaw) {
          try {
            const parsed = JSON.parse(cachedDatesRaw);
            if (active && Array.isArray(parsed) && parsed.length > 0) {
              setArchiveDates(parsed);
              setLoadingArchiveDates(false);
              return;
            }
          } catch {}
        }

        const token = await currentUser.getIdToken();
        const res = await fetchDashboardApi('/api/orders/archives?action=dates', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (active && Array.isArray(data.dates)) {
          setArchiveDates(data.dates);
          sessionStorage.setItem('vendario_archive_dates', JSON.stringify(data.dates));
        }
      } catch (err) {
        console.warn('Erro ao carregar datas arquivadas:', err);
      } finally {
        if (active) setLoadingArchiveDates(false);
      }
    };

    loadDates();
    return () => { active = false; };
  }, [isOwner, mainTab, completedSubTab, currentUser, archiveDates.length]);

  // 5. Carrega o arquivo JSON consolidado de uma data específica
  const loadArchiveDateDetails = async (date) => {
    setSelectedArchiveDate(date);
    setLoadingDayArchive(true);

    const cacheKey = `vendario_archive_day_${date}`;
    // ⚡ Cache imutável de 1 ano no cliente: arquivos de datas passadas nunca mudam!
    const cachedDay = localStorage.getItem(cacheKey);
    if (cachedDay) {
      try {
        const parsed = JSON.parse(cachedDay);
        const ordersList = Object.entries(parsed.orders || {}).map(([id, o]) => ({ id, ...o }));
        setArchivedOrdersOfDay(ordersList);
        setLoadingDayArchive(false);
        return;
      } catch {}
    }

    try {
      const token = await currentUser.getIdToken();
      const res = await fetchDashboardApi(`/api/orders/archives?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.orders) {
        const ordersList = Object.entries(data.orders).map(([id, o]) => ({ id, ...o }));
        setArchivedOrdersOfDay(ordersList);
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } else {
        setArchivedOrdersOfDay([]);
      }
    } catch (err) {
      console.warn('Erro ao consultar arquivo do dia:', err);
      setArchivedOrdersOfDay([]);
    } finally {
      setLoadingDayArchive(false);
    }
  };

  // Contadores
  const countInProgress = orders.filter((o) => getOrderCategory(o) === 'Em Progresso').length;
  const countInQueue = orders.filter((o) => getOrderCategory(o) === 'Na Fila').length;
  const countPendingPayment = orders.filter((o) => getOrderCategory(o) === 'Aguardando Pagamento').length;
  const countCompletedToday = orders.filter((o) => getOrderCategory(o) === 'Concluído').length;
  const countActiveTotal = countInProgress + countInQueue + countPendingPayment;

  // Sub-abas da aba de Pedidos Ativos (SEM o status Concluído!)
  const activeTabs = [
    { id: 'Em Progresso', label: 'Em Progresso', count: countInProgress },
    { id: 'Na Fila', label: 'Na Fila' },
    { id: 'Aguardando Pagamento', label: 'Aguardando Pagamento' },
  ];

  // Filtro de pedidos ativos
  const filteredActiveOrders = orders.filter((o) => getOrderCategory(o) === activeFilter);

  // Pedidos Concluídos de Hoje (RTDB) com paginação
  const completedTodayOrders = orders.filter((o) => getOrderCategory(o) === 'Concluído');
  const COMPLETED_PAGE_SIZE = 5;
  const totalCompletedPages = Math.ceil(completedTodayOrders.length / COMPLETED_PAGE_SIZE) || 1;
  const displayedCompletedTodayOrders = completedTodayOrders.slice(
    (completedPage - 1) * COMPLETED_PAGE_SIZE,
    completedPage * COMPLETED_PAGE_SIZE
  );

  // Paginação de Datas Arquivadas
  const totalDatePages = Math.ceil(archiveDates.length / DATES_PER_PAGE) || 1;
  const paginatedArchiveDates = archiveDates.slice(
    (archiveDatePage - 1) * DATES_PER_PAGE,
    archiveDatePage * DATES_PER_PAGE
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-purple-100 dark:border-purple-900/40">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              Gestão de Pedidos
            </h1>
            {isOwner && (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-gradient-to-r from-purple-700 to-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm">
                <ShieldCheck className="w-3 h-3" />
                <span>Admin</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-purple-400 truncate">
            {isOwner
              ? 'Visualize pedidos ativos e consulte o arquivo histórico completo'
              : 'Acompanhe seus pedidos e converse com o operador em tempo real'}
          </p>
        </div>
      </div>

      {/* ─── NAVEGAÇÃO PRINCIPAL (Abas: Pedidos Ativos vs Pedidos Concluídos) ─── */}
      <div className="flex bg-slate-100 dark:bg-[#16122c] p-1 rounded-2xl border border-purple-100 dark:border-purple-900/50">
        <button
          type="button"
          onClick={() => {
            setMainTab('active');
            setCompletedPage(1);
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            mainTab === 'active'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-600 dark:text-purple-300 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Pedidos</span>
          {countActiveTotal > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              mainTab === 'active' ? 'bg-white/20 text-white' : 'bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
            }`}>
              {countActiveTotal}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setMainTab('completed');
            setCompletedPage(1);
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            mainTab === 'completed'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-600 dark:text-purple-300 hover:text-slate-900'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Pedidos Concluídos</span>
          {countCompletedToday > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              mainTab === 'completed' ? 'bg-white/20 text-white' : 'bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
            }`}>
              {countCompletedToday}
            </span>
          )}
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. ABA DE PEDIDOS ATIVOS (Sem o status 'Concluído'!)                      */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {mainTab === 'active' && (
        <div className="space-y-4">
          {/* Sub-abas de filtro de pedidos ativos */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {activeTabs.map((tab) => {
              const isSelected = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-white dark:bg-[#16122c] text-slate-600 dark:text-purple-300 border border-purple-100 dark:border-purple-900/50 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Atalho Rápido para Atendimento Ativo */}
          {activeFilter !== 'Em Progresso' && countInProgress > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('Em Progresso')}
              className="w-full p-2.5 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/30 rounded-2xl flex items-center justify-between text-xs text-purple-700 dark:text-purple-300 transition text-left"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>
                  Você tem <strong>{countInProgress} {countInProgress === 1 ? 'pedido em atendimento' : 'pedidos em atendimento'}</strong>.
                </span>
              </div>
              <span className="font-bold underline text-[11px] shrink-0 ml-2">Abrir chat →</span>
            </button>
          )}

          {/* Lista de Pedidos Ativos */}
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 bg-purple-100/50 dark:bg-purple-950/20 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredActiveOrders.length === 0 ? (
            <div className="py-12 text-center bg-white dark:bg-[#16122c] rounded-3xl border border-purple-100 dark:border-purple-900/50 p-6">
              <div className="w-16 h-16 bg-purple-50 dark:bg-purple-950/50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-purple-600 dark:text-purple-400">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Nenhum pedido em &quot;{activeFilter}&quot;
              </h3>
              <p className="text-xs text-slate-500 dark:text-purple-300/80 mt-1 max-w-xs mx-auto">
                {activeFilter === 'Aguardando Pagamento'
                  ? 'Você não possui pagamentos Pix pendentes.'
                  : activeFilter === 'Em Progresso'
                  ? 'Nenhum pedido está sendo atendido no momento.'
                  : 'Nenhum pedido pago aguardando operador no momento.'}
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Ver Produtos da Loja</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredActiveOrders.map((order) => {
                const categoryType = getOrderCategory(order);
                const normCategory = (order.category || '').toLowerCase();
                const isService = normCategory === 'service' || normCategory === 'serviço' || normCategory === 'servico';
                const inProgress = categoryType === 'Em Progresso';
                const isPendingPayment = categoryType === 'Aguardando Pagamento';

                return (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl p-4 shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-slate-400 dark:text-purple-400">
                        ID: #{order.id?.slice(-8)}
                      </span>
                      <StatusBadge status={isPendingPayment ? 'Aguardando Pagamento' : inProgress ? 'Em Progresso' : 'Na Fila'} />
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-xl bg-purple-950/20 overflow-hidden shrink-0 border border-purple-200/50 dark:border-purple-800">
                        {(() => {
                          let imgSrc = order.productImage;
                          if (!imgSrc) {
                            const cachedCat = getSyncCachedProducts()?.products || [];
                            const matched = cachedCat.find((p) => p.id === order.productId || p.name === order.productName);
                            imgSrc = matched?.imageUrl || matched?.imagePath || '';
                          }
                          return imgSrc ? (
                            <img src={imgSrc} alt={order.productName} loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-purple-400">
                              <Package className="w-6 h-6" />
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate capitalize">
                          {capitalizeProductName(order.productName)}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-purple-400">
                          <span>Qtd: <strong>{order.quantity}</strong></span>
                          <span>•</span>
                          <span>Total: <strong className="text-purple-700 dark:text-purple-300 font-extrabold">R$ {Number(order.totalPrice || order.total || 0).toFixed(2)}</strong></span>
                        </div>
                      </div>
                    </div>

                    {isService && order.customLink && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block">
                            Link de Destino:
                          </span>
                          <span className="text-xs font-mono text-slate-800 dark:text-white truncate block">
                            {order.customLink}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Ação Aguardando Pagamento */}
                    {isPendingPayment && (() => {
                      const expTime = getMercadoPagoExpirationTime(order);
                      const remainingMs = Math.max(0, expTime - now);
                      const remainingSec = Math.floor(remainingMs / 1000);
                      const minutes = Math.floor(remainingSec / 60);
                      const seconds = remainingSec % 60;
                      const formattedTimer = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                      const isUrgent = remainingSec < 180;

                      return (
                        <div className="pt-2.5 border-t border-amber-100 dark:border-amber-900/30 space-y-2.5">
                          <div className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-colors ${
                            isUrgent ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                          }`}>
                            <div className="flex items-center gap-1.5">
                              <Clock className={`w-4 h-4 ${isUrgent ? 'animate-pulse text-red-500' : 'text-amber-500'}`} />
                              <span>Expira no Mercado Pago em:</span>
                            </div>
                            <span className="font-mono text-sm tracking-wider font-extrabold">{formattedTimer}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/checkout/pix/${order.paymentId}`, {
                                state: {
                                  orderIds: [order.id],
                                  totalAmount: order.totalPrice || order.total,
                                  pixData: { id: order.paymentId, amount: order.totalPrice || order.total, qr_code: order.qrCode },
                                },
                              })}
                              className="flex-1 py-2.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition active:scale-95"
                            >
                              <QrCode className="w-4 h-4" />
                              <span>Pagar Pix Agora</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm("Deseja realmente cancelar este pedido?")) {
                                  setOrders((prev) => prev.filter((o) => o.id !== order.id));
                                  await deleteOrderTotally(order.id);
                                }
                              }}
                              className="py-2.5 px-3 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 dark:border-purple-800 rounded-xl text-xs font-bold transition active:scale-95"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Ação Em Progresso */}
                    {inProgress && (
                      <div className="pt-2 border-t border-purple-50 dark:border-purple-900/30 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300">
                          <UserCheck className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span>Atendido por: <strong>{order.assignedOperatorName || 'Operador'}</strong></span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveChatOrder(order)}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition active:scale-95"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Abrir Chat com o Operador</span>
                        </button>
                      </div>
                    )}

                    {/* Ação Na Fila */}
                    {!isPendingPayment && !inProgress && (
                      <div className="pt-2 border-t border-purple-50 dark:border-purple-900/30 text-xs text-slate-500 dark:text-purple-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>Pagamento aprovado. Aguardando operador assumir o pedido.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. ABA DE PEDIDOS CONCLUÍDOS (Histórico + Arquivo Storage para Admin)     */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {mainTab === 'completed' && (
        <div className="space-y-4">
          {/* Se for Administrador, exibe o seletor entre Concluídos de Hoje e Arquivo Histórico */}
          {isOwner && (
            <div className="flex items-center gap-2 bg-purple-50/50 dark:bg-[#16122c] p-1.5 rounded-2xl border border-purple-100 dark:border-purple-900/50">
              <button
                type="button"
                onClick={() => setCompletedSubTab('today')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  completedSubTab === 'today'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-purple-300 hover:bg-purple-100/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Concluídos Hoje ({completedTodayOrders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCompletedSubTab('archived')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  completedSubTab === 'archived'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-purple-300 hover:bg-purple-100/50'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Arquivo Histórico (Storage)</span>
              </button>
            </div>
          )}

          {/* Sub-Visão A: Concluídos Hoje (RTDB) */}
          {(!isOwner || completedSubTab === 'today') && (
            <div className="space-y-3.5">
              {loading ? (
                <div className="space-y-3 py-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-32 bg-purple-100/50 dark:bg-purple-950/20 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : completedTodayOrders.length === 0 ? (
                <div className="py-12 text-center bg-white dark:bg-[#16122c] rounded-3xl border border-purple-100 dark:border-purple-900/50 p-6">
                  <CheckCircle className="w-12 h-12 text-purple-400 mx-auto mb-2 opacity-60" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Nenhum pedido concluído hoje</h3>
                  <p className="text-xs text-slate-500 dark:text-purple-400 mt-1">
                    {isOwner
                      ? 'Pedidos concluídos em dias anteriores estão preservados no "Arquivo Histórico".'
                      : 'Seus pedidos concluídos de hoje aparecerão aqui após a entrega.'}
                  </p>
                </div>
              ) : (
                <>
                  {displayedCompletedTodayOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl p-4 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-slate-400">ID: #{order.id?.slice(-8)}</span>
                        <StatusBadge status="Concluído" />
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white capitalize">
                            {capitalizeProductName(order.productName)}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-purple-400 mt-0.5">
                            Qtd: {order.quantity} • Total: <strong className="text-purple-700 dark:text-purple-300">R$ {Number(order.totalPrice || order.total || 0).toFixed(2)}</strong>
                          </p>
                        </div>
                        {order.completedAt && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(order.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="pt-2 border-t border-purple-50 dark:border-purple-900/30 flex items-center justify-between text-xs text-slate-500 dark:text-purple-400">
                        <span>Concluído por: <strong>{order.assignedOperatorName || 'Operador'}</strong></span>
                        <button
                          type="button"
                          onClick={() => setActiveChatOrder(order)}
                          className="font-bold text-purple-600 dark:text-purple-400 underline text-[11px] flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Ver Chat</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Paginação de Concluídos Hoje */}
                  {totalCompletedPages > 1 && (
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl shadow-sm text-xs">
                      <button
                        type="button"
                        onClick={() => setCompletedPage((p) => Math.max(1, p - 1))}
                        disabled={completedPage === 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold transition disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Anterior</span>
                      </button>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-purple-300">
                        Página <strong>{completedPage}</strong> de <strong>{totalCompletedPages}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setCompletedPage((p) => Math.min(totalCompletedPages, p + 1))}
                        disabled={completedPage === totalCompletedPages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold transition disabled:opacity-40"
                      >
                        <span>Próxima</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Sub-Visão B: Arquivo Histórico no Storage (Exclusivo Administrador) */}
          {isOwner && completedSubTab === 'archived' && (
            <div className="space-y-4">
              {/* Barra Informativa de Otimização e Free Tier */}
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/60 rounded-2xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-200">
                  <Archive className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Histórico de Pedidos Arquivados (Google Cloud Storage)</span>
                </div>
                <p className="text-[11px] text-purple-700 dark:text-purple-300">
                  Cada dia é consolidado em um único arquivo com cache imutável de 1 ano. Navegar entre os dias gera <strong>0 custos</strong> no Firebase.
                </p>
              </div>

              {/* Seletor de Datas Arquivadas com Paginação por Data */}
              <div className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span>Selecione a Data do Arquivo</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Total: {archiveDates.length} {archiveDates.length === 1 ? 'dia' : 'dias'}
                  </span>
                </div>

                {loadingArchiveDates ? (
                  <div className="py-6 flex flex-col items-center justify-center text-xs text-purple-600 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Consultando índice de datas arquivadas...</span>
                  </div>
                ) : archiveDates.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 dark:text-purple-400">
                    Nenhum arquivo histórico encontrado ainda. O primeiro fechamento ocorre automaticamente às 03:00.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {paginatedArchiveDates.map((item) => {
                        const isSelected = selectedArchiveDate === item.date;
                        return (
                          <button
                            key={item.date}
                            type="button"
                            onClick={() => loadArchiveDateDetails(item.date)}
                            className={`p-3 rounded-xl border text-left transition active:scale-95 flex items-center justify-between ${
                              isSelected
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/30'
                                : 'bg-slate-50 dark:bg-[#1a1535] border-purple-100 dark:border-purple-900/50 text-slate-800 dark:text-purple-200 hover:border-purple-400'
                            }`}
                          >
                            <div>
                              <span className="font-mono font-bold text-xs block">
                                📅 {item.date}
                              </span>
                              <span className={`text-[10px] ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                                {item.totalOrders ? `${item.totalOrders} pedidos arquivados` : 'Arquivo diário'}
                              </span>
                            </div>
                            <span className="text-xs font-bold">
                              {isSelected ? '✓ Ativo' : 'Ver →'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Paginação de Datas (5 por página) */}
                    {totalDatePages > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t border-purple-50 dark:border-purple-900/30 text-xs">
                        <button
                          type="button"
                          onClick={() => setArchiveDatePage((p) => Math.max(1, p - 1))}
                          disabled={archiveDatePage === 1}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 font-bold transition disabled:opacity-30"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Anterior</span>
                        </button>
                        <span className="text-[11px] text-slate-500 dark:text-purple-400 font-medium">
                          Página {archiveDatePage} de {totalDatePages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setArchiveDatePage((p) => Math.min(totalDatePages, p + 1))}
                          disabled={archiveDatePage === totalDatePages}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 font-bold transition disabled:opacity-30"
                        >
                          <span>Próxima</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Lista de Pedidos da Data Selecionada */}
              {selectedArchiveDate && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-purple-200">
                      Pedidos Arquivados em <span className="font-mono text-purple-600 dark:text-purple-400">{selectedArchiveDate}</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {archivedOrdersOfDay.length} {archivedOrdersOfDay.length === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>

                  {loadingDayArchive ? (
                    <div className="py-8 text-center text-xs text-purple-600 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Baixando arquivo consolidado do dia...</span>
                    </div>
                  ) : archivedOrdersOfDay.length === 0 ? (
                    <div className="py-8 text-center bg-white dark:bg-[#16122c] rounded-2xl border border-purple-100 dark:border-purple-900/50 p-4 text-xs text-slate-400">
                      Nenhum pedido encontrado no arquivo desta data.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {archivedOrdersOfDay.map((order) => {
                        const hasChat = order.chatHistory && Object.keys(order.chatHistory).length > 0;
                        const msgCount = hasChat ? Object.keys(order.chatHistory).length : 0;

                        return (
                          <div
                            key={order.id}
                            className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl p-3.5 shadow-sm space-y-2 hover:border-purple-400 transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-semibold text-slate-400">
                                ID: #{order.id?.slice(-8) || order.id}
                              </span>
                              <span className="text-[10px] font-bold bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                                Concluído
                              </span>
                            </div>

                            <div className="flex items-start justify-between gap-3 text-xs">
                              <div>
                                <h5 className="font-bold text-slate-900 dark:text-white capitalize">
                                  {capitalizeProductName(order.productName || 'Serviço')}
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-purple-400 mt-0.5">
                                  Cliente: <strong>{order.customerName || order.customerEmail || 'Anônimo'}</strong>
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-extrabold text-purple-700 dark:text-purple-300 block">
                                  R$ {Number(order.totalPrice || order.total || 0).toFixed(2)}
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  Qtd: {order.quantity || 1}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-purple-50 dark:border-purple-900/30 flex items-center justify-between text-xs">
                              <span className="text-[11px] text-slate-500 dark:text-purple-400">
                                Op: <strong>{order.assignedOperatorName || 'Não informado'}</strong>
                              </span>

                              <button
                                type="button"
                                onClick={() => setSelectedArchivedModalOrder(order)}
                                className="py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition active:scale-95"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ver Conversa ({msgCount})</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Chat ao Vivo (Para pedidos ativos do RTDB) */}
      <ChatModal
        order={activeChatOrder}
        isOpen={Boolean(activeChatOrder)}
        onClose={() => setActiveChatOrder(null)}
      />

      {/* Modal de Pedido e Conversa Arquivada (Exclusivo Administrador) */}
      <ArchivedOrderModal
        order={selectedArchivedModalOrder}
        isOpen={Boolean(selectedArchivedModalOrder)}
        onClose={() => setSelectedArchivedModalOrder(null)}
      />
    </div>
  );
}
