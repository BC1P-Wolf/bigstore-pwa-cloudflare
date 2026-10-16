import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ShoppingBag, Package, User } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

export default function BottomNav() {
  const { totalItemsCount } = useCart();

  const navItems = [
    { to: '/', label: 'Home', icon: Home, exact: true },
    { to: '/carrinho', label: 'Carrinho', icon: ShoppingBag, badge: totalItemsCount },
    { to: '/pedidos', label: 'Pedidos', icon: Package },
    { to: '/perfil', label: 'Perfil', icon: User, matchPrefix: true }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0e0b1d]/95 backdrop-blur-lg border-t border-purple-100 dark:border-purple-950/70 safe-bottom transition-colors shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `
                relative flex flex-col items-center justify-center w-16 py-1 text-xs font-medium transition-all duration-200
                ${
                  isActive
                    ? 'text-purple-600 dark:text-purple-400 font-semibold scale-105'
                    : 'text-gray-500 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-300'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <div
                      className={`p-1 rounded-xl transition-all ${
                        isActive
                          ? 'bg-purple-100 dark:bg-purple-900/50 shadow-sm shadow-purple-500/20'
                          : ''
                      }`}
                    >
                      <Icon className="w-5 h-5 transition-transform" />
                    </div>

                    {/* Badge contador de itens */}
                    {Boolean(item.badge && item.badge > 0) && (
                      <span className="absolute -top-1 -right-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-sm">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] mt-0.5 tracking-tight">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 w-8 h-1 bg-purple-600 dark:bg-purple-400 rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
