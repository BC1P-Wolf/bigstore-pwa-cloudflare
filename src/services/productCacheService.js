/**
 * productCacheService.js
 * Fachada e adapter retrocompatível para o catalogCache.js (Firestore + IndexedDB/SWR).
 * Mantém 100% de compatibilidade com os componentes existentes da aplicação PWA.
 */
import { 
  getProducts, 
  invalidateCatalogCache, 
  getSyncCachedProducts,
  useCatalogProducts 
} from './catalogCache';

export { DEFAULT_PRODUCTS } from './defaultProducts';
export { useCatalogProducts };

/**
 * Busca produtos ativos no Firestore com estratégia de cache local inteligente.
 * @param {boolean} forceRefresh - Se true, força recarregamento do Firestore
 */
export async function getActiveProducts(forceRefresh = false) {
  return getProducts(forceRefresh);
}

/**
 * Invalida o cache local do catálogo (IndexedDB, localStorage e memória).
 */
export function invalidateProductsCache() {
  invalidateCatalogCache().catch(() => {});
}

/**
 * Leitura síncrona do cache local de produtos (IndexedDB/localStorage/memória).
 * Usado na montagem de estados locais do React para evitar telas brancas e loading spinners.
 */
export function getCachedProducts() {
  return getSyncCachedProducts();
}

/**
 * Salva produtos no cache local (compatibilidade).
 */
export function saveProductsToCache() {
  // Gerenciado automaticamente pelo catalogCache
}
