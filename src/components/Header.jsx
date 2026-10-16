import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Sun, Moon, Sparkles, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ref as dbRef, onValue } from 'firebase/database';
import { rtdb } from '../services/firebase';
import SupportChatModal from './SupportChatModal';

export default function Header() {
  const { isDark, toggleTheme } = useTheme();
  const { currentUser, userProfile } = useAuth();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [hasUnreadSupport, setHasUnreadSupport] = useState(false);

  const displayName = userProfile?.displayName || currentUser?.displayName || 'Cliente';
  const initial = displayName.charAt(0).toUpperCase();

  // Escuta status de mensagens não lidas no RTDB (custa 0 no Free Tier via WebSocket)
  useEffect(() => {
    if (!currentUser?.uid) return;

    let unsub = null;
    try {
      const threadRef = dbRef(rtdb, `support_threads/${currentUser.uid}/unreadByCustomer`);
      unsub = onValue(
        threadRef,
        (snapshot) => {
          setHasUnreadSupport(snapshot.val() === true);
        },
        () => {}
      );
    } catch {}

    const handleOpenSupport = () => {
      setIsSupportOpen(true);
    };
    window.addEventListener('vendario:open-support-chat', handleOpenSupport);

    return () => {
      if (unsub) {
        try { unsub(); } catch {}
      }
      window.removeEventListener('vendario:open-support-chat', handleOpenSupport);
    };
  }, [currentUser?.uid]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 dark:bg-[#0c0a1a]/85 border-b border-purple-100 dark:border-purple-950/60 transition-colors">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-600/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-purple-700 to-indigo-500 dark:from-purple-400 dark:to-indigo-300 bg-clip-text text-transparent leading-none">
                Vendário
              </span>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Support Chat Button */}
            {currentUser && (
              <button
                onClick={() => setIsSupportOpen(true)}
                aria-label="Falar com a Administração"
                title="Falar com a Administração"
                className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200/50 dark:border-purple-800/40 transition active:scale-95"
              >
                <Headphones className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                {hasUnreadSupport && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-red-500 border-2 border-white dark:border-[#0c0a1a] animate-pulse" />
                )}
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Alternar modo escuro"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200/50 dark:border-purple-800/40 transition active:scale-95"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-purple-600" />}
            </button>

            {/* User Profile Mini Badge */}
            <Link
              to="/perfil"
              className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 flex items-center justify-center font-bold text-sm hover:scale-105 transition active:scale-95"
              title={displayName}
            >
              {initial}
            </Link>
          </div>
        </div>
      </header>

      {/* Modal de Suporte Direto com Administradores */}
      <SupportChatModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />
    </>
  );
}
