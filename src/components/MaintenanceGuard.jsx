import React from 'react';
import { usePlatform } from '../contexts/PlatformContext';
import Maintenance from '../pages/Maintenance';
import { AlertTriangle } from 'lucide-react';

export default function MaintenanceGuard({ children }) {
  const { platformSettings, loading } = usePlatform();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0a1a] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-purple-500/20" />
        <span className="text-purple-300 text-xs font-semibold animate-pulse">Carregando Vendário...</span>
      </div>
    );
  }

  // Se plataforma estiver desativada OU manutenção estiver ligada nos toggles do Firestore
  const isPlatformDisabled = platformSettings?.toggles?.platform === false;
  const isMaintenanceActive = platformSettings?.toggles?.maintenance === true;

  if (isPlatformDisabled || isMaintenanceActive) {
    return <Maintenance platformSettings={platformSettings} isPlatformDisabled={isPlatformDisabled} />;
  }

  return (
    <>
      {/* Aviso global caso toggle 'warning' esteja ativo */}
      {platformSettings?.toggles?.warning && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 text-center sticky top-0 z-50 shadow-md">
          <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950" />
          <span>Aviso da Plataforma: Processamento de pedidos operando com alta demanda no momento.</span>
        </div>
      )}
      {children}
    </>
  );
}
