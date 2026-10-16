import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Gift, 
  Copy, 
  Check, 
  Share2, 
  Users, 
  Wallet, 
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  MessageCircle,
  Ticket,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  loadUserInvitations, 
  getCachedInvitations 
} from '../services/invitationsCache';
import { getPwaPublicOrigin } from '../services/apiConfig';

export default function Referrals() {
  const { currentUser, userProfile } = useAuth();
  const [copiedCode, setCopiedCode] = useState(null);
  const [activeTab, setActiveTab] = useState('invited'); // 'invited' | 'codes'

  // Estado sincronizado com cache local persistente (sem códigos sintéticos ilimitados)
  const initialCache = currentUser?.uid ? getCachedInvitations(currentUser.uid) : null;
  const [data, setData] = useState(() => initialCache || {
    invitations: [],
    invitedPeople: [],
    stats: {
      totalInvites: 0,
      availableCount: 0,
      usedCount: userProfile?.referralCount || 0,
      referralEarnings: Number(userProfile?.referralEarnings || 0),
      activeCode: null
    }
  });

  useEffect(() => {
    if (!currentUser?.uid) return;

    let mounted = true;

    const syncInvitations = () => {
      void loadUserInvitations(currentUser.uid, userProfile, (updated) => {
        if (mounted && updated) {
          setData(updated);
        }
      });
    };

    // 1. Carga inicial com verificação pontual de versão no RTDB (serve cache local se idêntico, sem manter WebSocket aberto)
    syncInvitations();

    // 2. Revalida versão pontualmente apenas quando o usuário retorna à aba
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncInvitations();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.uid, userProfile]);

  const invitationsList = data.invitations || [];
  // Restringe a exibição de convites e pessoas convidadas a no máximo 10
  const displayedInvitations = invitationsList.slice(0, 10);
  const displayedInvitedPeople = (data.invitedPeople || []).slice(0, 10);

  // Convite real ativo disponível gerado pelo dashboard (usando domínio oficial https://mobile.vendario.net)
  const pwaPublicOrigin = getPwaPublicOrigin();
  const activeCode = data.stats?.activeCode || displayedInvitations.find((i) => i.status === 'available')?.code || null;
  const referralLink = activeCode ? `${pwaPublicOrigin}/register?invite=${encodeURIComponent(activeCode)}` : '';

  const handleCopy = async (text, id = 'primary') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      const input = document.createElement('textarea');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleShareWhatsApp = (codeToShare = activeCode) => {
    if (!codeToShare) return;
    const link = `${pwaPublicOrigin}/register?invite=${encodeURIComponent(codeToShare)}`;
    const text = `🎉 Olá! Estou te enviando um convite exclusivo do Vendário!\n\nUse o código *${codeToShare}* para cadastrar-se e aproveitar nossas ofertas e serviços:\n👉 ${link}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareNative = () => {
    if (!activeCode || !referralLink) return;
    if (navigator.share) {
      navigator.share({
        title: 'Convite Exclusivo Vendário',
        text: `Cadastre-se no Vendário usando meu código de convite ${activeCode} e aproveite ofertas exclusivas!`,
        url: referralLink,
      }).catch(() => {});
    } else {
      handleCopy(referralLink, 'link');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-purple-100 dark:border-purple-900/40">
        <Link
          to="/perfil"
          className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 flex items-center justify-center transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            Programa de Convites
          </h1>
          <p className="text-xs text-slate-500 dark:text-purple-400">
            Acompanhe seus convidados e comissões em tempo real
          </p>
        </div>
      </div>

      {/* Banner Principal com a Regra de 2% */}
      <div className="bg-gradient-to-tr from-purple-900 via-purple-800 to-indigo-800 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden border border-purple-500/30">
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
            <Gift className="w-5 h-5 text-purple-200" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full text-purple-100">
            Comissão de 2%
          </span>
        </div>

        <h2 className="text-lg font-black leading-snug">
          Ganhe <span className="text-amber-300 text-xl font-extrabold">2%</span> de todas as compras dos seus convidados!
        </h2>

        <p className="text-xs text-purple-200/90 mt-1 leading-relaxed">
          Toda compra realizada por quem usar seu convite credita comissão automática direto na sua carteira.
        </p>
      </div>

      {/* ─── Card de Código Real da Dashboard ─── */}
      <div className="bg-white dark:bg-[#16122c] border border-purple-200 dark:border-purple-900/60 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Seu Convite para Compartilhar</span>
          </span>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              activeCode
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                : 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
            }`}
          >
            {activeCode
              ? `Disponível (${data.stats?.availableCount || 1} restante${(data.stats?.availableCount || 1) > 1 ? 's' : ''})`
              : '0 Convites Disponíveis'}
          </span>
        </div>

        {/* Voucher / Bloco de Código */}
        <div className="p-3 bg-purple-50/70 dark:bg-[#100c22] border-2 border-dashed border-purple-300 dark:border-purple-800 rounded-2xl flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-purple-400 block">
              Código
            </span>
            <span
              className={`font-mono text-xl sm:text-2xl font-black tracking-wider ${
                activeCode
                  ? 'text-purple-700 dark:text-purple-300'
                  : 'text-slate-400 dark:text-slate-500 text-base'
              }`}
            >
              {activeCode || 'Sem convite disponível'}
            </span>
          </div>

          <button
            disabled={!activeCode}
            onClick={() => handleCopy(activeCode, 'primary')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-sm shrink-0 ${
              !activeCode
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                : copiedCode === 'primary'
                ? 'bg-emerald-600 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30'
            }`}
          >
            {copiedCode === 'primary' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode === 'primary' ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>

        {/* Aviso caso não haja convites atribuídos */}
        {!activeCode && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Você não possui convites disponíveis no momento. Solicite novos convites à administração para compartilhar.
            </span>
          </div>
        )}

        {/* Botões de Ação Direta (WhatsApp e Compartilhar) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={!activeCode}
            onClick={() => handleShareWhatsApp(activeCode)}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
              activeCode
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>Enviar WhatsApp</span>
          </button>

          <button
            type="button"
            disabled={!activeCode}
            onClick={handleShareNative}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
              activeCode
                ? 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-900/70 text-purple-700 dark:text-purple-200'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>{copiedCode === 'link' ? 'Link Copiado!' : 'Compartilhar'}</span>
          </button>
        </div>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl p-3 text-center shadow-sm">
          <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-300 mx-auto mb-1">
            <Users className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] text-slate-500 dark:text-purple-400 block">Convidados</span>
          <span className="text-base font-black text-slate-900 dark:text-white">
            {data.stats?.usedCount ?? displayedInvitedPeople.length}
          </span>
        </div>

        <div className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl p-3 text-center shadow-sm">
          <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-300 mx-auto mb-1">
            <Ticket className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] text-slate-500 dark:text-purple-400 block">Disponíveis</span>
          <span className="text-base font-black text-slate-900 dark:text-white">
            {data.stats?.availableCount ?? 0}
          </span>
        </div>

        <div className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl p-3 text-center shadow-sm">
          <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-300 mx-auto mb-1">
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] text-slate-500 dark:text-purple-400 block">Ganhos (2%)</span>
          <span className="text-base font-black text-purple-700 dark:text-purple-300 truncate block">
            R$ {Number(data.stats?.referralEarnings || 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* ─── Abas de Navegação (Convidados vs Lista de Códigos) ─── */}
      <div className="flex items-center gap-2 border-b border-purple-100 dark:border-purple-900/40 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('invited')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'invited'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'bg-white dark:bg-[#16122c] text-slate-600 dark:text-purple-300 border border-purple-100 dark:border-purple-900/50'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Convidados</span>
          {displayedInvitedPeople.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-white/20 text-white">
              {displayedInvitedPeople.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('codes')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'codes'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'bg-white dark:bg-[#16122c] text-slate-600 dark:text-purple-300 border border-purple-100 dark:border-purple-900/50'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          <span>Meus Convites</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
            {displayedInvitations.length}
          </span>
        </button>
      </div>

      {/* ─── Conteúdo da Aba 1: Convidados (Máximo de 10 exibidos) ─── */}
      {activeTab === 'invited' && (
        <div className="space-y-2.5">
          {displayedInvitedPeople.length === 0 ? (
            <div className="py-8 text-center bg-white dark:bg-[#16122c] rounded-3xl border border-purple-100 dark:border-purple-900/50 p-6 space-y-2">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/50 rounded-2xl flex items-center justify-center mx-auto text-purple-600 dark:text-purple-400">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Nenhum convidado utilizou seus convites ainda
              </h3>
              <p className="text-xs text-slate-500 dark:text-purple-300/80 max-w-xs mx-auto">
                Assim que seus convidados se cadastrarem com seu código, eles aparecerão aqui.
              </p>
              {activeCode && (
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(activeCode)}
                  className="mt-2 inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Enviar Convite no WhatsApp</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 dark:text-purple-400">
                <span>Exibindo os convidados mais recentes (máximo 10)</span>
                <span>{displayedInvitedPeople.length} de {data.stats?.usedCount || displayedInvitedPeople.length}</span>
              </div>
              {displayedInvitedPeople.map((person) => {
                const initials = person.name
                  ? person.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
                  : 'C';
                const dateStr = person.joinedAt
                  ? new Date(person.joinedAt).toLocaleDateString('pt-BR')
                  : 'Recentemente';

                return (
                  <div
                    key={person.id}
                    className="p-3 bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {person.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-purple-400">
                          {person.email && <span className="truncate">{person.email}</span>}
                          {person.email && <span>•</span>}
                          <span>Entrou em {dateStr}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
                        Ativo
                      </span>
                      {person.codeUsed && (
                        <span className="text-[9px] font-mono text-slate-400 dark:text-purple-400 block mt-0.5">
                          via {person.codeUsed}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Conteúdo da Aba 2: Meus Convites Reais da Dashboard (Máximo de 10) ─── */}
      {activeTab === 'codes' && (
        <div className="space-y-2">
          {displayedInvitations.length === 0 ? (
            <div className="py-8 text-center bg-white dark:bg-[#16122c] rounded-3xl border border-purple-100 dark:border-purple-900/50 p-6 space-y-2">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/50 rounded-2xl flex items-center justify-center mx-auto text-purple-600 dark:text-purple-400">
                <Ticket className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Nenhum convite atribuído à sua conta
              </h3>
              <p className="text-xs text-slate-500 dark:text-purple-300/80 max-w-xs mx-auto">
                A administração do sistema gera e atribui convites diretamente para você. Entre em contato para solicitar.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 dark:text-purple-400">
                <span>Exibindo convites reais atribuídos (máximo 10)</span>
                <span>{displayedInvitations.length} de {invitationsList.length}</span>
              </div>
              {displayedInvitations.map((inv) => {
              const isAvailable = inv.status === 'available';
              const isUsed = inv.status === 'used';

              return (
                <div
                  key={inv.id}
                  className="p-3 bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl shadow-sm flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-purple-700 dark:text-purple-300">
                        {inv.code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                          isAvailable
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : isUsed
                            ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isAvailable ? 'Disponível' : isUsed ? 'Utilizado' : 'Expirado'}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 dark:text-purple-400 mt-0.5">
                      {isUsed && inv.consumedByName ? (
                        <span>Utilizado por <strong>{inv.consumedByName}</strong></span>
                      ) : inv.expiresAt ? (
                        <span>Expira em {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}</span>
                      ) : (
                        <span>Válido sem prazo de expiração</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAvailable && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopy(inv.code, inv.id)}
                          className={`p-2 rounded-xl text-xs font-bold transition ${
                            copiedCode === inv.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
                          }`}
                          title="Copiar Código"
                        >
                          {copiedCode === inv.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareWhatsApp(inv.code)}
                          className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl transition"
                          title="Enviar no WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {isUsed && (
                      <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resgatado</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      )}
    </div>
  );
}
