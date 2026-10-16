import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Sparkles, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  KeyRound, 
  UserPlus, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Sun, 
  Moon,
  ShieldCheck
} from 'lucide-react';
import { 
  formatPhoneInput, 
  validatePhone, 
  validateFullName, 
  validateEmail, 
  evaluatePassword 
} from '../utils/phoneUtils';

export default function Register() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialInvite = searchParams.get('invite') || searchParams.get('code') || '';
  const initialEmail = searchParams.get('email') || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInvite);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { registerWithInvite } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Validações reativas em tempo real
  const nameValidation = validateFullName(fullName);
  const emailValidation = validateEmail(email);
  const phoneValidation = validatePhone(phone);
  const passwordEval = evaluatePassword(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhone(formatted);
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Marca todos os campos como tocados para exibir feedbacks
    setTouched({
      name: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
      invite: true,
    });

    if (!nameValidation.isValid) {
      setError(nameValidation.error);
      return;
    }
    if (!emailValidation.isValid) {
      setError(emailValidation.error);
      return;
    }
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error);
      return;
    }
    if (!passwordEval.isValid) {
      setError(passwordEval.error);
      return;
    }
    if (password !== confirmPassword) {
      setError('A confirmação de senha não coincide com a senha digitada.');
      return;
    }
    if (!inviteCode.trim()) {
      setError('O código de convite é estritamente obrigatório.');
      return;
    }

    setLoading(true);

    try {
      await registerWithInvite({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        inviteCode: inviteCode.trim().toUpperCase(),
      });
      navigate('/', { replace: true });
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado em nossa base.');
      } else {
        setError(err.message || 'Falha ao realizar cadastro.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfaff] dark:bg-[#0c0a1a] text-slate-900 dark:text-purple-100 flex flex-col justify-between p-3 sm:p-4 transition-colors">
      {/* Top Bar Mobile com Botão de Tema */}
      <div className="max-w-md w-full mx-auto flex justify-between items-center pt-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
          Vendário
        </span>
        <button
          onClick={toggleTheme}
          aria-label="Alternar modo escuro"
          className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center border border-purple-200/50 dark:border-purple-800/40 transition active:scale-95 shadow-sm"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-purple-600" />}
        </button>
      </div>

      <div className="max-w-md w-full mx-auto my-auto py-4 sm:py-6">
        {/* Header no Estilo App Mobile */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 mx-auto flex items-center justify-center shadow-lg shadow-purple-600/30 mb-2">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 dark:from-purple-300 dark:via-purple-200 dark:to-indigo-200 bg-clip-text text-transparent">
            Criar Conta de Cliente
          </h1>
          <p className="text-xs text-slate-500 dark:text-purple-300/80 mt-0.5">
            Preencha seus dados para acessar ofertas e serviços exclusivos
          </p>
        </div>

        {/* Card do Formulário */}
        <div className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-3xl p-5 sm:p-6 shadow-xl shadow-purple-900/5">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Campo: Nome Completo */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider">
                  Nome Completo *
                </label>
                {touched.name && nameValidation.isValid && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Válido
                  </span>
                )}
              </div>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => handleBlur('name')}
                  placeholder="Nome e Sobrenome"
                  className={`w-full pl-10 pr-4 py-2.5 bg-purple-50/40 dark:bg-[#100c22] border rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                    touched.name && !nameValidation.isValid
                      ? 'border-red-400 dark:border-red-500/60'
                      : 'border-purple-200 dark:border-purple-800'
                  }`}
                />
              </div>
              {touched.name && !nameValidation.isValid && (
                <p className="text-[10px] text-red-500 mt-1 pl-1">{nameValidation.error}</p>
              )}
            </div>

            {/* Campo: E-mail */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider">
                  E-mail *
                </label>
                {touched.email && emailValidation.isValid && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Válido
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => handleBlur('email')}
                  placeholder="seu@email.com"
                  className={`w-full pl-10 pr-4 py-2.5 bg-purple-50/40 dark:bg-[#100c22] border rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                    touched.email && !emailValidation.isValid
                      ? 'border-red-400 dark:border-red-500/60'
                      : 'border-purple-200 dark:border-purple-800'
                  }`}
                />
              </div>
              {touched.email && !emailValidation.isValid && (
                <p className="text-[10px] text-red-500 mt-1 pl-1">{emailValidation.error}</p>
              )}
            </div>

            {/* Campo: Telefone Celular Obrigatório (Formatação Automática) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1">
                  <span>Telefone Celular *</span>
                  <span className="text-[9px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-extrabold px-1.5 py-0.2 rounded">
                    Auth
                  </span>
                </label>
                {touched.phone && phoneValidation.isValid && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Formatado
                  </span>
                )}
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={handlePhoneChange}
                  onBlur={() => handleBlur('phone')}
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  className={`w-full pl-10 pr-4 py-2.5 bg-purple-50/40 dark:bg-[#100c22] border rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                    touched.phone && !phoneValidation.isValid
                      ? 'border-red-400 dark:border-red-500/60'
                      : 'border-purple-200 dark:border-purple-800'
                  }`}
                />
              </div>
              {touched.phone && !phoneValidation.isValid && (
                <p className="text-[10px] text-red-500 mt-1 pl-1">{phoneValidation.error}</p>
              )}
            </div>

            {/* Campo: Senha */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider">
                  Senha *
                </label>
                {password && (
                  <span
                    className={`text-[10px] font-bold ${
                      passwordEval.score <= 1
                        ? 'text-red-500'
                        : passwordEval.score <= 2
                        ? 'text-amber-500'
                        : passwordEval.score <= 3
                        ? 'text-blue-500'
                        : 'text-emerald-500'
                    }`}
                  >
                    Força: {passwordEval.label}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur('password')}
                  placeholder="Mínimo 6 caracteres"
                  className={`w-full pl-10 pr-10 py-2.5 bg-purple-50/40 dark:bg-[#100c22] border rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                    touched.password && !passwordEval.isValid
                      ? 'border-red-400 dark:border-red-500/60'
                      : 'border-purple-200 dark:border-purple-800'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Indicador visual de força da senha */}
              {password.length > 0 && (
                <div className="mt-1.5 flex gap-1 h-1">
                  <div
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      passwordEval.score >= 1 ? (passwordEval.score === 1 ? 'bg-red-500' : 'bg-emerald-500') : 'bg-slate-200 dark:bg-purple-950'
                    }`}
                  />
                  <div
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      passwordEval.score >= 2 ? (passwordEval.score === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200 dark:bg-purple-950'
                    }`}
                  />
                  <div
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      passwordEval.score >= 3 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-purple-950'
                    }`}
                  />
                  <div
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      passwordEval.score >= 4 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-purple-950'
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Campo: Confirmar Senha */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider">
                  Confirmar Senha *
                </label>
                {confirmPassword && passwordsMatch && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Senhas conferem
                  </span>
                )}
              </div>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => handleBlur('confirmPassword')}
                  placeholder="Repita sua senha"
                  className={`w-full pl-10 pr-10 py-2.5 bg-purple-50/40 dark:bg-[#100c22] border rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                    touched.confirmPassword && !passwordsMatch
                      ? 'border-red-400 dark:border-red-500/60'
                      : confirmPassword && passwordsMatch
                      ? 'border-emerald-500 dark:border-emerald-500/70'
                      : 'border-purple-200 dark:border-purple-800'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 transition"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {touched.confirmPassword && !passwordsMatch && (
                <p className="text-[10px] text-red-500 mt-1 pl-1">As senhas não coincidem.</p>
              )}
            </div>

            {/* Campo: Código de Convite em Destaque */}
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-700/60 rounded-2xl mt-1">
              <label className="block text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-1">
                Código de Convite *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase().trim())}
                  placeholder="EX: 7K9M-3A8W"
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#100c22] border border-purple-300 dark:border-purple-600 rounded-xl text-sm font-bold tracking-widest text-purple-700 dark:text-purple-300 placeholder-purple-300 dark:placeholder-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
                />
              </div>
              <p className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-1">
                * Convite obrigatório gerado pela administração ou por um amigo.
              </p>
            </div>

            {/* Botão de Conclusão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition active:scale-95 pt-3"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Concluir Cadastro</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-3.5 border-t border-purple-100 dark:border-purple-900/50 text-center">
            <p className="text-xs text-slate-600 dark:text-purple-300">
              Já possui uma conta?{' '}
              <Link
                to="/login"
                className="font-bold text-purple-700 dark:text-purple-400 hover:underline"
              >
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-400 dark:text-purple-500/70 pb-1">
        Vendário &copy; 2026 Todos os direitos reservados
      </div>
    </div>
  );
}
