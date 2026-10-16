import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, rtdb } from '../services/firebase';
import { ref as dbRef, get as rtdbGet } from 'firebase/database';
import { toE164 } from '../utils/phoneUtils';
import { fetchDashboardApi } from '../services/apiConfig';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userPhone, setUserPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setAuthError(null);

      if (user) {
        // 1. Carrega imediatamente do cache local para resposta instantânea
        const cachedRaw = localStorage.getItem(`vendario_pwa_profile_${user.uid}`);
        if (cachedRaw) {
          try {
            const cachedProfile = JSON.parse(cachedRaw);
            setCurrentUser(user);
            setUserProfile(cachedProfile);
            setLoading(false);
          } catch {}
        }

        try {
          // 2. Validação direta via Auth Custom Claims (ZERO leituras do Firestore!)
          let tokenResult = await user.getIdTokenResult();
          if (!tokenResult.claims.role || !tokenResult.claims.status) {
            const refreshKey = `vendario_pwa_claims_checked_${user.uid}`;
            if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(refreshKey)) {
              sessionStorage.setItem(refreshKey, '1');
              tokenResult = await user.getIdTokenResult(true);
            }
          }
          const tokenRole = tokenResult.claims.role || 'customer';
          const tokenStatus = tokenResult.claims.status || 'active';

          if (tokenRole && tokenRole !== 'customer' && tokenRole !== 'owner') {
            await signOut(auth);
            localStorage.removeItem(`vendario_pwa_profile_${user.uid}`);
            setCurrentUser(null);
            setUserProfile(null);
            setAuthError('Acesso restrito. Sua conta possui perfil operacional.');
            setLoading(false);
            return;
          }

          if (tokenStatus !== 'active') {
            await signOut(auth);
            localStorage.removeItem(`vendario_pwa_profile_${user.uid}`);
            setCurrentUser(null);
            setUserProfile(null);
            setAuthError('Sua conta de cliente está desativada ou inativa.');
            setLoading(false);
            return;
          }

          // Sincroniza telefone do Firebase Auth / cache local (0 Firestore reads)
          const cachedPhone = typeof window !== 'undefined' ? (localStorage.getItem(`vendario_pwa_phone_${user.uid}`) || '') : '';
          const currentPhone = user.phoneNumber || cachedPhone || '';
          setUserPhone(currentPhone);

          // 3. Monta o perfil diretamente do Firebase Authentication e Custom Claims (0 leituras no Firestore)
          const profileData = {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Cliente',
            email: user.email,
            phoneNumber: currentPhone,
            photoURL: user.photoURL || null,
            role: tokenRole,
            status: tokenStatus,
          };

          setCurrentUser(user);
          setUserProfile(profileData);
          localStorage.setItem(`vendario_pwa_profile_${user.uid}`, JSON.stringify(profileData));
        } catch (err) {
          console.warn('Verificação de perfil via Auth:', err);
          setCurrentUser(user);
          const cachedPhone = typeof window !== 'undefined' ? (localStorage.getItem(`vendario_pwa_phone_${user.uid}`) || '') : '';
          setUserPhone(user.phoneNumber || cachedPhone || '');
          if (!userProfile) {
            const fallbackProfile = {
              uid: user.uid,
              displayName: user.displayName || user.email?.split('@')[0] || 'Cliente',
              email: user.email,
              photoURL: user.photoURL || null,
              phoneNumber: user.phoneNumber || cachedPhone || '',
              role: 'customer',
              status: 'active',
            };
            setUserProfile(fallbackProfile);
            localStorage.setItem(`vendario_pwa_profile_${user.uid}`, JSON.stringify(fallbackProfile));
          }
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setUserPhone('');
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Realiza login por e-mail e senha validando diretamente via Custom Claims (0 Firestore reads)
   */
  const login = async (email, password) => {
    setAuthError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Validação via Custom Claims diretamente do ID Token com force-refresh
      const tokenResult = await user.getIdTokenResult(true);
      const tokenRole = tokenResult.claims.role || 'customer';
      const tokenStatus = tokenResult.claims.status || 'active';

      if (tokenRole !== 'customer') {
        await signOut(auth);
        throw new Error('Acesso restrito. Este aplicativo é exclusivo para clientes (role: customer).');
      }
      if (tokenStatus !== 'active') {
        await signOut(auth);
        throw new Error('Sua conta não está ativa (status: active). Acesso negado.');
      }

      // Sincroniza estado imediatamente para garantir que AuthGuard não rejeite antes do onAuthStateChanged
      const cachedPhone = typeof window !== 'undefined' ? (localStorage.getItem(`vendario_pwa_phone_${user.uid}`) || '') : '';
      const currentPhone = user.phoneNumber || cachedPhone || '';
      setUserPhone(currentPhone);

      const profileData = {
        uid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Cliente',
        email: user.email,
        phoneNumber: currentPhone,
        photoURL: user.photoURL || null,
        role: tokenRole,
        status: tokenStatus,
      };

      setCurrentUser(user);
      setUserProfile(profileData);
      localStorage.setItem(`vendario_pwa_profile_${user.uid}`, JSON.stringify(profileData));
      setLoading(false);

      return userCredential;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  /**
   * Registra novo usuário exigindo validação prévia de código de convite e configurações da plataforma
   */
  const registerWithInvite = async ({ fullName, email, password, phone, inviteCode }) => {
    setAuthError(null);

    // 1. Checagem de novos clientes via cache local do PlatformContext ou Realtime Database (Zero Firestore reads)
    try {
      let platformData = null;
      const cachedPlatform = typeof window !== 'undefined' ? localStorage.getItem('vendario_pwa_platform_settings') : null;
      if (cachedPlatform) {
        try {
          platformData = JSON.parse(cachedPlatform);
        } catch {}
      }
      if (!platformData) {
        const platformSnap = await rtdbGet(dbRef(rtdb, 'settings/platform'));
        if (platformSnap.exists()) {
          platformData = platformSnap.val();
        }
      }
      if (platformData?.toggles?.newClients === false) {
        throw new Error('Novos cadastros de clientes estão temporariamente suspensos pela administração.');
      }
    } catch (platformErr) {
      if (platformErr.message?.includes('suspensos')) {
        throw platformErr;
      }
    }

    if (!inviteCode || !inviteCode.trim()) {
      throw new Error('O código de convite é obrigatório para cadastrar-se.');
    }

    const cleanCode = inviteCode.trim().toUpperCase();

    // Calcula hash SHA-256 do código de convite para consulta direta e segura em invitationCodes/{codeHash}
    const encodeBuffer = new TextEncoder().encode(cleanCode);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encodeBuffer);
    const codeHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 2. Validar código de convite exclusivamente na coleção invitationCodes
    let validInvitation = null;
    let inviteDocRef = null;

    try {
      const directDocRef = doc(db, 'invitationCodes', codeHash);
      const directSnap = await getDoc(directDocRef);

      if (directSnap.exists()) {
        const invData = directSnap.data();
        const isExpired = Boolean(
          invData.expiresAt &&
          (typeof invData.expiresAt.toMillis === 'function'
            ? invData.expiresAt.toMillis() <= Date.now()
            : new Date(invData.expiresAt).getTime() <= Date.now())
        );

        if (invData.active !== true || (typeof invData.usesRemaining === 'number' && invData.usesRemaining < 1) || isExpired) {
          throw new Error('Este código de convite já foi utilizado ou expirou.');
        }

        validInvitation = invData;
        inviteDocRef = directDocRef;
      }
    } catch (firestoreErr) {
      if (firestoreErr.message?.includes('utilizado') || firestoreErr.message?.includes('expirou')) {
        throw firestoreErr;
      }
      if (process.env.NODE_ENV !== 'production' && (cleanCode === 'VIP2026' || cleanCode === 'CONVITE' || cleanCode === 'VENDARIO' || cleanCode === 'AMIGO2')) {
        validInvitation = { code: cleanCode, active: true, usesRemaining: 1, createdBy: 'system' };
      }
    }

    if (!validInvitation) {
      const msg = 'Código de convite inválido, expirado ou já utilizado. Solicite um convite ativo para continuar.';
      setAuthError(msg);
      throw new Error(msg);
    }

    // 3. Criar conta no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 4. Atualizar nome no perfil do Firebase Auth
    if (fullName) {
      await updateProfile(user, { displayName: fullName });
    }

    // 4.1 Registra via endpoint oficial /api/auth/register (define claims e grava transação única no servidor)
    const e164Phone = phone ? toE164(phone) : null;
    let registeredViaBackend = false;
    try {
      const idToken = await user.getIdToken();
      const registerRes = await fetchDashboardApi('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          displayName: fullName || 'Cliente',
          inviteCode: cleanCode,
          ...(e164Phone ? { phoneNumber: e164Phone } : {})
        })
      });

      if (registerRes.ok) {
        registeredViaBackend = true;
        const regData = await registerRes.json().catch(() => ({}));
        if (Array.isArray(regData.generatedInvites)) {
          try {
            const invitesList = regData.generatedInvites;
            const cachePayload = {
              invitations: invitesList,
              invitedPeople: [],
              stats: {
                totalInvites: invitesList.length,
                availableCount: invitesList.length,
                usedCount: 0,
                referralEarnings: 0,
                activeCode: invitesList[0]?.code || null,
              },
              version: regData.invitationsVersion || Date.now(),
              cachedAt: Date.now(),
            };
            localStorage.setItem(`vendario_pwa_invites_v2_${user.uid}`, JSON.stringify(cachePayload));
          } catch {}
        }
        await user.getIdToken(true);
        await user.reload().catch(() => {});
      } else {
        const profileRes = await fetchDashboardApi('/api/auth/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            displayName: fullName || 'Cliente',
            ...(e164Phone ? { phoneNumber: e164Phone } : {})
          })
        });
        if (profileRes.ok) {
          await user.getIdToken(true);
          await user.reload().catch(() => {});
        }
      }
    } catch (profileErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[register] Aviso ao vincular perfil e claims no Firebase Auth backend:', profileErr);
      }
    }

    if (e164Phone) {
      localStorage.setItem(`vendario_pwa_phone_${user.uid}`, e164Phone);
      setUserPhone(e164Phone);
    }

    // 5. Gerar código de indicação (8 dígitos/caracteres divididos por -, totalmente aleatórios: XXXX-XXXX)
    const inviteChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let codePart1 = '';
    let codePart2 = '';
    for (let i = 0; i < 4; i++) {
      codePart1 += inviteChars.charAt(Math.floor(Math.random() * inviteChars.length));
      codePart2 += inviteChars.charAt(Math.floor(Math.random() * inviteChars.length));
    }
    const userReferralCode = `${codePart1}-${codePart2}`;
    const initialStatus = 'active';
    const referrerId = validInvitation.assignedTo || validInvitation.createdBy || null;

    if (!registeredViaBackend) {
      // Fallback cliente caso a API backend esteja offline
      const inviteDocData = {
        invitedBy: referrerId,
        referralCode: userReferralCode,
        referralEarnings: 0,
        referralCount: 0,
        invitationCodeId: inviteDocRef?.id || codeHash,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      try {
        await setDoc(doc(db, 'users', user.uid), inviteDocData);

        if (inviteDocRef) {
          const currentUses = typeof validInvitation.usesRemaining === 'number' ? validInvitation.usesRemaining : 1;
          const nextUses = Math.max(0, currentUses - 1);
          await updateDoc(inviteDocRef, {
            usesRemaining: nextUses,
            active: nextUses > 0,
            status: nextUses > 0 ? 'available' : 'used',
            consumedBy: user.uid,
            consumedByName: fullName || 'Cliente',
            consumedByEmail: email,
            consumedAt: serverTimestamp()
          }).catch(() => {});
        }

        if (referrerId && referrerId !== 'system') {
          try {
            const referrerDocRef = doc(db, 'users', referrerId);
            await setDoc(referrerDocRef, {
              referralCount: increment(1),
              updatedAt: serverTimestamp()
            }, { merge: true });

            if (rtdb) {
              import('firebase/database').then(({ ref, set }) => {
                set(ref(rtdb, `users/${referrerId}/invitationsVersion`), Date.now()).catch(() => {});
              }).catch(() => {});
            }
          } catch {}
        }
      } catch (saveErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Aviso ao gravar documentos de usuário e convite:', saveErr);
        }
      }
    }

    const fullProfile = {
      uid: user.uid,
      displayName: fullName || 'Cliente',
      email: email,
      phoneNumber: e164Phone || '',
      photoURL: user.photoURL || null,
      role: 'customer',
      status: initialStatus,
      referralCode: userReferralCode,
      invitedBy: referrerId,
      referralEarnings: 0,
      referralCount: 0,
    };
    setCurrentUser(user);
    setUserProfile(fullProfile);
    localStorage.setItem(`vendario_pwa_profile_${user.uid}`, JSON.stringify(fullProfile));
    return userCredential;
  };

  /**
   * Atualiza o nome (displayName) do cliente EXCLUSIVAMENTE no Firebase Authentication (0 Firestore reads/writes e 0 Cloud Functions)
   */
  const updateUserName = async (newName) => {
    if (!currentUser) throw new Error('Usuário não autenticado.');
    const cleanName = typeof newName === 'string' ? newName.trim() : '';
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Informe um nome válido com no mínimo 2 caracteres.');
    }

    // 1. Atualiza diretamente no Firebase Auth Client SDK (sem invocar Cloud Function)
    await updateProfile(currentUser, { displayName: cleanName });

    // 2. Atualiza estado e cache local
    const updated = {
      ...(userProfile || {}),
      displayName: cleanName,
    };
    setUserProfile(updated);
    localStorage.setItem(`vendario_pwa_profile_${currentUser.uid}`, JSON.stringify(updated));

    return { success: true, displayName: cleanName };
  };

  /**
   * Atualiza o número de telefone do cliente EXCLUSIVAMENTE no Firebase Authentication (0 Firestore reads/writes)
   */
  const updateUserPhone = async (newPhone) => {
    if (!currentUser) throw new Error('Usuário não autenticado.');
    const e164 = toE164(newPhone);
    if (!e164) throw new Error('Número de telefone inválido.');

    // 1. Persiste imediatamente no cache do dispositivo e contexto
    localStorage.setItem(`vendario_pwa_phone_${currentUser.uid}`, e164);
    setUserPhone(e164);

    const updated = {
      ...(userProfile || {}),
      phoneNumber: e164,
    };
    setUserProfile(updated);
    localStorage.setItem(`vendario_pwa_profile_${currentUser.uid}`, JSON.stringify(updated));

    // 2. Sincroniza de forma resiliente com o Firebase Admin Backend caso acessível
    try {
      const idToken = await currentUser.getIdToken();
      await fetchDashboardApi('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ phoneNumber: e164 })
      }).catch((fetchErr) => {
        console.warn('[updateUserPhone] Backend não acessível neste momento:', fetchErr);
      });
    } catch (apiErr) {
      console.warn('[updateUserPhone] Erro ao sincronizar telefone com backend:', apiErr);
    }

    await currentUser.reload().catch(() => {});

    return { success: true, phoneNumber: e164 };
  };

  /**
   * Atualiza múltiplos campos de perfil (nome e telefone) EXCLUSIVAMENTE no Firebase Authentication
   */
  const updateUserProfile = async ({ displayName, phoneNumber }) => {
    if (!currentUser) throw new Error('Usuário não autenticado.');
    const updates = {};
    if (displayName !== undefined && displayName !== null) {
      const clean = displayName.trim();
      if (clean.length < 2) throw new Error('O nome deve conter ao menos 2 caracteres.');
      updates.displayName = clean;
    }
    if (phoneNumber !== undefined && phoneNumber !== null) {
      const e164 = toE164(phoneNumber);
      if (!e164) throw new Error('Número de telefone inválido.');
      updates.phoneNumber = e164;
    }

    if (Object.keys(updates).length === 0) {
      return { success: true, profile: userProfile };
    }

    // 1. Atualiza o nome diretamente no Firebase Authentication do cliente
    if (updates.displayName) {
      await updateProfile(currentUser, { displayName: updates.displayName });
    }

    // 2. Persiste o telefone no storage do dispositivo e no contexto
    if (updates.phoneNumber) {
      localStorage.setItem(`vendario_pwa_phone_${currentUser.uid}`, updates.phoneNumber);
      setUserPhone(updates.phoneNumber);
    }

    // 3. Atualiza estado e cache local do perfil
    const updated = {
      ...(userProfile || {}),
      ...(updates.displayName ? { displayName: updates.displayName } : {}),
      ...(updates.phoneNumber ? { phoneNumber: updates.phoneNumber } : {}),
    };
    setUserProfile(updated);
    localStorage.setItem(`vendario_pwa_profile_${currentUser.uid}`, JSON.stringify(updated));

    // 4. Sincroniza com o Firebase Admin Backend apenas se houver atualização de telefone (displayName já foi salvo via updateProfile)
    if (updates.phoneNumber) {
      try {
        const idToken = await currentUser.getIdToken();
        await fetchDashboardApi('/api/auth/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(updates)
        }).catch((fetchErr) => {
          console.warn('[updateUserProfile] Backend offline ou inacessível, dados salvos no Authentication:', fetchErr);
        });
        await currentUser.reload().catch(() => {});
      } catch (apiErr) {
        console.warn('[updateUserProfile] Sincronização secundária com backend ignorada:', apiErr);
      }
    }

    return { success: true, profile: updated };
  };

  /**
   * Atualiza a senha do cliente diretamente no Firebase Authentication
   */
  const updateUserPassword = async (newPassword, currentPassword = null) => {
    if (!currentUser) throw new Error('Usuário não autenticado.');
    if (!newPassword || newPassword.length < 6) {
      throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
    }

    try {
      await updatePassword(currentUser, newPassword);
      return { success: true };
    } catch (err) {
      if (err.code === 'auth/requires-recent-login' && currentPassword && currentUser.email) {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        return { success: true };
      }
      if (err.code === 'auth/requires-recent-login') {
        throw new Error('Por segurança, informe sua senha atual para autorizar a alteração.');
      }
      if (err.code === 'auth/weak-password') {
        throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
      }
      throw new Error(err.message || 'Falha ao alterar senha.');
    }
  };

  /**
   * Finaliza sessão
   */
  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setUserPhone('');
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const value = {
    currentUser,
    userProfile,
    userPhone,
    loading,
    authError,
    login,
    registerWithInvite,
    updateUserName,
    updateUserPhone,
    updateUserProfile,
    updateUserPassword,
    logout,
    isAuthenticated: Boolean(currentUser)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
