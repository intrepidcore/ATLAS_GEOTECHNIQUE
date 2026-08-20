import React, { createContext, useContext, useEffect, useState } from 'react';
import { syncService, type SyncStatus } from '@/services/syncService';

const SyncStatusContext = createContext<SyncStatus | null>(null);

export const SyncStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SyncStatus>({
    state: 'idle',
    pendingCount: 0,
    lastError: null,
    lastSyncAt: null,
  });

  useEffect(() => {
    syncService.start();
    return syncService.subscribe(setStatus);
  }, []);

  return <SyncStatusContext.Provider value={status}>{children}</SyncStatusContext.Provider>;
};

export function useSyncStatus(): SyncStatus {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) throw new Error('useSyncStatus doit être utilisé sous SyncStatusProvider');
  return ctx;
}
