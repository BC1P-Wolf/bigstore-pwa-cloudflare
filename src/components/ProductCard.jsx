import React, { useState, useEffect } from 'react';
import { Tag, Sparkles } from 'lucide-react';
import ProductModal from './ProductModal';
import { capitalizeProductName } from '../utils/textUtils';

const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';

export default function ProductCard({ product }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [product?.imageUrl]);

  const normCategory = (product.category || '').toLowerCase();
  const isService = normCategory === 'service' || normCategory === 'serviço' || normCategory === 'servico';
  const hasPromotions = product.quantityPromotions && product.quantityPromotions.length > 0;
  
  // Encontra o maior desconto disponível
  const maxDiscount = hasPromotions
    ? Math.max(...product.quantityPromotions.map((p) => Number(p.discountPercent) || 0))
    : 0;

  const imgSrc = !imgError && product.imageUrl ? product.imageUrl : DEFAULT_PRODUCT_IMAGE;

  return (
    <>
      <div 
        onClick={() => setModalOpen(true)}
        className="group relative bg-white dark:bg-[#18132d] rounded-2xl border border-purple-100 dark:border-purple-900/60 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-300 cursor-pointer flex flex-col"
      >
        {/* Imagem do Produto */}
        <div className="relative h-40 bg-gradient-to-tr from-purple-900/20 to-indigo-900/10 overflow-hidden flex items-center justify-center">
          <img
            src={imgSrc}
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />

          {/* Badge de Categoria */}
          <div className="absolute top-2.5 left-2.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm ${
              isService 
                ? 'bg-amber-500/90 text-white' 
                : 'bg-purple-600/90 text-white'
            }`}>
              {isService ? 'Serviço' : 'Produto'}
            </span>
          </div>

          {/* Badge de Desconto Máximo */}
          {maxDiscount > 0 && (
            <div className="absolute top-2.5 right-2.5">
              <span className="flex items-center gap-1 text-[10px] font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 text-white px-2 py-0.5 rounded-md shadow-md animate-pulse">
                <Tag className="w-3 h-3" />
                <span>Até -{maxDiscount}%</span>
              </span>
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="p-3.5 flex flex-col flex-1 justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors capitalize">
              {capitalizeProductName(product.name)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-purple-300/70 line-clamp-2 mt-1 leading-relaxed">
              {product.description || 'Clique para personalizar e adicionar ao pedido.'}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-purple-50 dark:border-purple-900/40 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 dark:text-purple-400 block -mb-0.5">A partir de</span>
              <span className="text-base font-extrabold text-purple-700 dark:text-purple-300">
                R$ {Number(product.price).toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/40 group-hover:bg-purple-600 group-hover:text-white text-purple-600 dark:text-purple-300 flex items-center justify-center transition"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ProductModal
        product={product}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
