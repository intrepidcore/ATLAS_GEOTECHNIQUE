import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ArchiveRestore, DatabaseBackup, HardDriveDownload } from 'lucide-react-native';
import { colors, radius } from '@/theme/tokens';
import { PrimaryButton } from '@/components/PrimaryButton';
import { createBackup, formatBytes, listLocalBackups, restoreBackup, AtlasPackBackupError } from '@/services/atlaspack/backup';

interface BackupItem {
  id: string;
  createdAt: string;
  fileUri: string;
  sizeBytes: number;
  sha256: string;
}

/**
 * Sauvegarde locale exportable (exigence #8) : indépendante de la présence
 * de l'application (fichier JSON autonome, hashé), restaurable après
 * réinstallation ou changement de téléphone.
 */
export const BackupScreen: React.FC = () => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const refresh = () => listLocalBackups().then(setBackups).finally(() => setLoading(false));
  useEffect(() => { void refresh(); }, []);

  const onCreate = async () => {
    setWorking(true);
    try {
      const result = await createBackup();
      Alert.alert('Sauvegarde créée', `${formatBytes(result.sizeBytes)} · SHA-256 ${result.sha256.slice(0, 16)}…`);
      await refresh();
    } catch (e) {
      Alert.alert('Sauvegarde impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  };

  const onRestore = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    setWorking(true);
    try {
      const result = await restoreBackup(picked.assets[0].uri);
      Alert.alert('Restauration terminée', `${result.rowsRestored} enregistrement(s) restauré(s) dans ${result.tablesRestored} table(s).`);
    } catch (e) {
      const message = e instanceof AtlasPackBackupError ? e.message : `Erreur inattendue : ${String(e)}`;
      Alert.alert('Restauration refusée', message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray50, padding: 16, gap: 16 }}>
      <View style={{ backgroundColor: colors.blue50, borderRadius: radius.xl, padding: 14, flexDirection: 'row', gap: 12 }}>
        <DatabaseBackup size={22} color={colors.blue600} />
        <Text style={{ flex: 1, color: colors.gray900, fontSize: 12 }}>
          Sauvegarde indépendante de l’application : missions, sondages, résultats de laboratoire, pièces jointes,
          journal d’audit. À copier régulièrement vers un support externe pendant la mission.
        </Text>
      </View>

      <PrimaryButton label="Créer une sauvegarde maintenant" onPress={() => void onCreate()} loading={working} />
      <Pressable
        disabled={working}
        onPress={() => void onRestore()}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.gray300, borderRadius: radius.xl, paddingVertical: 13 }}
      >
        <ArchiveRestore size={18} color={colors.gray700} />
        <Text style={{ color: colors.gray700, fontWeight: '600' }}>Restaurer depuis un fichier de sauvegarde</Text>
      </Pressable>

      <Text style={{ color: colors.gray900, fontWeight: '700', marginTop: 8 }}>Sauvegardes locales</Text>
      {loading ? <ActivityIndicator color={colors.blue600} /> : (
        <FlatList
          data={backups}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={{ color: colors.gray500 }}>Aucune sauvegarde locale pour le moment.</Text>}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.white, borderRadius: radius.lg, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <HardDriveDownload size={18} color={colors.gray500} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.gray900, fontWeight: '600', fontSize: 13 }}>{new Date(item.createdAt).toLocaleString('fr-FR')}</Text>
                <Text style={{ color: colors.gray500, fontSize: 11 }}>{formatBytes(item.sizeBytes)} · {item.sha256.slice(0, 12)}…</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
};
