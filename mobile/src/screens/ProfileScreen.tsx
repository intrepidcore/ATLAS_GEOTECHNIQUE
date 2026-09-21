import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DatabaseBackup, ListChecks, Share2 } from 'lucide-react-native';
import { colors, radius } from '@/theme/tokens';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/context/RoleContext';
import { useSyncStatus } from '@/context/SyncStatusContext';
import type { RootStackParamList } from '@/navigation/routes';
import { useAtlasPackUnlocked } from '@/hooks/useAtlasPackSession';
import { atlaspackSession } from '@/services/atlaspack/session';

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ color: colors.gray500, fontSize: 13 }}>{label}</Text>
    <Text style={{ color: colors.gray900, fontSize: 13, fontWeight: '500' }}>{value}</Text>
  </View>
);

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logout } = useAuth();
  const { profile } = useRole();
  const sync = useSyncStatus();
  const offlineUnlocked = useAtlasPackUnlocked();

  const onLogout = async () => {
    if (offlineUnlocked) {
      atlaspackSession.lock();
      return;
    }
    await logout();
  };

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

      <Pressable onPress={() => navigation.navigate('ExportData')} style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.gray300, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: radius.lg, backgroundColor: colors.blue50, alignItems: 'center', justifyContent: 'center' }}><Share2 size={20} color={colors.blue600} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.gray900, fontWeight: '700' }}>Exporter les données</Text>
          <Text style={{ color: colors.gray500, fontSize: 12, marginTop: 3 }}>Créer un fichier JSON ou CSV et l’envoyer autrement</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('AuditLog')} style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.gray300, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: radius.lg, backgroundColor: colors.blue50, alignItems: 'center', justifyContent: 'center' }}><ListChecks size={20} color={colors.blue600} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.gray900, fontWeight: '700' }}>Journal d’audit</Text>
          <Text style={{ color: colors.gray500, fontSize: 12, marginTop: 3 }}>Historique technique des actions effectuées sur cet appareil</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Backup')} style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.gray300, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: radius.lg, backgroundColor: colors.blue50, alignItems: 'center', justifyContent: 'center' }}><DatabaseBackup size={20} color={colors.blue600} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.gray900, fontWeight: '700' }}>Sauvegarde locale</Text>
          <Text style={{ color: colors.gray500, fontSize: 12, marginTop: 3 }}>Créer ou restaurer une sauvegarde indépendante de l’application</Text>
        </View>
      </Pressable>

      <PrimaryButton label={offlineUnlocked ? 'Verrouiller la session' : 'Se déconnecter'} variant="outline" onPress={() => void onLogout()} />
    </View>
  );
};
