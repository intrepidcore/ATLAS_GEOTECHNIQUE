import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Beaker } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius } from '@/theme/tokens';
import { StatusBadge } from '@/components/StatusBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { repository } from '@/db/repository';
import { mobileApi, type MobileMissionDetail } from '@/api/mobile';
import type { RootStackParamList } from '@/navigation/routes';
import { atlaspackRepository } from '@/services/atlaspack/repository';
import { atlaspackSession } from '@/services/atlaspack/session';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'MissionDetail'>;

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ color: colors.gray500, fontSize: 13 }}>{label}</Text>
    <Text style={{ color: colors.gray900, fontSize: 13, fontWeight: '500' }}>{value}</Text>
  </View>
);

export const MissionDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const [detail, setDetail] = useState<MobileMissionDetail | null>(null);

  useEffect(() => {
    void mobileApi
      .getMissionDetail(params.missionId)
      .then(setDetail)
      .catch(async () => {
        const cached = await repository.getMission(params.missionId);
        if (cached) {
          setDetail({
            mission: cached,
            supervisor_name: null,
            supervisor_email: null,
            team_members: [],
            recent_sondages: [],
            bbox: null,
          });
        }
      });
    void atlaspackRepository.recordAuditEvent({
      eventType: 'mission_opened',
      operatorUserId: atlaspackSession.get()?.operatorUserId ?? null,
      missionId: params.missionId,
      objectType: 'mission',
      objectId: params.missionId,
      oldValues: null,
      newValues: null,
      metadata: null,
    });
  }, [params.missionId]);

  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.gray50, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.gray500 }}>Chargement…</Text>
      </View>
    );
  }

  const { mission } = detail;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.gray50 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.gray500, fontSize: 12 }}>{mission.code}</Text>
          <StatusBadge status={mission.status} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.gray900 }}>{mission.title}</Text>
      </View>

      <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16 }}>
        <Row label="Maille" value={mission.maille_label ?? 'Non définie'} />
        <Row label="Commune" value={mission.commune ?? '—'} />
        <Row label="Région" value={mission.region ?? '—'} />
        <Row label="Début" value={mission.start_date ?? 'Non planifié'} />
        <Row label="Fin" value={mission.end_date ?? '—'} />
        <Row label="Sondages" value={`${mission.completed_sondages} / ${mission.expected_sondages}`} />
        {detail.supervisor_name ? <Row label="Superviseur" value={detail.supervisor_name} /> : null}
      </View>

      <PrimaryButton label="Ouvrir la carte terrain" onPress={() => navigation.navigate('MissionMap', { missionId: mission.id })} />

      <Pressable
        onPress={() => navigation.navigate('LabResults', { missionId: mission.id })}
        style={{
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.blue600,
          borderRadius: radius.xl,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 9,
        }}
      >
        <Beaker size={19} color={colors.blue600} />
        <Text style={{ color: colors.blue600, fontWeight: '700', fontSize: 15 }}>Saisir les résultats de laboratoire</Text>
      </Pressable>

      <Text style={{ color: colors.gray500, fontSize: 12, textAlign: 'center' }}>
        Un sondage s’enregistre depuis un point prévu sur la carte. Rayon normal : 10 m.
      </Text>
    </ScrollView>
  );
};
