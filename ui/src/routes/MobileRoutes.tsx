/**
 * Routes pour l'application mobile PWA Atlas Colab
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Lazy loading des pages mobiles pour optimiser le bundle
const ColabMobileMissionsPage = lazy(() => import('@/pages/mobile/ColabMobileMissionsPage'));
const ColabMobileMissionDetailPage = lazy(() => import('@/pages/mobile/ColabMobileMissionDetailPage'));
const ColabMobileMissionMapPage = lazy(() => import('@/pages/mobile/ColabMobileMissionMapPage'));
const ColabMobileNewSondagePage = lazy(() => import('@/pages/mobile/ColabMobileNewSondagePage'));

// Loading spinner pour le lazy loading
const MobileLoadingSpinner: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
      <p className="text-gray-600">Chargement...</p>
    </div>
  </div>
);

/**
 * Routes mobiles pour Atlas Colab PWA
 * 
 * Routes:
 * - /colab/mobile/missions - Liste des missions
 * - /colab/mobile/missions/:id - Détail mission
 * - /colab/mobile/missions/:id/map - Carte terrain
 * - /colab/mobile/missions/:id/sondages/new - Nouveau sondage
 */
const MobileRoutes: React.FC = () => {
  return (
    <Suspense fallback={<MobileLoadingSpinner />}>
      <Routes>
        {/* Redirection par défaut */}
        <Route path="/" element={<Navigate to="/colab/mobile/missions" replace />} />
        
        {/* Routes Colab Mobile */}
        <Route path="/colab/mobile/missions" element={<ColabMobileMissionsPage />} />
        <Route path="/colab/mobile/missions/:id" element={<ColabMobileMissionDetailPage />} />
        <Route path="/colab/mobile/missions/:id/map" element={<ColabMobileMissionMapPage />} />
        <Route path="/colab/mobile/missions/:id/sondages/new" element={<ColabMobileNewSondagePage />} />
        
        {/* Fallback - 404 */}
        <Route path="*" element={<Navigate to="/colab/mobile/missions" replace />} />
      </Routes>
    </Suspense>
  );
};

export default MobileRoutes;
