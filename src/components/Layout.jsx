import React from 'react';
import Header from './Header';
import BottomNav from './BottomNav';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#fcfaff] dark:bg-[#0c0a1a] text-slate-900 dark:text-purple-100 flex flex-col transition-colors">
      <Header />
      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-3 pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
