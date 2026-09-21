import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';
import { atlaspackRepository, type AuditEvent } from '@/services/atlaspack/repository';

const EVENT_LABELS: Record<string, string> = {
  login: 'Connexion',
  mission_opened: 'Mission ouverte',
  gps_capture: 'Capture GPS',
  relocate_point: 'Point alternatif',
  sondage_updated: 'Sondage modifié',
  lab_result_updated: 'Résultat labo modifié',
  attachment_added: 'Pièce jointe ajoutée',
  attachment_removed: 'Pièce jointe supprimée',
  validation: 'Validation',
  export: 'Export terrain',
  package_imported: 'Paquet importé',
  backup_created: 'Sauvegarde créée',
};

const EventRow: React.FC<{ event: AuditEvent }> = ({ event }) => (
  <View style={{ backgroundColor: colors.white, borderRadius: radius.lg, padding: 12, marginBottom: 8 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontWeight: '700', color: colors.gray900, fontSize: 13 }}>
        {EVENT_LABELS[event.eventType] ?? event.eventType}
      </Text>
      <Text style={{ color: colors.gray400, fontSize: 11 }}>{new Date(event.occurredAt).toLocaleString('fr-FR')}</Text>
    </View>
    {event.objectType ? (
      <Text style={{ color: colors.gray500, fontSize: 11, marginTop: 2 }}>
        {event.objectType}
        {event.objectId ? ` · ${event.objectId.slice(0, 8)}…` : ''}
      </Text>
    ) : null}
  </View>
);

/**
 * Journal d'audit local — exigence #5. Lecture seule ; les événements sont
 * écrits automatiquement par les services (unlock.ts, syncService.ts,
 * exportOfficial.ts, backup.ts, importPackage.ts) au fil des actions.
 */
export const AuditLogScreen: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void atlaspackRepository.listAuditLog(500).then(setEvents).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray50 }}><ActivityIndicator color={colors.blue600} /></View>;
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.gray50 }}
      contentContainerStyle={{ padding: 16 }}
      data={events}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <EventRow event={item} />}
      ListEmptyComponent={<Text style={{ color: colors.gray500, textAlign: 'center', marginTop: 40 }}>Aucun événement enregistré pour le moment.</Text>}
    />
  );
};
