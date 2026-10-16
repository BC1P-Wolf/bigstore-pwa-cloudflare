import React from 'react';
import { Clock, Loader2, CheckCircle2, CreditCard } from 'lucide-react';

export default function StatusBadge({ status }) {
  if (status === 'Concluído' || status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Concluído</span>
      </span>
    );
  }

  if (status === 'Em Progresso' || status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 animate-pulse">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Em Progresso</span>
      </span>
    );
  }

  if (status === 'Aguardando Pagamento' || status === 'pending_payment') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
        <CreditCard className="w-3.5 h-3.5" />
        <span>Aguardando Pagamento</span>
      </span>
    );
  }

  // Padrão: "Na Fila" / "pending"
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
      <Clock className="w-3.5 h-3.5" />
      <span>Na Fila</span>
    </span>
  );
}
