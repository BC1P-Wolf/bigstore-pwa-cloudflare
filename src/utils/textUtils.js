/**
 * textUtils.js
 * Utilitários de texto e ordenação para o PWA
 */

/**
 * Formata o nome do produto com Capitalize (primeira letra maiúscula).
 * Exemplos:
 *  "seguidores instagram" -> "Seguidores Instagram"
 *  "SEGUIDORES REAIS"     -> "Seguidores Reais"
 *  "1000 curtidas"        -> "1000 Curtidas"
 */
export function capitalizeProductName(name) {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Ordena a lista de produtos por ordem de menor preço (crescente).
 * Em caso de empate no preço, desempata em ordem alfabética pelo nome.
 */
export function sortProductsByLowestPrice(products) {
  if (!Array.isArray(products)) return [];
  return [...products].sort((a, b) => {
    const priceA = typeof a?.price === 'number' ? a.price : parseFloat(a?.price) || 0;
    const priceB = typeof b?.price === 'number' ? b.price : parseFloat(b?.price) || 0;
    if (priceA !== priceB) return priceA - priceB;
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR');
  });
}
