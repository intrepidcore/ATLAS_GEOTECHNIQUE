/**
 * Routes pour l'application mobile PWA Atlas Colab
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';

// Lazy loading des pages mobiles pour optimiser le bundle
const ColabMobileMissionsPage = lazy(() => import('@/pages/mobile/ColabMobileMissionsPage'));
const ColabMobileMissionDetailPage = lazy(() => import('@/pages/mobile/ColabMobileMissionDetailPage'));
const ColabMobileMissionMapPage = lazy(() => import('@/pages/mobile/ColabMobileMissionMapPage'));
const ColabMobileNewSondagePage = lazy(() => import('@/pages/mobile/ColabMobileNewSondagePage'));
const ColabMobileActivityPage = lazy(() => import('@/pages/mobile/ColabMobileActivityPage'));

// Loading spinner pour le lazy loading
const MobileLoadingSpinner: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
      <p className="text-gray-600">Chargement...</p>
    </div>
  </div>
);

// Composant de route protégée utilisant AuthContext
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  if (isLoading) {
    return <MobileLoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    // Avec basename="/colab/mobile", les routes sont relatives
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

// Page de login mobile wrapper
const MobileLoginPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  
  if (isAuthenticated) {
    // Rediriger vers /missions (relatif au basename)
    const from = (location.state as any)?.from?.pathname || '/missions';
    return <Navigate to={from} replace />;
  }
  
  return <LoginPage variant="mobile" />;
};

/**
 * Routes mobiles pour Atlas Colab PWA
 * 
 * Routes:
 * - /colab/mobile/login - Page de connexion
 * - /colab/mobile/missions - Liste des missions (protégée)
 * - /colab/mobile/missions/:id - Détail mission (protégée)
 * - /colab/mobile/missions/:id/map - Carte terrain (protégée)
 * - /colab/mobile/missions/:id/sondages/new - Nouveau sondage (protégée)
 */
const MobileRoutes: React.FC = () => {
  return (
    <Suspense fallback={<MobileLoadingSpinner />}>
      <Routes>
        {/* Page de connexion - chemin relatif au basename /colab/mobile */}
        <Route path="/login" element={<MobileLoginPage />} />
        
        {/* Redirection par défaut */}
        <Route path="/" element={<Navigate to="/missions" replace />} />
        
        {/* Routes Colab Mobile (protégées) - chemins relatifs */}
        <Route path="/missions" element={
          <ProtectedRoute><ColabMobileMissionsPage /></ProtectedRoute>
        } />
        <Route path="/missions/:id" element={
          <ProtectedRoute><ColabMobileMissionDetailPage /></ProtectedRoute>
        } />
        <Route path="/missions/:id/map" element={
          <ProtectedRoute><ColabMobileMissionMapPage /></ProtectedRoute>
        } />
        <Route path="/missions/:id/sondages/new" element={
          <ProtectedRoute><ColabMobileNewSondagePage /></ProtectedRoute>
        } />
        <Route path="/activity" element={
          <ProtectedRoute><ColabMobileActivityPage /></ProtectedRoute>
        } />
        
        {/* Fallback - 404 */}
        <Route path="*" element={<Navigate to="/missions" replace />} />
      </Routes>
    </Suspense>
  );
};

export default MobileRoutes;
