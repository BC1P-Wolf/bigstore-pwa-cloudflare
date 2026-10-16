import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ref, get } from 'firebase/database';
import { rtdb } from '../services/firebase';

const PlatformContext = createContext();

const PLATFORM_CACHE_KEY = 'vendario_pwa_platform_settings';
const LAST_FETCH_KEY = 'vendario_pwa_platform_last_fetch';
const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

const DEFAULT_SETTINGS = {
  toggles: {
    platform: true,
    maintenance: false,
    email: true,
    newClients: true,
    receipt: true,
    transfer: true,
    warning: false
  },
  company: {
    platformName: "Vendário",
    email: "suporte@vendario.com.br",
    phone: "+55 (11) 99999-8888",
    address: "Av. Paulista, 1000 - São Paulo, SP"
  }
};

export function PlatformProvider({ children }) {
  const [platformSettings, setPlatformSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(PLATFORM_CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch (e) {
        console.warn('Erro ao ler cache de platformSettings:', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [loading, setLoading] = useState(() => {
    // Se há cache local, renderiza imediatamente sem travar
    if (typeof window !== 'undefined') {
      return !localStorage.getItem(PLATFORM_CACHE_KEY);
    }
    return true;
  });

  const isFetchingRef = useRef(false);

  // Consulta pontual e rápida com get() (Zero conexões WebSocket permanentes presas)
  const fetchSettings = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const settingsRef = ref(rtdb, 'settings/platform');
      const snapshot = await get(settingsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        setPlatformSettings(data);
        try {
          localStorage.setItem(PLATFORM_CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(LAST_FETCH_KEY, String(Date.now()));
        } catch {}
      }
    } catch (err) {
      console.warn('Aviso: settings/platform offline ou servido do cache local:', err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Busca inicial apenas se não houver cache válido nos últimos 5 minutos
    const lastInitial = Number(localStorage.getItem(LAST_FETCH_KEY) || '0');
    const hasCache = Boolean(localStorage.getItem(PLATFORM_CACHE_KEY));
    if (!hasCache || Date.now() - lastInitial > REVALIDATE_INTERVAL_MS) {
      void fetchSettings();
    } else {
      setLoading(false);
    }

    // 2. Revalidação leve ao retornar o foco na aba se passaram mais de 5 minutos
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const last = Number(localStorage.getItem(LAST_FETCH_KEY) || '0');
        if (Date.now() - last > REVALIDATE_INTERVAL_MS) {
          void fetchSettings();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Safety timeout para nunca travar a tela em carregamento
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchSettings]);

  return (
    <PlatformContext.Provider value={{ platformSettings, loading }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform deve ser usado dentro de PlatformProvider');
  }
  return context;
}
