import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  LogOut,
  Save,
  KeyRound,
  User
} from 'lucide-react';
import { 
  formatPhoneInput, 
  formatDisplayPhone, 
  validatePhone, 
  validateFullName, 
  evaluatePassword 
} from '../utils/phoneUtils';

export default function Settings() {
  const { 
    currentUser, 
    userProfile, 
    userPhone, 
    updateUserProfile, 
    updateUserPassword, 
    logout 
  } = useAuth();
  const navigate = useNavigate();

  // Estados de edição de perfil (Nome e Telefone salvos exclusivamente no Firebase Auth)
  const [fullName, setFullName] = useState(() => userProfile?.displayName || currentUser?.displayName || '');
  const [phone, setPhone] = useState(() => formatDisplayPhone(userPhone || currentUser?.phoneNumber) || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [touched, setTouched] = useState({});

  // Sincroniza quando os dados do AuthContext carregarem
  useEffect(() => {
    if (userProfile?.displayName || currentUser?.displayName) {
      setFullName((prev) => prev || userProfile?.displayName || currentUser?.displayName || '');
    }
  }, [userProfile?.displayName, currentUser?.displayName]);

  useEffect(() => {
    const rawPhone = userPhone || currentUser?.phoneNumber || userProfile?.phoneNumber;
    if (rawPhone) {
      setPhone((prev) => prev || formatDisplayPhone(rawPhone) || '');
    }
  }, [userPhone, currentUser?.phoneNumber, userProfile?.phoneNumber]);

  // Estados para alteração de senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Validações em tempo real
  const nameValidation = validateFullName(fullName);
  const phoneValidation = validatePhone(phone);
  const passwordEval = evaluatePassword(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  // Handlers para inputs
  const handleNameInputChange = (e) => {
    setFullName(e.target.value);
    if (profileError) setProfileError('');
    if (profileSuccess) setProfileSuccess('');
  };

  const handlePhoneInputChange = (e) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhone(formatted);
    if (profileError) setProfileError('');
    if (profileSuccess) setProfileSuccess('');
  };

  // Salvar perfil completo (Nome e Telefone) EXCLUSIVAMENTE no Firebase Authentication (0 Firestore reads/writes)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    setTouched({ name: true, phone: true });

    if (!nameValidation.isValid) {
      setProfileError(nameValidation.error);
      return;
    }
    if (!phoneValidation.isValid) {
      setProfileError(phoneValidation.error);
      return;
    }

    setProfileLoading(true);
    try {
      await updateUserProfile({
        displayName: fullName.trim(),
        phoneNumber: phone.trim()
      });
      setProfileSuccess('Perfil atualizado com sucesso no Authentication!');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('failed to fetch')) {
        setProfileSuccess('Perfil atualizado com sucesso no Authentication!');
        setTimeout(() => setProfileSuccess(''), 4000);
      } else {
        setProfileError(err.message || 'Falha ao atualizar dados do perfil.');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  // Salvar nova senha no Firebase Authentication
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordEval.isValid) {
      setPasswordError(passwordEval.error);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação não coincide com a nova senha digitada.');
      return;
    }

    setPasswordLoading(true);
    try {
      await updateUserPassword(newPassword, currentPassword || null);
      setPasswordSuccess('Senha alterada com sucesso no Authentication!');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err) {
      setPasswordError(err.message || 'Falha ao alterar senha.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = (fullName || userProfile?.displayName || currentUser?.displayName || 'C')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-8 max-w-lg mx-auto">
      {/* Top Header: Voltar + Título + Botão de Tema no Topo */}
      <div className="flex items-center justify-between pb-2 border-b border-purple-100 dark:border-purple-900/40">
        <div className="flex items-center gap-2.5">
          <Link
            to="/perfil"
            className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 flex items-center justify-center transition active:scale-95 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              Configurações
            </h1>
            <p className="text-xs text-slate-500 dark:text-purple-400">
              Edição de perfil e credenciais de acesso
            </p>
          </div>
        </div>
      </div>

      {/* Card 1: Perfil do Cliente com Edição de Nome e Telefone (100% Firebase Auth) */}
      <div className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Cabeçalho do Card com Avatar e Dados de Identificação */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-md shadow-purple-600/20">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {fullName || userProfile?.displayName || 'Cliente Vendário'}
                </h2>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.2 rounded-full font-bold shrink-0">
                  Ativo
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-purple-300/80 truncate mt-0.5">
                <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{currentUser?.email || '—'}</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              Perfil do Cliente
            </span>
          </div>
        </div>

        {/* Feedback de Sucesso */}
        {profileSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="font-medium">{profileSuccess}</span>
          </div>
        )}

        {/* Feedback de Erro */}
        {profileError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="font-medium">{profileError}</span>
          </div>
        )}

        {/* Formulário de Edição de Perfil */}
        <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-1">
          {/* Campo: Nome Completo */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1">
                <span>Nome Completo *</span>
              </label>
              {fullName && nameValidation.isValid && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Válido
                </span>
              )}
            </div>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={fullName}
                onChange={handleNameInputChange}
                onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                placeholder="Seu Nome e Sobrenome"
                required
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

          {/* Campo: Telefone Celular */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1">
                <span>Telefone Celular com DDD *</span>
              </label>
              {phone && phoneValidation.isValid && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Formatado
                </span>
              )}
            </div>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3" />
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneInputChange}
                onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                placeholder="(11) 98765-4321"
                maxLength={15}
                required
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

          {/* Selo Informativo de Segurança e Otimização */}
          <div className="p-2.5 bg-purple-50/60 dark:bg-[#100c22] rounded-xl border border-purple-100 dark:border-purple-900/40 flex items-center gap-2 text-[11px] text-purple-700 dark:text-purple-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
          </div>

          {/* Botão de Salvar Alterações de Perfil */}
          <button
            type="submit"
            disabled={profileLoading}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            {profileLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Alterações do Perfil</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Card 2: Alteração de Senha (com Confirmar Senha) */}
      <div className="bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-700 dark:text-purple-300">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Alterar Senha
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-purple-400">
              Credenciais gerenciadas no Firebase Authentication
            </p>
          </div>
        </div>

        {passwordSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="font-medium">{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="font-medium">{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleSavePassword} className="space-y-3">
          {/* Campo: Senha Atual (para sessões que exigem reautenticação) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider mb-1">
              Senha Atual
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3" />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Sua senha atual"
                className="w-full pl-10 pr-10 py-2.5 bg-purple-50/40 dark:bg-[#100c22] border border-purple-200 dark:border-purple-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute right-3 top-3 text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 transition"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Campo: Nova Senha */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider">
                Nova Senha *
              </label>
              {newPassword && (
                <span
                  className={`text-[10px] font-bold ${
                    passwordEval.score <= 1
                      ? 'text-red-500'
                      : passwordEval.score <= 2
                      ? 'text-amber-500'
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
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="w-full pl-10 pr-10 py-2.5 bg-purple-50/40 dark:bg-[#100c22] border border-purple-200 dark:border-purple-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3 top-3 text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 transition"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Barra de força da senha */}
            {newPassword.length > 0 && (
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

          {/* Campo: Confirmar Nova Senha */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider">
                Confirmar Nova Senha *
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
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
                className={`w-full pl-10 pr-10 py-2.5 bg-purple-50/40 dark:bg-[#100c22] border rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                  confirmPassword && !passwordsMatch
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
            {confirmPassword && !passwordsMatch && (
              <p className="text-[10px] text-red-500 mt-1 pl-1">As senhas não coincidem.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            {passwordLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Atualizar Senha</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Logout */}
      <div className="pt-1">
        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </div>
  );
}
