import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { colors, radius } from '@/theme/tokens';
import { repository, type SondageDraft } from '@/db/repository';
import { StatusBadge } from '@/components/StatusBadge';

export const ActivityScreen: React.FC = () => {
  const [drafts, setDrafts] = useState<SondageDraft[]>([]);

  useEffect(() => {
    void (async () => {
      const missions = await repository.getMissions();
      const all: SondageDraft[] = [];
      for (const m of missions) {
        all.push(...(await repository.getDraftsForMission(m.id)));
      }
      all.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setDrafts(all);
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray50 }}>
      <FlatList
        data={drafts}
        keyExtractor={(d) => d.client_id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: colors.gray500, marginTop: 40 }}>
            Aucune activité terrain enregistrée
          </Text>
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 14, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: colors.gray500 }}>
                {new Date(item.created_at).toLocaleString('fr-FR')}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={{ fontSize: 13, color: colors.gray900 }}>
              Sondage à {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
              {item.depth_m ? ` — ${item.depth_m} m` : ''}
            </Text>
          </View>
        )}
      />
    </View>
  );
};
