import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@/theme/tokens';
import { MissionCard } from '@/components/MissionCard';
import { repository } from '@/db/repository';
import { mobileApi, type MobileMission } from '@/api/mobile';
import { tokenStorage } from '@/api/tokenStorage';
import type { RootStackParamList } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const MissionsListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [missions, setMissions] = useState<MobileMission[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverChecked, setServerChecked] = useState(false);
  const [offlineSession, setOfflineSession] = useState(false);

  const loadFromCache = useCallback(async () => {
    setMissions(await repository.getMissions());
  }, []);

  const refreshFromServer = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    // Session ouverte par paquet .atlaspack : il n'y a pas de jeton, et il ne
    // doit pas y en avoir. Interroger le serveur ne pouvait que retourner
    // « Token manquant » — une panne affichée en rouge là où l'application
    // fonctionne exactement comme prévu.
    if (!(await tokenStorage.getAccessToken())) {
      setOfflineSession(true);
      setRefreshing(false);
      return;
    }
    setOfflineSession(false);
    try {
      const { missions: fresh } = await mobileApi.getMyMissions();
      await repository.saveMissions(fresh);
      setMissions(fresh);
      setServerChecked(true);
    } catch (error) {
      // Le cache reste visible hors-ligne, mais une liste vide ne doit jamais
      // faire passer une panne réseau pour une absence réelle de missions.
      setLoadError(error instanceof Error ? error.message : 'Erreur réseau inconnue');
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
        ListHeaderComponent={offlineSession ? (
          <Text style={{ color: colors.gray500, marginBottom: 8 }}>
            Mode hors-ligne : missions du paquet .atlaspack. La remontée se fera par export .atlasreturn.
          </Text>
        ) : missions.length > 0 && loadError ? (
          <Text style={{ color: colors.red500, marginBottom: 8 }}>
            Mise à jour impossible : {loadError}. Les missions affichées proviennent du cache.
          </Text>
        ) : null}
        ListEmptyComponent={
          refreshing && !serverChecked ? (
            <View style={{ alignItems: 'center', marginTop: 40, gap: 12 }}>
              <ActivityIndicator color={colors.blue600} />
              <Text style={{ color: colors.gray500 }}>Chargement des missions…</Text>
            </View>
          ) : loadError ? (
            <View style={{ alignItems: 'center', marginTop: 40, gap: 12, paddingHorizontal: 16 }}>
              <Text style={{ textAlign: 'center', color: colors.red500, fontWeight: '600' }}>
                Impossible de charger les missions
              </Text>
              <Text style={{ textAlign: 'center', color: colors.gray500 }}>
                {loadError}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void refreshFromServer()}
                style={{ borderWidth: 1, borderColor: colors.blue600, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <Text style={{ color: colors.blue600, fontWeight: '600' }}>Réessayer</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ textAlign: 'center', color: colors.gray500, marginTop: 40 }}>
              Aucune mission assignée pour le moment
            </Text>
          )
        }
        renderItem={({ item }) => (
          <MissionCard mission={item} onPress={() => navigation.navigate('MissionDetail', { missionId: item.id })} />
        )}
      />
    </View>
  );
};
