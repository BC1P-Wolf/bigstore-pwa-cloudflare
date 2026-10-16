import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sparkles, Mail, Lock, LogIn, AlertCircle, Sun, Moon } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, authError } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(err.message || 'Falha ao autenticar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const activeError = error || authError;

  return (
    <div className="min-h-screen bg-[#fcfaff] dark:bg-[#0c0a1a] text-slate-900 dark:text-purple-100 flex flex-col justify-between p-4 transition-colors">
      {/* Top Bar com Toggle de Tema */}
      <div className="max-w-md w-full mx-auto flex justify-end pt-2">
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center border border-purple-200/50 dark:border-purple-800/40"
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-purple-600" />}
        </button>
      </div>

      <div className="max-w-md w-full mx-auto my-auto py-8">
        {/* App Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 mx-auto flex items-center justify-center shadow-xl shadow-purple-600/30 mb-3">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 dark:from-purple-300 dark:via-purple-200 dark:to-indigo-200 bg-clip-text text-transparent">
            Vendário
          </h1>
          <p className="text-xs text-slate-500 dark:text-purple-300/80 mt-1">
            Acesso exclusivo para clientes cadastrados
          </p>
        </div>

        {/* Card de Login */}
        <div className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-3xl p-6 sm:p-8 shadow-xl shadow-purple-900/5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Entrar na sua conta
          </h2>

          {activeError && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-purple-50/40 dark:bg-[#100c22] border border-purple-200 dark:border-purple-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-purple-50/40 dark:bg-[#100c22] border border-purple-200 dark:border-purple-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition active:scale-95 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Acessar Plataforma</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-purple-100 dark:border-purple-900/50 text-center">
            <p className="text-xs text-slate-600 dark:text-purple-300">
              Possui código de convite?{' '}
              <Link
                to="/register"
                className="font-bold text-purple-700 dark:text-purple-400 hover:underline"
              >
                Cadastre-se aqui
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-slate-400 dark:text-purple-500/70 pb-2">
        Plataforma Vendário - Todos os direitos reservados © 2026 
      </div>
    </div>
  );
}
