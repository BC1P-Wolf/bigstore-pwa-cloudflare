/**
 * invitationsCache.js — Camada de Cache e Persistência Local Inteligente para Convites
 *
 * Otimizado rigorosamente para o Free Tier do Firebase:
 * 1. O app lê primeiro os dados persistidos no dispositivo (localStorage) para render instantâneo.
 * 2. Em seguida, verifica apenas a versão leve do usuário no Realtime Database:
 *      `users/{userId}/invitationsVersion` (Zero leituras no Firestore!).
 * 3. Se a versão local coincidir com a remota (ou offline):
 *      -> Serve diretamente do cache local do dispositivo.
 *      -> ZERO leituras na coleção invitationCodes e users do Firestore!
 * 4. Apenas quando a versão for alterada (novo convite atribuído ou amigo cadastrado):
 *      -> Busca os convites reais do Firestore, atualiza o cache local
 *         e armazena a nova versão registrada.
 */

import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref as rtdbRef, get as rtdbGet } from 'firebase/database';
import { db, rtdb } from './firebase';

const CACHE_KEY_PREFIX = 'vendario_pwa_invites_v2_';

// Memória RAM para evitar layout shift durante a navegação interna
const memoryCache = new Map();

/**
 * Retorna os dados em cache local síncrono imediatamente (0ms de latência)
 */
export function getCachedInvitations(userId) {
  if (!userId) return null;
  if (memoryCache.has(userId)) {
    return memoryCache.get(userId);
  }
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryCache.set(userId, parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[invitationsCache] Erro ao ler cache local:', err);
  }
  return null;
}

/**
 * Salva os dados no cache local (localStorage e memória)
 */
export function setCachedInvitations(userId, data) {
  if (!userId || !data) return;
  memoryCache.set(userId, data);
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(data));
    }
  } catch (err) {
    console.warn('[invitationsCache] Erro ao salvar cache local:', err);
  }
}

const VERSION_CHECK_COOLDOWN_MS = 60_000; // Cooldown de 60s para evitar leituras repetidas no RTDB
const versionCheckCache = new Map();

/**
 * Obtém a versão remota mais recente dos convites do usuário.
 * Consulta exclusivamente o Realtime Database (RTDB) via leitura pontual (get)
 * para garantir ZERO leituras no Firestore e ZERO conexões WebSocket mantidas abertas.
 */
export async function fetchInvitationsVersion(userId, userProfile, forceRefresh = false) {
  if (!userId) return 0;

  const now = Date.now();
  const lastCheck = versionCheckCache.get(userId);
  if (!forceRefresh && lastCheck && now - lastCheck.at < VERSION_CHECK_COOLDOWN_MS && lastCheck.version > 0) {
    return lastCheck.version;
  }

  try {
    if (rtdb) {
      const snap = await rtdbGet(rtdbRef(rtdb, `users/${userId}/invitationsVersion`));
      if (snap.exists()) {
        const val = snap.val();
        const parsed = typeof val === 'number' ? val : (Number(val) || 1);
        versionCheckCache.set(userId, { version: parsed, at: now });
        return parsed;
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[invitationsCache] RTDB version check indisponível:', err);
    }
  }

  if (userProfile?.referralCount !== undefined) {
    return userProfile.referralCount;
  }

  return 0; // Indicador de primeira consulta ou offline
}

/**
 * Mascara e-mail para exibição amigável e segura (ex: carlos***@gmail.com)
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return `${name}***@${domain}`;
  return `${name.slice(0, 3)}***@${domain}`;
}

/**
 * Busca a lista de convites reais e pessoas convidadas no Firestore (exclusivamente em invitationCodes)
 */
export async function fetchInvitationsFromFirestore(userId, userProfile) {
  if (!userId) {
    return { invitations: [], invitedPeople: [], stats: {} };
  }

  const rawInvitations = [];
  const rawInvitedPeople = [];
  let userReferralEarnings = Number(userProfile?.referralEarnings || 0);
  let userReferralCount = Number(userProfile?.referralCount || 0);

  try {
    // 1. Busca convites reais atribuídos ao usuário na coleção única invitationCodes
    // Utiliza o índice composto (assignedTo ASC, createdAt DESC) limitado aos 50 mais recentes
    const invCodesRef = collection(db, 'invitationCodes');
    const qAssignedIndexed = query(
      invCodesRef,
      where('assignedTo', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const [snapAssigned, userDocSnap] = await Promise.all([
      getDocs(qAssignedIndexed).catch(() =>
        getDocs(query(invCodesRef, where('assignedTo', '==', userId), limit(50)))
      ),
      getDoc(doc(db, 'users', userId)).catch(() => null),
    ]);

    if (userDocSnap && userDocSnap.exists()) {
      const uData = userDocSnap.data();
      if (typeof uData.referralEarnings === 'number') {
        userReferralEarnings = uData.referralEarnings;
      }
      if (typeof uData.referralCount === 'number') {
        userReferralCount = uData.referralCount;
      }
    }

    snapAssigned.forEach((docSnap) => {
      const data = docSnap.data();
      const isUsed = data.active !== true || Boolean(data.consumedBy);
      const isExpired = Boolean(
        data.expiresAt &&
        (typeof data.expiresAt.toMillis === 'function'
          ? data.expiresAt.toMillis() <= Date.now()
          : new Date(data.expiresAt).getTime() <= Date.now())
      );

      const status = isUsed ? 'used' : isExpired ? 'expired' : 'available';
      const codeStr = typeof data.code === 'string' ? data.code : docSnap.id;

      const createdAtStr = data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString();

      const expiresAtStr = data.expiresAt?.toDate
        ? data.expiresAt.toDate().toISOString()
        : data.expiresAt ? new Date(data.expiresAt).toISOString() : null;

      const consumedAtStr = data.consumedAt?.toDate
        ? data.consumedAt.toDate().toISOString()
        : data.consumedAt ? new Date(data.consumedAt).toISOString() : null;

      rawInvitations.push({
        id: docSnap.id,
        code: codeStr,
        status,
        createdAt: createdAtStr,
        expiresAt: expiresAtStr,
        consumedByName: data.consumedByName || null,
        consumedByEmail: data.consumedByEmail || null,
        consumedAt: consumedAtStr,
      });

      // Se foi consumido, adiciona à lista de pessoas convidadas
      if (isUsed && (data.consumedByName || data.consumedBy)) {
        rawInvitedPeople.push({
          id: data.consumedBy || docSnap.id,
          name: data.consumedByName || 'Convidado',
          email: maskEmail(data.consumedByEmail),
          codeUsed: codeStr,
          joinedAt: consumedAtStr || createdAtStr,
          status: 'Ativo',
        });
      }
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[invitationsCache] Erro ao consultar Firestore:', err);
    }
  }

  // 2. Ordena os convites reais do database: disponíveis primeiro, depois utilizados, depois expirados
  const sortedInvitations = rawInvitations.sort((a, b) => {
    if (a.status === 'available' && b.status !== 'available') return -1;
    if (a.status !== 'available' && b.status === 'available') return 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  // Ordena pessoas convidadas pelas mais recentes e limita a no máximo 10 pessoas
  const sortedInvitedPeople = rawInvitedPeople
    .sort((a, b) => (b.joinedAt || '').localeCompare(a.joinedAt || ''))
    .slice(0, 10);

  const availableCodes = sortedInvitations.filter((i) => i.status === 'available');
  const availableCount = availableCodes.length;
  const usedCount = sortedInvitations.filter((i) => i.status === 'used').length;
  const activeCode = availableCodes.length > 0 ? availableCodes[0].code : null;

  return {
    invitations: sortedInvitations,
    invitedPeople: sortedInvitedPeople,
    stats: {
      totalInvites: sortedInvitations.length,
      availableCount,
      usedCount: Math.max(usedCount, userReferralCount),
      referralEarnings: userReferralEarnings,
      activeCode, // Convite real disponível gerado no dashboard
    },
  };
}

/**
 * Função principal: carrega convites usando cache inteligente com versão.
 * 
 * Fluxo:
 * 1. Retorna cache local imediatamente se existir.
 * 2. Em segundo plano, verifica a versão remota.
 * 3. Se a versão remota for idêntica à versão local -> NÃO FAZ NENHUMA LEITURA NO FIRESTORE!
 * 4. Se a versão mudou -> busca dados reais no Firestore e atualiza o cache local.
 */
export async function loadUserInvitations(userId, userProfile, onUpdate = null, forceRefresh = false) {
  if (!userId) return null;

  const cached = getCachedInvitations(userId);
  if (cached && onUpdate && !forceRefresh) {
    onUpdate(cached);
  }

  try {
    const remoteVersion = await fetchInvitationsVersion(userId, userProfile, forceRefresh);

    // Se temos cache local e a versão é a mesma, reutiliza com ZERO leituras no Firestore
    if (!forceRefresh && cached && cached.version && cached.version === remoteVersion && remoteVersion > 0) {
      return cached;
    }

    // Se não há cache ou a versão mudou, busca dados atualizados
    const freshData = await fetchInvitationsFromFirestore(userId, userProfile);
    const newVersion = remoteVersion || Date.now();

    const payload = {
      ...freshData,
      version: newVersion,
      cachedAt: Date.now(),
    };

    setCachedInvitations(userId, payload);
    if (onUpdate) {
      onUpdate(payload);
    }

    return payload;
  } catch (err) {
    console.warn('[invitationsCache] Falha ao sincronizar com servidor, servindo cache:', err);
    return cached;
  }
}
