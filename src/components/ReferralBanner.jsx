import React from 'react';
import { Gift, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ReferralBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-700 text-white p-4 shadow-lg shadow-purple-900/25 border border-purple-400/20">
      {/* Detalhes de luz de fundo */}
      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute top-2 right-2 opacity-20">
        <Sparkles className="w-16 h-16 text-purple-200" />
      </div>

      <div className="flex items-start gap-3.5 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
          <Gift className="w-5 h-5 text-purple-200 animate-bounce" />
        </div>

        <div className="flex-1 pr-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-purple-100">
              Programa de Indicação
            </span>
          </div>

          <h3 className="text-sm font-bold leading-snug text-white">
            Indique e ganhe <span className="text-amber-300 font-extrabold text-base">2%</span> do valor gasto da pessoa indicada!
          </h3>

          <p className="text-xs text-purple-200/90 mt-1 line-clamp-2">
            Compartilhe seu código exclusivo. Toda vez que seu indicado comprar, você recebe comissão na sua carteira.
          </p>

          <Link
            to="/perfil/indicacoes"
            className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-lg transition active:scale-95"
          >
            <span>Ver meu código de indicação</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
