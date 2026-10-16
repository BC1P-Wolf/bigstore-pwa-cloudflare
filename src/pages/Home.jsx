import React, { useState, useEffect } from 'react';
import ReferralBanner from '../components/ReferralBanner';
import ProductCard from '../components/ProductCard';
import { Search, Layers } from 'lucide-react';
import { getActiveProducts, getCachedProducts } from '../services/productCacheService';
import { sortProductsByLowestPrice } from '../utils/textUtils';

export default function Home() {
  const [products, setProducts] = useState(() => getCachedProducts()?.products || []);
  const [loading, setLoading] = useState(() => !getCachedProducts()?.products?.length);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let active = true;
    const syncCatalog = () => {
      getActiveProducts()
        .then((list) => {
          if (active && Array.isArray(list)) {
            setProducts(list);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.warn('Erro ao carregar produtos:', err);
          if (active) setLoading(false);
        });
    };

    syncCatalog();

    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncCatalog();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, []);

  const filteredProducts = products.filter((product) => {
    const normCategory = (product.category || '').toLowerCase();
    const isService = normCategory === 'service' || normCategory === 'serviço' || normCategory === 'servico';
    const isProduct = !isService;

    let matchCategory = true;
    if (selectedCategory === 'service') {
      matchCategory = isService;
    } else if (selectedCategory === 'product') {
      matchCategory = isProduct;
    }

    const matchSearch =
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  const sortedProducts = sortProductsByLowestPrice(filteredProducts);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Banner Principal de Indicação */}
      <ReferralBanner />

      {/* Barra de Pesquisa e Filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por serviços ou produtos..."
            aria-label="Pesquisar produtos e serviços"
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#16122c] border border-purple-200 dark:border-purple-900/60 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/60 focus:outline-none focus:ring-2 focus:ring-purple-600 transition shadow-sm"
          />
        </div>

        {/* Categorias PWA */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap transition active:scale-95 ${
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-white dark:bg-[#16122c] text-slate-600 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50 hover:bg-purple-50 dark:hover:bg-purple-950/40'
            }`}
          >
            Todos os Itens
          </button>

          <button
            onClick={() => setSelectedCategory('service')}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ${
              selectedCategory === 'service'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                : 'bg-white dark:bg-[#16122c] text-slate-600 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50 hover:bg-purple-50 dark:hover:bg-purple-950/40'
            }`}
          >
            <span>Serviços</span>
          </button>
        </div>
      </div>

      {/* Grid de Produtos */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 py-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 bg-purple-100/40 dark:bg-purple-950/30 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#16122c] rounded-2xl border border-purple-100 dark:border-purple-900/50 p-6">
          <Layers className="w-10 h-10 text-purple-400/40 mx-auto mb-2" />
          <h4 className="font-bold text-sm text-slate-700 dark:text-purple-200">Nenhum item encontrado</h4>
          <p className="text-xs text-slate-500 dark:text-purple-400 mt-1">Tente ajustar o termo de pesquisa ou categoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
