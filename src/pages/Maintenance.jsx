import React from 'react';
import { Wrench, PowerOff, Clock } from 'lucide-react';

export default function Maintenance({ platformSettings, isPlatformDisabled }) {
  const company = platformSettings?.company || {};

  return (
    <div className="min-h-screen bg-slate-900 text-purple-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md rounded-2xl border border-purple-500/30 p-8 text-center shadow-2xl relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/50">
          {isPlatformDisabled ? (
            <PowerOff className="w-10 h-10 text-white animate-pulse" />
          ) : (
            <Wrench className="w-10 h-10 text-white animate-pulse" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          {company.platformName || "Vendário"}{" "}
          {isPlatformDisabled ? "Temporariamente Indisponível" : "em Manutenção"}
        </h1>
        
        <p className="text-purple-300 text-sm mb-6 leading-relaxed">
          {isPlatformDisabled
            ? "A plataforma está desativada no momento pela administração. Por favor, volte mais tarde."
            : "Estamos realizando melhorias programadas em nossa plataforma para oferecer a melhor experiência a você. Retornaremos em instantes!"}
        </p>

        <div className="bg-slate-900/60 rounded-xl p-4 border border-purple-500/20 mb-6 flex items-center gap-3 text-left">
          <Clock className="w-5 h-5 text-purple-400 shrink-0" />
          <div className="text-xs text-purple-200">
            <span className="font-semibold block text-white">Status da Plataforma</span>
            {isPlatformDisabled
              ? "Serviço pausado. Retornaremos em breve."
              : "Nossos servidores estão sendo atualizados com novos recursos."}
          </div>
        </div>

        {company.email && (
          <div className="text-xs text-purple-400 border-t border-purple-500/20 pt-4">
            Dúvidas urgentes? Contate-nos: <span className="text-purple-200 font-medium">{company.email}</span>
          </div>
        )}
      </div>
    </div>
  );
}
