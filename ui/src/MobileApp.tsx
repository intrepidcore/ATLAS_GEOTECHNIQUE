/**
 * Point d'entrée de l'application mobile PWA Atlas Colab
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import MobileRoutes from '@/routes/MobileRoutes';
import { registerSW } from 'virtual:pwa-register';

// Composant pour gérer les mises à jour PWA
const PWAUpdatePrompt: React.FC<{
  needRefresh: boolean;
  onRefresh: () => void;
  onClose: () => void;
}> = ({ needRefresh, onRefresh, onClose }) => {
  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[2000] bg-blue-600 text-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Mise à jour disponible</p>
          <p className="text-sm opacity-80">Une nouvelle version est prête</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm bg-white/20 rounded-lg"
          >
            Plus tard
          </button>
          <button
            onClick={onRefresh}
            className="px-3 py-1 text-sm bg-white text-blue-600 rounded-lg font-medium"
          >
            Mettre à jour
          </button>
        </div>
      </div>
    </div>
  );
};

const MobileApp: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    // Enregistrer le service worker
    const updateServiceWorker = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        console.log('App ready to work offline');
      },
    });

    setUpdateSW(() => updateServiceWorker);
  }, []);

  const handleRefresh = async () => {
    if (updateSW) {
      await updateSW();
    }
  };

  const handleClose = () => {
    setNeedRefresh(false);
  };

  return (
    <AuthProvider>
      <BrowserRouter basename="/colab/mobile">
        <MobileRoutes />
        <PWAUpdatePrompt
          needRefresh={needRefresh}
          onRefresh={handleRefresh}
          onClose={handleClose}
        />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default MobileApp;
