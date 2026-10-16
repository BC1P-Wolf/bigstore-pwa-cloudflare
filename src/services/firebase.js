import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore 
} from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const DB_URL =
  process.env.REACT_APP_FIREBASE_DATABASE_URL ||
  "https://vendario-50238-default-rtdb.firebaseio.com";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBxHhU7ibkto_1Eo1fv8PzhpbR_QGuBv40",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "vendario-50238.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "vendario-50238",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "vendario-50238.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "71791171183",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:71791171183:web:524ddef617e70c2d44df9a",
  databaseURL: DB_URL
};

// Initialize Firebase once
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Auth instance with local persistence for PWA mobile sessions
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Aviso ao definir persistência de autenticação:", err);
});

// Firestore instance com persistência local em IndexedDB (Zero reads para dados em cache)
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

/**
 * Ativa persistência offline (IndexedDB local cache).
 * Garante que dados locais e catálogo evitem tráfego e leituras repetidas no F5.
 */
export async function enableIndexedDbPersistence() {
  // Configurada no Firestore via persistentLocalCache
  return Promise.resolve();
}

// Realtime Database instance (usado sob demanda para chat ao vivo e checkout Pix)
export const rtdb = getDatabase(app, DB_URL);

/**
 * Gerenciador inteligente de conexões do Realtime Database (Boas Práticas Firebase).
 * - O RTDB conecta automaticamente sob demanda ao criar um listener ou gravar dados.
 * - Quando o usuário minimiza a aba ou bloqueia o celular, a conexão WebSocket é pausada
 *   liberando o slot de conexões simultâneas (evita estourar o limite de 100 conexões do plano gratuito)
 *   e poupando bateria e dados móveis do usuário.
 * - Ao retornar para a aba ativa, a conexão é restabelecida instantaneamente.
 */
let rtdbDisconnectTimeout = null;

export function ensureRtdbOnline() {
  if (typeof window === 'undefined') return;
  if (rtdbDisconnectTimeout) {
    clearTimeout(rtdbDisconnectTimeout);
    rtdbDisconnectTimeout = null;
  }
  import('firebase/database').then(({ goOnline }) => {
    try { goOnline(rtdb); } catch {}
  }).catch(() => {});
}

export function ensureRtdbOffline() {
  if (typeof window === 'undefined') return;
  import('firebase/database').then(({ goOffline }) => {
    try { goOffline(rtdb); } catch {}
  }).catch(() => {});
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Pausa conexão se a aba permanecer inativa por mais de 10 segundos
      rtdbDisconnectTimeout = setTimeout(() => {
        ensureRtdbOffline();
      }, 10000);
    } else if (document.visibilityState === 'visible') {
      ensureRtdbOnline();
    }
  });
}

// Storage instance
export const storage = getStorage(app);

// Cloud Functions instance (região us-central1 para operar 100% dentro do Always Free Tier do Google Cloud)
export const functionsInstance = getFunctions(app, 'us-central1');

export default app;
