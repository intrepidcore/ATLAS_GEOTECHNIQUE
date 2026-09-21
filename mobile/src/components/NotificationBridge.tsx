import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/notificationService';

export const NotificationBridge: React.FC = () => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    const refresh = () => {
      void notificationService.registerForPush().catch(() => undefined);
      void notificationService.pollServerAlerts().catch(() => undefined);
    };
    refresh();
    const timer = setInterval(() => void notificationService.pollServerAlerts().catch(() => undefined), 30_000);
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); appState.remove(); };
  }, [isAuthenticated]);

  return null;
};
