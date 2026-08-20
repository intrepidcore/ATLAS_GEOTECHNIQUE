import React from 'react';
import { View, Text } from 'react-native';
import { useSyncStatus } from '@/context/SyncStatusContext';
import { colors } from '@/theme/tokens';

export const SyncStatusBanner: React.FC = () => {
  const status = useSyncStatus();

  if (status.state === 'idle' && status.pendingCount === 0) return null;

  const { bg, text } =
    status.state === 'offline'
      ? { bg: colors.gray400, text: 'Hors-ligne — les données seront synchronisées au retour du réseau' }
      : status.state === 'syncing'
        ? { bg: colors.blue600, text: 'Synchronisation en cours…' }
        : status.pendingCount > 0
          ? { bg: colors.yellow500, text: `${status.pendingCount} élément(s) en attente de synchronisation` }
          : { bg: colors.green500, text: 'À jour' };

  return (
    <View style={{ backgroundColor: bg, paddingVertical: 6, paddingHorizontal: 12 }}>
      <Text style={{ color: colors.white, fontSize: 12, textAlign: 'center', fontWeight: '500' }}>{text}</Text>
    </View>
  );
};
