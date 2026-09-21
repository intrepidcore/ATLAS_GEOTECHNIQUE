import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, Database, FileJson, FileSpreadsheet, MapPinned, Share2, ShieldCheck } from 'lucide-react-native';
import { repository, type ExportDataSelection } from '@/db/repository';
import type { MobileMission } from '@/api/mobile';
import { exportAndShareFieldData } from '@/services/exportService';
import type { ExportFormat } from '@/services/exportFormat';
import { colors, radius } from '@/theme/tokens';
import { buildAndShareOfficialExport } from '@/services/atlaspack/exportOfficial';
import { useAtlasPackUnlocked } from '@/hooks/useAtlasPackSession';

const Toggle: React.FC<{ checked: boolean; label: string; detail?: string; onPress: () => void }> = ({ checked, label, detail, onPress }) => (
  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: checked ? colors.blue600 : colors.gray300, backgroundColor: checked ? colors.blue600 : colors.white, alignItems: 'center', justifyContent: 'center' }}>
      {checked ? <Check size={15} color={colors.white} strokeWidth={3} /> : null}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.gray900, fontWeight: '600', fontSize: 14 }}>{label}</Text>
      {detail ? <Text style={{ color: colors.gray500, fontSize: 11, marginTop: 2 }}>{detail}</Text> : null}
    </View>
  </Pressable>
);

export const ExportDataScreen: React.FC = () => {
  const [missions, setMissions] = useState<MobileMission[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>('json');
  const [includePlannedPoints, setIncludePlannedPoints] = useState(true);
  const [includeSondages, setIncludeSondages] = useState(true);
  const [includeFieldLogs, setIncludeFieldLogs] = useState(true);
  const [includePendingQueue, setIncludePendingQueue] = useState(true);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [officialExporting, setOfficialExporting] = useState(false);
  const isOfflineUnlocked = useAtlasPackUnlocked();

  useEffect(() => {
    void repository.getMissions().then((items) => {
      setMissions(items);
      setSelectedIds(items.map((item) => item.id));
    }).finally(() => setLoading(false));
  }, []);

  const allSelected = missions.length > 0 && selectedIds.length === missions.length;
  const selectedLabel = useMemo(() => `${selectedIds.length} mission${selectedIds.length > 1 ? 's' : ''} sélectionnée${selectedIds.length > 1 ? 's' : ''}`, [selectedIds.length]);
  const toggleMission = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const runExport = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Sélection requise', 'Sélectionnez au moins une mission à exporter.');
      return;
    }
    const selection: ExportDataSelection = {
      missionIds: selectedIds,
      includePlannedPoints,
      includeSondages,
      includeFieldLogs,
      includePendingQueue,
    };
    setExporting(true);
    try {
      const result = await exportAndShareFieldData(selection, format);
      Alert.alert('Export préparé', `${result.recordCount} enregistrement(s) ont été préparés. Le fichier peut être envoyé par l'application de votre choix.`);
    } catch (error) {
      Alert.alert('Export impossible', error instanceof Error ? error.message : 'Une erreur est survenue pendant la création du fichier.');
    } finally {
      setExporting(false);
    }
  };

  const runOfficialExport = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Sélection requise', 'Sélectionnez au moins une mission à exporter.');
      return;
    }
    setOfficialExporting(true);
    try {
      const result = await buildAndShareOfficialExport(selectedIds);
      Alert.alert(
        'Export officiel prêt',
        `${result.sondagesCount} sondage(s) sur ${result.missionsCount} mission(s).\nSHA-256 : ${result.sha256.slice(0, 16)}…\n\nCe fichier .atlasreturn est signé et vérifiable au bureau.`,
      );
    } catch (error) {
      Alert.alert('Export officiel impossible', error instanceof Error ? error.message : 'Une erreur est survenue.');
    } finally {
      setOfficialExporting(false);
    }
  };

  return <ScrollView style={{ flex: 1, backgroundColor: colors.gray50 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
    {isOfflineUnlocked && (
      <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16, borderWidth: 1.5, borderColor: colors.blue600 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={20} color={colors.blue600} />
          <Text style={{ color: colors.gray900, fontWeight: '700', fontSize: 16 }}>Export officiel signé (.atlasreturn)</Text>
        </View>
        <Text style={{ color: colors.gray500, fontSize: 12, marginTop: 6 }}>
          Manifeste + empreintes SHA-256 + signature HMAC, vérifié automatiquement au réimport au bureau.
          Inclut sondages, résultats de laboratoire, pièces jointes et journal d’audit des missions sélectionnées.
        </Text>
        <Pressable
          disabled={officialExporting || selectedIds.length === 0}
          onPress={() => void runOfficialExport()}
          style={{ marginTop: 12, backgroundColor: colors.blue600, opacity: officialExporting || selectedIds.length === 0 ? 0.5 : 1, borderRadius: radius.xl, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {officialExporting ? <ActivityIndicator color={colors.white} /> : <ShieldCheck size={17} color={colors.white} />}
          <Text style={{ color: colors.white, fontWeight: '700', fontSize: 14 }}>{officialExporting ? 'Préparation…' : 'Créer et envoyer l\'export officiel'}</Text>
        </Pressable>
      </View>
    )}

    <View style={{ backgroundColor: colors.blue50, borderRadius: radius.xl, padding: 14, flexDirection: 'row', gap: 12 }}>
      <Share2 size={22} color={colors.blue600} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.gray900, fontWeight: '700' }}>Transfert manuel rapide (non signé)</Text>
        <Text style={{ color: colors.gray500, fontSize: 12, marginTop: 4 }}>Crée un fichier à partir des données présentes sur ce téléphone. Vous pourrez l’envoyer par messagerie, e-mail, Bluetooth ou le copier vers un autre support.</Text>
      </View>
    </View>

    <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16 }}>
      <Text style={{ color: colors.gray900, fontWeight: '700', fontSize: 16 }}>Format du fichier</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Pressable onPress={() => setFormat('json')} style={{ flex: 1, borderWidth: 1.5, borderColor: format === 'json' ? colors.blue600 : colors.gray300, backgroundColor: format === 'json' ? colors.blue50 : colors.white, borderRadius: radius.xl, padding: 13, alignItems: 'center', gap: 5 }}>
          <FileJson size={22} color={format === 'json' ? colors.blue600 : colors.gray500} />
          <Text style={{ color: colors.gray900, fontWeight: '700' }}>JSON</Text>
          <Text style={{ color: colors.gray500, fontSize: 10, textAlign: 'center' }}>Complet et réimportable</Text>
        </Pressable>
        <Pressable onPress={() => setFormat('csv')} style={{ flex: 1, borderWidth: 1.5, borderColor: format === 'csv' ? colors.blue600 : colors.gray300, backgroundColor: format === 'csv' ? colors.blue50 : colors.white, borderRadius: radius.xl, padding: 13, alignItems: 'center', gap: 5 }}>
          <FileSpreadsheet size={22} color={format === 'csv' ? colors.blue600 : colors.gray500} />
          <Text style={{ color: colors.gray900, fontWeight: '700' }}>CSV</Text>
          <Text style={{ color: colors.gray500, fontSize: 10, textAlign: 'center' }}>Lisible dans un tableur</Text>
        </Pressable>
      </View>
    </View>

    <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: colors.gray900, fontWeight: '700', fontSize: 16 }}>Missions</Text>
          <Text style={{ color: colors.gray500, fontSize: 11, marginTop: 2 }}>{selectedLabel}</Text>
        </View>
        <Pressable onPress={() => setSelectedIds(allSelected ? [] : missions.map((item) => item.id))} style={{ padding: 8 }}>
          <Text style={{ color: colors.blue600, fontWeight: '600', fontSize: 12 }}>{allSelected ? 'Tout retirer' : 'Tout sélectionner'}</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={colors.blue600} style={{ marginTop: 20 }} /> : missions.length === 0 ? <Text style={{ color: colors.gray500, marginTop: 14 }}>Aucune mission n’est disponible dans le cache local.</Text> : missions.map((mission) => (
        <Toggle key={mission.id} checked={selectedIds.includes(mission.id)} onPress={() => toggleMission(mission.id)} label={mission.title} detail={`${mission.code} · ${mission.commune || mission.region || 'Localisation non renseignée'}`} />
      ))}
    </View>

    <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}><Database size={18} color={colors.blue600} /><Text style={{ color: colors.gray900, fontWeight: '700', fontSize: 16 }}>Données à inclure</Text></View>
      <Toggle checked={includePlannedPoints} onPress={() => setIncludePlannedPoints((value) => !value)} label="Points prévisionnels" detail="Coordonnées, numéro et état de confirmation" />
      <Toggle checked={includeSondages} onPress={() => setIncludeSondages((value) => !value)} label="Sondages terrain" detail="Coordonnées capturées, profondeur, notes et synchronisation" />
      <Toggle checked={includeFieldLogs} onPress={() => setIncludeFieldLogs((value) => !value)} label="Journal terrain" detail="Activités enregistrées localement" />
      <Toggle checked={includePendingQueue} onPress={() => setIncludePendingQueue((value) => !value)} label="File d'attente" detail="Données non encore transmises à l'API" />
    </View>

    <Pressable disabled={exporting || selectedIds.length === 0} onPress={() => void runExport()} style={{ backgroundColor: colors.blue600, opacity: exporting || selectedIds.length === 0 ? 0.5 : 1, borderRadius: radius.xl, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
      {exporting ? <ActivityIndicator color={colors.white} /> : <MapPinned size={19} color={colors.white} />}
      <Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>{exporting ? 'Préparation du fichier…' : 'Exporter et choisir un moyen d’envoi'}</Text>
    </Pressable>
  </ScrollView>;
};
