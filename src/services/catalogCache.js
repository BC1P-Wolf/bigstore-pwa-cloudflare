/**
 * catalogCache.js — Camada de Cache Local Inteligente para o Catálogo (Firestore + SWR / IndexedDB)
 *
 * Otimizado rigorosamente para o Free Tier do Firebase & Google Cloud:
 * 1. O app lê primeiramente o cache local do dispositivo (IndexedDB / localStorage).
 * 2. Em seguida, consulta apenas o nó leve de versão no Realtime Database:
 *      `settings/catalogVersion/version` (zero leituras no Firestore e zero conexões abertas).
 * 3. Se a versão local coincidir com a remota (ou offline):
 *      -> Serve diretamente do IndexedDB do dispositivo do usuário.
 *      -> ZERO leituras na coleção de produtos do Firestore!
 * 4. Apenas quando a versão do catálogo for alterada (novo produto, alteração de preço, etc.):
 *      -> Baixa os produtos ativos do Firestore (`products`), atualiza o IndexedDB
 *         e armazena a nova versão registrada.
 */
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { ref as rtdbRef, get as rtdbGet } from 'firebase/database';
import useSWR from 'swr';
import { db, rtdb } from './firebase';
import { DEFAULT_PRODUCTS } from './defaultProducts';
import { capitalizeProductName, sortProductsByLowestPrice } from '../utils/textUtils';

const IDB_NAME = 'VendarioProductCache';
const IDB_VERSION = 1;
const IDB_STORE = 'catalog';
const IDB_KEY = 'catalog_v3';
const LS_CACHE_KEY = 'vendario_catalog_ls_v3';

// Cache em memória para leitura síncrona instantânea (evita layout shifts)
let memoryCache = null;

// Inicializa memoryCache a partir do localStorage de forma segura e limpa chaves legadas
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vendario_catalog_ls_v2');
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (raw) memoryCache = JSON.parse(raw);
  }
} catch {
  memoryCache = null;
}

// ─── IndexedDB Helpers ────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains(IDB_STORE)) {
        dbInstance.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => resolve(null);
  });
}

async function idbGet(key) {
  const dbInstance = await openDB();
  if (!dbInstance) return null;
  return new Promise((resolve) => {
    try {
      const tx = dbInstance.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = (e) => resolve(e.target.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key, value) {
  const dbInstance = await openDB();
  if (!dbInstance) return;
  return new Promise((resolve) => {
    try {
      const tx = dbInstance.transaction(IDB_STORE, 'readwrite');
      if (value === null) {
        tx.objectStore(IDB_STORE).delete(key);
      } else {
        tx.objectStore(IDB_STORE).put(value, key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ─── LocalStorage Helpers ────────────────────────────────────────────────────

function lsGet() {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsSet(data) {
  try {
    if (data === null) {
      localStorage.removeItem(LS_CACHE_KEY);
    } else {
      localStorage.setItem(LS_CACHE_KEY, JSON.stringify(data));
    }
  } catch {}
}

// Throttle curto (3s) em memória apenas para evitar chamadas duplicadas simultâneas na mesma montagem
let lastVersionCheckAt = 0;
let lastKnownRemoteVersion = 0;
const VERSION_CHECK_COOLDOWN_MS = 3_000;

/**
 * Consulta pontualmente o número da versão do catálogo no Realtime Database:
 *   Caminho: `settings/catalogVersion/version` (< 32 bytes, ZERO leituras no Firestore
 *   e sem manter conexão WebSocket aberta).
 * Retorna 0 caso a leitura falhe (ex: offline).
 */
export async function fetchCatalogVersion(force = false) {
  const now = Date.now();
  if (!force && lastKnownRemoteVersion > 0 && now - lastVersionCheckAt < VERSION_CHECK_COOLDOWN_MS) {
    return lastKnownRemoteVersion;
  }

  try {
    if (rtdb) {
      const snap = await rtdbGet(rtdbRef(rtdb, 'settings/catalogVersion/version'));
      if (snap.exists()) {
        const val = snap.val();
        const parsed = typeof val === 'number' ? val : typeof val === 'string' ? Number(val) || 1 : 1;
        lastKnownRemoteVersion = parsed;
        lastVersionCheckAt = now;
        return parsed;
      }
    }
  } catch (rtdbErr) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[catalogCache] Falha ao verificar catalogVersion no RTDB:', rtdbErr);
    }
  }

  return 0; // Indicador de modo offline / ainda não inicializado
}

// ─── Download dos Produtos no Firestore ─────────────────────────────────────

/**
 * Busca a lista completa de produtos com status 'Ativo' no Firestore.
 * Executada SOMENTE na primeira abertura ou quando a versão do catálogo for alterada.
 * Retorna `Array` quando a consulta ao Firestore é concluída (mesmo que `[]`)
 * ou `null` caso ocorra erro de rede/permissão.
 */
export async function fetchProductsFromFirestore() {
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('status', '==', 'Ativo'), limit(100));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const list = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          name: capitalizeProductName(data.name),
        };
      });

      // Ordenação consistente em memória por menor preço (ordem crescente de preço)
      return sortProductsByLowestPrice(list);
    }
    return [];
  } catch (err) {
    console.warn('[catalogCache] Erro ao carregar produtos do Firestore:', err);
    return null;
  }
}

// ─── Operações de Cache Local ────────────────────────────────────────────────

function normalizeCatalogProducts(products) {
  if (!Array.isArray(products)) return [];
  const mapped = products.map((p) => ({
    ...p,
    name: capitalizeProductName(p?.name),
  }));
  return sortProductsByLowestPrice(mapped);
}

/**
 * Lê o catálogo do armazenamento local (Memória -> IndexedDB -> localStorage).
 */
export async function readCachedCatalog() {
  if (memoryCache && Array.isArray(memoryCache.products)) {
    return { ...memoryCache, products: normalizeCatalogProducts(memoryCache.products) };
  }
  const idbData = await idbGet(IDB_KEY);
  if (idbData && Array.isArray(idbData.products)) {
    const normalized = { ...idbData, products: normalizeCatalogProducts(idbData.products) };
    memoryCache = normalized;
    lsSet(normalized);
    return normalized;
  }
  const lsData = lsGet();
  if (lsData && Array.isArray(lsData.products)) {
    const normalized = { ...lsData, products: normalizeCatalogProducts(lsData.products) };
    memoryCache = normalized;
    return normalized;
  }
  return null;
}

/**
 * Grava os produtos no cache local (IndexedDB + localStorage + memória) com a versão.
 */
export async function saveCatalog(products, version) {
  const normalizedProducts = normalizeCatalogProducts(products);
  const payload = { products: normalizedProducts, version, savedAt: Date.now() };
  memoryCache = payload;
  lsSet(payload);
  await idbSet(IDB_KEY, payload);
}

/**
 * Invalida o cache local (força atualização completa na próxima leitura).
 */
export async function invalidateCatalogCache() {
  memoryCache = null;
  lsSet(null);
  await idbSet(IDB_KEY, null);
}

/**
 * Leitura SÍNCRONA do cache em memória/localStorage.
 * Permite que a tela inicial monte os produtos instantaneamente (zero loading screen).
 */
export function getSyncCachedProducts() {
  if (memoryCache && Array.isArray(memoryCache.products)) {
    return { products: normalizeCatalogProducts(memoryCache.products), version: memoryCache.version, isFresh: true };
  }
  const ls = lsGet();
  if (ls && Array.isArray(ls.products)) {
    const normalizedProducts = normalizeCatalogProducts(ls.products);
    memoryCache = { ...ls, products: normalizedProducts };
    return { products: normalizedProducts, version: ls.version, isFresh: true };
  }
  return null;
}

// ─── Função Principal: getProducts (Estratégia Híbrida Inteligente) ──────────

/**
 * Obtém a lista de produtos ativos aplicando a política de mínimo consumo do Firestore:
 *
 * 1. Tenta carregar do IndexedDB/localStorage.
 * 2. Faz UMA leitura leve de metadados (`settings/catalogVersion/version`) no RTDB.
 * 3. Se a versão bate com o cache local:
 *    -> Retorna o cache local imediatamente! ZERO LEITURAS adicionais no Firestore.
 * 4. Se a versão for diferente ou não houver cache:
 *    -> Baixa os produtos do Firestore (inclusive se for `[]`), atualiza o IndexedDB e persiste a nova versão.
 * 5. Se estiver offline:
 *    -> Retorna os dados em cache local ou `[]`.
 */
export async function getProducts(forceRefresh = false) {
  try {
    const cached = await readCachedCatalog();

    if (!forceRefresh && cached && Array.isArray(cached.products)) {
      // Se estiver explicitamente offline no navegador, serve direto do dispositivo
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return cached.products;
      }

      // Verifica se houve alteração no catálogo via nó leve de versão no RTDB
      const remoteVersion = await fetchCatalogVersion();

      // Se a versão bate exatamente com o cache local -> ZERO leituras adicionais no Firestore!
      if (remoteVersion > 0 && cached.version === remoteVersion) {
        return cached.products;
      }

      // Se não conseguiu checar versão (offline) e o cache acabou de ser salvo (< 15s)
      if (remoteVersion === 0 && cached.savedAt && Date.now() - cached.savedAt < 15_000) {
        return cached.products;
      }

      // Versão alterada no Firestore: baixa lista atualizada (inclusive se vazia [])
      const freshProducts = await fetchProductsFromFirestore();
      if (Array.isArray(freshProducts)) {
        await saveCatalog(freshProducts, remoteVersion || Date.now());
        return freshProducts;
      }
      return cached.products;
    }

    // Sem cache local prévio ou forceRefresh solicitado
    const [remoteVersion, freshProducts] = await Promise.all([
      fetchCatalogVersion(),
      fetchProductsFromFirestore(),
    ]);

    if (Array.isArray(freshProducts)) {
      await saveCatalog(freshProducts, remoteVersion || Date.now());
      return freshProducts;
    }

    // Se falhou por estar offline, usa cache anterior ou lista vazia
    return Array.isArray(cached?.products) ? cached.products : DEFAULT_PRODUCTS;
  } catch (err) {
    console.warn('[catalogCache] Erro geral ao buscar catálogo. Usando cache local/padrão:', err);
    const cached = await readCachedCatalog();
    return Array.isArray(cached?.products) ? cached.products : DEFAULT_PRODUCTS;
  }
}

// ─── Hook SWR: useCatalogProducts ────────────────────────────────────────────

/**
 * Hook React utilizando SWR integrado com IndexedDB e Firestore.
 * Fornece dados reativos, cache em primeiro plano e revalidação de versão em background.
 */
export function useCatalogProducts(options = {}) {
  const syncFallback = getSyncCachedProducts();
  const fallbackData = syncFallback?.products || DEFAULT_PRODUCTS;

  return useSWR(
    'firestore/catalog/active_products',
    () => getProducts(Boolean(options.forceRefresh)),
    {
      fallbackData,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000, // 1 minuto de desduplicação
      ...options,
    }
  );
}
