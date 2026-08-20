import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@/theme/tokens';
import { MissionCard } from '@/components/MissionCard';
import { repository } from '@/db/repository';
import { mobileApi, type MobileMission } from '@/api/mobile';
import type { RootStackParamList } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const MissionsListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [missions, setMissions] = useState<MobileMission[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadFromCache = useCallback(async () => {
    setMissions(await repository.getMissions());
  }, []);

  const refreshFromServer = useCallback(async () => {
    setRefreshing(true);
    try {
      const { missions: fresh } = await mobileApi.getMyMissions();
      await repository.saveMissions(fresh);
      setMissions(fresh);
    } catch {
      // Hors-ligne ou erreur réseau : on garde le cache local affiché (ADR-MOBILE-002).
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFromCache().then(refreshFromServer);
  }, [loadFromCache, refreshFromServer]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray50 }}>
      <FlatList
        data={missions}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFromServer} />}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: colors.gray500, marginTop: 40 }}>
            Aucune mission assignée pour le moment
          </Text>
        }
        renderItem={({ item }) => (
          <MissionCard mission={item} onPress={() => navigation.navigate('MissionDetail', { missionId: item.id })} />
        )}
      />
    </View>
  );
};
