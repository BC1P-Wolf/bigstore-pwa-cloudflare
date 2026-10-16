import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldX, AlertTriangle } from 'lucide-react';

export default function AuthGuard({ children }) {
  const { currentUser, userProfile, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfaff] dark:bg-[#0c0a1a] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin shadow-lg shadow-purple-500/20" />
        <p className="text-purple-600 dark:text-purple-300 text-sm font-medium animate-pulse">
          Carregando Vendário...
        </p>
      </div>
    );
  }

  // Se não estiver logado, redireciona obrigatoriamente para /login
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Validação de RBAC: Somente role 'customer' ou 'owner' (Administrador)
  if (userProfile && userProfile.role && userProfile.role !== 'customer' && userProfile.role !== 'owner') {
    return (
      <div className="min-h-screen bg-[#fcfaff] dark:bg-[#0c0a1a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#16122c] border border-purple-200 dark:border-purple-900 rounded-2xl p-6 text-center shadow-xl">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Acesso Restrito</h2>
          <p className="text-sm text-gray-600 dark:text-purple-300 mb-6">
            Seu perfil atual ({userProfile.role}) não tem permissão para acessar a área de compras do cliente.
          </p>
          <button
            onClick={logout}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition shadow-md shadow-purple-500/30"
          >
            Fazer Login com Outra Conta
          </button>
        </div>
      </div>
    );
  }

  // Validação de Status Ativo
  if (userProfile && userProfile.status && userProfile.status !== 'active') {
    return (
      <div className="min-h-screen bg-[#fcfaff] dark:bg-[#0c0a1a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#16122c] border border-purple-200 dark:border-purple-900 rounded-2xl p-6 text-center shadow-xl">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Conta Desativada</h2>
          <p className="text-sm text-gray-600 dark:text-purple-300 mb-6">
            Sua conta de cliente está inativa. Entre em contato com nossa equipe para regularizar.
          </p>
          <button
            onClick={logout}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition shadow-md shadow-purple-500/30"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return children;
}
