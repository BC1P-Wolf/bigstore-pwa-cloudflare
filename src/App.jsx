import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CartProvider } from './contexts/CartContext';
import { PlatformProvider } from './contexts/PlatformContext';
import AuthGuard from './components/AuthGuard';
import MaintenanceGuard from './components/MaintenanceGuard';
import Layout from './components/Layout';

// Páginas carregadas sob demanda (Code Splitting) para economizar a cota de 360 MB/dia do Firebase Hosting
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Home = lazy(() => import('./pages/Home'));
const Cart = lazy(() => import('./pages/Cart'));
const PixCheckout = lazy(() => import('./pages/PixCheckout'));
const Orders = lazy(() => import('./pages/Orders'));
const Profile = lazy(() => import('./pages/Profile'));
const Referrals = lazy(() => import('./pages/Referrals'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  return (
    <ThemeProvider>
      <PlatformProvider>
        <AuthProvider>
          <CartProvider>
            <MaintenanceGuard>
              <BrowserRouter>
                <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
                  <Routes>
                    {/* Rotas Públicas de Acesso */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Rotas Protegidas Globais (Requer Auth + Role customer + Status active) */}
                    <Route
                      path="/"
                      element={
                        <AuthGuard>
                          <Layout>
                            <Home />
                          </Layout>
                        </AuthGuard>
                      }
                    />

                    <Route
                      path="/carrinho"
                      element={
                        <AuthGuard>
                          <Layout>
                            <Cart />
                          </Layout>
                        </AuthGuard>
                      }
                    />

                    <Route
                      path="/checkout/pix/:paymentId"
                      element={
                        <AuthGuard>
                          <Layout>
                            <PixCheckout />
                          </Layout>
                        </AuthGuard>
                      }
                    />

                    <Route
                      path="/pedidos"
                      element={
                        <AuthGuard>
                          <Layout>
                            <Orders />
                          </Layout>
                        </AuthGuard>
                      }
                    />

                    <Route
                      path="/perfil"
                      element={
                        <AuthGuard>
                          <Layout>
                            <Profile />
                          </Layout>
                        </AuthGuard>
                      }
                    />

                    <Route
                      path="/perfil/indicacoes"
                      element={
                        <AuthGuard>
                          <Layout>
                            <Referrals />
                          </Layout>
                        </AuthGuard>
                      }
                    />

                    <Route
                      path="/perfil/configuracoes"
                      element={
                        <AuthGuard>
                          <Layout>
                            <Settings />
                          </Layout>
                        </AuthGuard>
                      }
                    />

                    {/* Redirecionamento Padrão */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </MaintenanceGuard>
          </CartProvider>
        </AuthProvider>
      </PlatformProvider>
    </ThemeProvider>
  );
}
