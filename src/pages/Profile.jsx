import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Gift, 
  Settings as SettingsIcon, 
  LogOut, 
  ChevronRight, 
  ShieldCheck, 
  ShoppingBag,
  Camera,
  Loader2,
  Headphones
} from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { storage } from '../services/firebase';

export default function Profile() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const displayName = userProfile?.displayName || currentUser?.displayName || 'Cliente';
  const email = userProfile?.email || currentUser?.email || '';
  const photoURL = userProfile?.photoURL || currentUser?.photoURL;
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;

    setUploadingAvatar(true);
    try {
      // Comprime o avatar no cliente (máx 256x256px, ~10-20KB) para economizar Storage e franquia de download
      const compressed = await new Promise((resolve) => {
        try {
          const img = new window.Image();
          const objectUrl = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const maxDim = 256;
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              const ratio = Math.min(maxDim / width, maxDim / height);
              width = Math.max(1, Math.round(width * ratio));
              height = Math.max(1, Math.round(height * ratio));
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve({ blob: file, ext: 'jpg', contentType: file.type || 'image/jpeg' });
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const testWebp = canvas.toDataURL('image/webp', 0.8);
            const isWebp = testWebp.startsWith('data:image/webp');
            const contentType = isWebp ? 'image/webp' : 'image/jpeg';
            const ext = isWebp ? 'webp' : 'jpg';
            canvas.toBlob(
              (blob) => resolve({ blob: blob || file, ext, contentType }),
              contentType,
              0.8
            );
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({ blob: file, ext: 'jpg', contentType: file.type || 'image/jpeg' });
          };
          img.src = objectUrl;
        } catch {
          resolve({ blob: file, ext: 'jpg', contentType: file.type || 'image/jpeg' });
        }
      });

      const fileRef = storageRef(storage, `users/${currentUser.uid}/avatar.${compressed.ext}`);

      await uploadBytes(fileRef, compressed.blob, {
        contentType: compressed.contentType,
        cacheControl: 'public, max-age=31536000',
      });
      const downloadUrl = await getDownloadURL(fileRef);

      // Atualiza diretamente no Firebase Auth Client SDK (zero leituras/escritas no Firestore e zero Cloud Functions)
      await updateProfile(currentUser, { photoURL: downloadUrl });

      // Atualiza localmente no estado e cache
      if (userProfile) {
        userProfile.photoURL = downloadUrl;
        localStorage.setItem(`vendario_pwa_profile_${currentUser.uid}`, JSON.stringify(userProfile));
      }
    } catch (err) {
      console.warn('Erro ao atualizar foto via Firebase Storage:', err);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-700 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          {/* Avatar com upload pelo Firebase Storage */}
          <div className="relative group">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-2xl border border-white/30 text-white shadow-inner overflow-hidden">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center border border-white/40 shadow-md transition active:scale-95"
              aria-label="Trocar foto de perfil"
              title="Trocar foto de perfil"
            >
              {uploadingAvatar ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Camera className="w-3 h-3" />
              )}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-white">{displayName}</h2>
              <span className="text-[10px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                Ativo
              </span>
            </div>
            <p className="text-xs text-purple-200 mt-0.5">{email}</p>
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold bg-white/15 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-300" />
              <span>Cliente Vendário Verificado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submenus e Atalhos */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-slate-500 dark:text-purple-300 uppercase tracking-wider px-1">
          Menu do Cliente
        </h3>

        {/* Submenu 1: Indicações */}
        <Link
          to="/perfil/indicacoes"
          className="flex items-center justify-between p-4 bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center">
              <Gift className="w-5 h-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Indicações & Bônus</span>
                <span className="text-[9px] font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 text-white px-1.5 py-0.5 rounded">
                  2% Cashback
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-purple-400 mt-0.5">
                Seu código de convite e saldo de comissões
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-purple-400" />
        </Link>

        {/* Submenu 2: Configurações */}
        <Link
          to="/perfil/configuracoes"
          className="flex items-center justify-between p-4 bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">Configurações</span>
              <p className="text-xs text-slate-500 dark:text-purple-400 mt-0.5">
                Alterar senha, telefone e preferências
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-purple-400" />
        </Link>

        {/* Atalho: Meus Pedidos */}
        <Link
          to="/pedidos"
          className="flex items-center justify-between p-4 bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">Histórico de Pedidos</span>
              <p className="text-xs text-slate-500 dark:text-purple-400 mt-0.5">
                Acompanhar entregas e chat com operador
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-purple-400" />
        </Link>

        {/* Atendimento & Suporte com Administradores */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('vendario:open-support-chat'))}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#16122c] border border-purple-100 dark:border-purple-900/60 rounded-2xl shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition active:scale-[0.99] text-left"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Falar com a Administração</span>
                <span className="text-[9px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  Suporte Direto
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-purple-400 mt-0.5">
                Chat exclusivo e em tempo real com os administradores
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-purple-400" />
        </button>
      </div>

      {/* Botão Sair */}
      <div className="pt-2">
        <button
          onClick={handleLogout}
          className="w-full py-3.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </div>
  );
}
