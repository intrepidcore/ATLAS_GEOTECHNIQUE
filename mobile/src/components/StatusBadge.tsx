import React from 'react';
import { View, Text } from 'react-native';
import { colors, statusColor } from '@/theme/tokens';

const LABELS: Record<string, string> = {
  draft: 'Brouillon',
  planned: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
  validated: 'Validé',
  draft_field: 'Brouillon terrain',
  pending_sync: 'En attente',
  synced: 'Synchronisé',
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const bg = statusColor[status] ?? colors.gray400;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: colors.white, fontSize: 12, fontWeight: '600' }}>
        {LABELS[status] ?? status}
      </Text>
    </View>
  );
};
