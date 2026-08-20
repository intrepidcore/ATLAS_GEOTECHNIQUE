import React from 'react';
import { View, Text } from 'react-native';
import { colors, radius } from '@/theme/tokens';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/context/RoleContext';
import { useSyncStatus } from '@/context/SyncStatusContext';

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ color: colors.gray500, fontSize: 13 }}>{label}</Text>
    <Text style={{ color: colors.gray900, fontSize: 13, fontWeight: '500' }}>{value}</Text>
  </View>
);

export const ProfileScreen: React.FC = () => {
  const { logout } = useAuth();
  const { profile } = useRole();
  const sync = useSyncStatus();

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray50, padding: 16, gap: 16 }}>
      <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16 }}>
        <Row label="Nom" value={profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || '—' : '—'} />
        <Row label="Email" value={profile?.email ?? '—'} />
        <Row
          label="Profil"
          value={profile ? [profile.is_student && 'Étudiant', profile.is_supervisor && 'Superviseur'].filter(Boolean).join(', ') || 'Standard' : '—'}
        />
      </View>

      <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16 }}>
        <Row label="Synchronisation" value={sync.state === 'offline' ? 'Hors-ligne' : sync.state === 'syncing' ? 'En cours' : 'À jour'} />
        <Row label="En attente" value={String(sync.pendingCount)} />
        {sync.lastSyncAt ? <Row label="Dernière sync" value={new Date(sync.lastSyncAt).toLocaleString('fr-FR')} /> : null}
      </View>

      <PrimaryButton label="Se déconnecter" variant="outline" onPress={() => void logout()} />
    </View>
  );
};
