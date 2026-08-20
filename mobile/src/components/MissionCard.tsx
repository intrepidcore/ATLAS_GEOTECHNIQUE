import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors, radius } from '@/theme/tokens';
import { StatusBadge } from './StatusBadge';
import type { MobileMission } from '@/api/mobile';

export const MissionCard: React.FC<{ mission: MobileMission; onPress: () => void }> = ({ mission, onPress }) => (
  <Pressable
    onPress={onPress}
    style={{
      backgroundColor: colors.white,
      borderRadius: radius.xl,
      padding: 16,
      gap: 8,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    }}
  >
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 12, color: colors.gray500 }}>{mission.code}</Text>
      <StatusBadge status={mission.status} />
    </View>
    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.gray900 }} numberOfLines={2}>
      {mission.title}
    </Text>
    {mission.maille_label ? (
      <Text style={{ fontSize: 13, color: colors.gray500 }}>{mission.maille_label}</Text>
    ) : null}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: colors.gray500 }}>
        {mission.completed_sondages}/{mission.expected_sondages} sondages
      </Text>
      <View style={{ width: 80, height: 6, backgroundColor: colors.gray100, borderRadius: radius.full }}>
        <View
          style={{
            width: `${Math.min(100, mission.percent_done)}%`,
            height: 6,
            backgroundColor: colors.blue600,
            borderRadius: radius.full,
          }}
        />
      </View>
    </View>
  </Pressable>
);
