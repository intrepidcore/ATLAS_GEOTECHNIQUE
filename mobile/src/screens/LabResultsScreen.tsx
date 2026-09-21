import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  Beaker,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  ClipboardPenLine,
  Download,
  Plus,
  Save,
} from 'lucide-react-native';
import {
  mobileApi,
  type MobileLabResult,
  type MobileLabResultInput,
  type MobileMissionDetail,
} from '@/api/mobile';
import { repository as missionRepository } from '@/db/repository';
import { atlaspackRepository, newUuid, type LabResultDraft } from '@/services/atlaspack/repository';
import { exportLabResultsCsv, exportLabResultsXlsx } from '@/services/export/labExports';
import { colors, radius } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/routes';

type Rt = RouteProp<RootStackParamList, 'LabResults'>;
type TestId = 'atterberg' | 'vbs' | 'gonflement' | 'proctor' | 'cbr' | 'penetrometre' | 'pressiometre' | 'granulometrie';

const TESTS: { id: TestId; label: string }[] = [
  { id: 'atterberg', label: 'Atterberg' },
  { id: 'vbs', label: 'VBS' },
  { id: 'gonflement', label: 'Gonflement EG' },
  { id: 'proctor', label: 'Proctor' },
  { id: 'cbr', label: 'CBR' },
  { id: 'penetrometre', label: 'Pénétromètre' },
  { id: 'pressiometre', label: 'Pressiomètre' },
  { id: 'granulometrie', label: 'Granulométrie' },
];

type Values = Record<string, string>;

function decimal(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  placeholder?: string;
}> = ({ label, value, onChange, unit, placeholder }) => (
  <View style={{ gap: 5, flex: 1, minWidth: 130 }}>
    <Text style={{ color: colors.gray700, fontSize: 12, fontWeight: '600' }}>
      {label}{unit ? ` (${unit})` : ''}
    </Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.gray400}
      keyboardType="decimal-pad"
      style={{
        borderWidth: 1,
        borderColor: colors.gray300,
        borderRadius: radius.lg,
        backgroundColor: colors.white,
        color: colors.gray900,
        paddingHorizontal: 12,
        paddingVertical: 11,
        fontSize: 14,
      }}
    />
  </View>
);

function validateForm(values: Values, enabled: Set<TestId>, complete: boolean): string | null {
  const top = decimal(values.depthTop);
  const bottom = decimal(values.depthBottom);
  if (!values.sampleCode.trim()) return 'Le code échantillon est obligatoire.';
  if (top === undefined || bottom === undefined || top < 0 || bottom <= top) {
    return 'La profondeur basse doit être supérieure à la profondeur haute.';
  }
  if (complete && enabled.size === 0) return 'Sélectionnez et remplissez au moins un type d’essai.';
  const wl = decimal(values.wl);
  const wp = decimal(values.wp);
  if (wl !== undefined && (wl < 20 || wl > 120)) return 'WL doit être comprise entre 20 et 120 %.';
  if (wp !== undefined && (wp < 10 || wp > 60)) return 'WP doit être comprise entre 10 et 60 %.';
  if (wl !== undefined && wp !== undefined && wl < wp) return 'WL doit être supérieure ou égale à WP.';
  return null;
}

function buildInput(
  sondageId: string,
  values: Values,
  enabled: Set<TestId>,
  status: 'draft' | 'complete',
): MobileLabResultInput {
  const tests: Record<string, unknown> = {};
  if (enabled.has('atterberg')) tests.atterberg = { wl_pct: decimal(values.wl), wp_pct: decimal(values.wp), ip_rapport: decimal(values.ipReport), norme: 'NF P 94-051' };
  if (enabled.has('vbs')) tests.vbs = { vbs_g100g: decimal(values.vbs) };
  if (enabled.has('gonflement')) tests.gonflement = { eg_pct: decimal(values.eg), eg_qualitatif: values.egClass.trim() || undefined };
  if (enabled.has('proctor')) tests.proctor = { gamma_d_max_knm3: decimal(values.proctorDensity), w_opt_pct: decimal(values.proctorWater) };
  if (enabled.has('cbr')) tests.cbr = { cbr_pct: decimal(values.cbr) };
  if (enabled.has('penetrometre')) tests.penetrometre = { rd_mpa: decimal(values.rd) };
  if (enabled.has('pressiometre')) tests.pressiometre = { em_mpa: decimal(values.em), pl_mpa: decimal(values.pl) };
  if (enabled.has('granulometrie')) tests.granulometrie = {
    points: [
      { sieve_mm: 2, passant_pct: decimal(values.pass2mm) },
      { sieve_mm: 0.08, passant_pct: decimal(values.pass80um) },
    ].filter((point) => point.passant_pct !== undefined),
  };
  return {
    sondage_id: sondageId,
    sample_code: values.sampleCode.trim(),
    depth_top_m: decimal(values.depthTop) ?? 0,
    depth_bottom_m: decimal(values.depthBottom) ?? 0,
    sample: {
      description: values.description.trim() || undefined,
      condition: values.condition.trim() || undefined,
    },
    tests,
    status,
  };
}

const initialValues = (): Values => ({
  sampleCode: '', depthTop: '0', depthBottom: '', description: '', condition: '',
  wl: '', wp: '', ipReport: '', vbs: '', eg: '', egClass: '',
  proctorDensity: '', proctorWater: '', cbr: '', rd: '', em: '', pl: '',
  pass2mm: '', pass80um: '',
});

export const LabResultsScreen: React.FC = () => {
  const { params } = useRoute<Rt>();
  const [detail, setDetail] = useState<MobileMissionDetail | null>(null);
  const [items, setItems] = useState<MobileLabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [sondageId, setSondageId] = useState('');
  const [values, setValues] = useState<Values>(initialValues);
  const [enabled, setEnabled] = useState<Set<TestId>>(new Set(['atterberg']));
  const [expanded, setExpanded] = useState<TestId | null>('atterberg');
  const [offline, setOffline] = useState(false);
  const [localItems, setLocalItems] = useState<LabResultDraft[]>([]);
  const [sondageOptions, setSondageOptions] = useState<{ id: string; label: string }[]>([]);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // 1) Le local d'abord, toujours : la saisie de laboratoire doit
    //    fonctionner sans réseau, et c'est la base locale qui alimente
    //    l'export .atlasreturn.
    let options: { id: string; label: string }[] = [];
    try {
      const [drafts, locals] = await Promise.all([
        missionRepository.getDraftsForMission(params.missionId),
        atlaspackRepository.listLabResultsForMission(params.missionId),
      ]);
      setLocalItems(locals);
      options = drafts.map((d) => ({
        id: d.server_id ?? d.client_id,
        label: d.point_name ?? `Sondage ${d.client_id.slice(0, 8)}`,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Lecture locale impossible');
    }
    // 2) Le serveur ensuite, en complément. Son indisponibilité n'est PAS une
    //    erreur : elle fait basculer l'écran en mode hors-ligne, sans bloquer.
    try {
      const [missionDetail, results] = await Promise.all([
        mobileApi.getMissionDetail(params.missionId),
        mobileApi.getLabResults(params.missionId),
      ]);
      setDetail(missionDetail);
      setItems(results.items);
      setOffline(false);
      const remote = missionDetail.recent_sondages.map((sd) => ({
        id: sd.id,
        label: sd.code_sondage ?? 'Sondage sans code',
      }));
      const seen = new Set(remote.map((o) => o.id));
      options = [...remote, ...options.filter((o) => !seen.has(o.id))];
    } catch {
      setOffline(true);
    }
    setSondageOptions(options);
    setSondageId((current) => current || options[0]?.id || '');
    setLoading(false);
  }, [params.missionId]);

  useEffect(() => { void load(); }, [params.missionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCode = useMemo(
    () => sondageOptions.find((item) => item.id === sondageId)?.label ?? 'Sondage',
    [sondageOptions, sondageId],
  );
  const ip = useMemo(() => {
    const wl = decimal(values.wl); const wp = decimal(values.wp);
    return wl !== undefined && wp !== undefined ? Math.round((wl - wp) * 10) / 10 : null;
  }, [values.wl, values.wp]);

  /**
   * Exports tableur des fiches saisies. Ils lisent la base LOCALE : un
   * opérateur hors réseau doit pouvoir sortir ses données, et ce sont les
   * mêmes fiches que celles embarquées dans le .atlasreturn.
   */
  const runExport = async (kind: 'csv' | 'xlsx') => {
    if (!localItems.length) {
      return Alert.alert('Aucune fiche', 'Saisissez au moins une fiche d’essais avant d’exporter.');
    }
    setExporting(true);
    try {
      const res = kind === 'csv'
        ? await exportLabResultsCsv(params.missionId)
        : await exportLabResultsXlsx(params.missionId);
      Alert.alert('Export terminé', `${res.rowCount} fiche(s) exportée(s) — ${res.fileName}`);
    } catch (caught) {
      Alert.alert('Export impossible', caught instanceof Error ? caught.message : 'Écriture du fichier impossible.');
    } finally {
      setExporting(false);
    }
  };

  /**
   * Fusion des fiches locales (saisies sur l'appareil, en attente d'export)
   * et de celles déjà connues du serveur. Déduplication par code
   * d'échantillon : une fiche synchronisée existe des deux côtés et ne doit
   * apparaître qu'une fois — la version serveur fait foi.
   */
  const mergedItems = useMemo(() => {
    const remote = items.map((it) => ({
      key: `r-${it.id}`,
      sampleCode: it.sample_code,
      status: it.status,
      sondageLabel: it.sondage_code ?? 'Sondage',
      depthTop: it.depth_top_m,
      depthBottom: it.depth_bottom_m,
      horizon: it.horizon as string | undefined,
      pendingExport: false,
    }));
    const known = new Set(remote.map((r) => r.sampleCode));
    const local = localItems
      .filter((lr) => !known.has(lr.sampleCode))
      .map((lr) => ({
        key: `l-${lr.id}`,
        sampleCode: lr.sampleCode,
        status: lr.status,
        sondageLabel: sondageOptions.find((o) => o.id === lr.sondageId)?.label ?? 'Sondage',
        depthTop: lr.depthTopM,
        depthBottom: lr.depthBottomM,
        horizon: undefined as string | undefined,
        pendingExport: true,
      }));
    return [...local, ...remote];
  }, [items, localItems, sondageOptions]);

  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const toggleTest = (id: TestId) => {
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setExpanded((current) => current === id ? null : id);
  };

  const save = async (status: 'draft' | 'complete') => {
    if (!sondageId) return Alert.alert('Sondage requis', 'Enregistrez d’abord un sondage terrain pour lui rattacher les résultats.');
    const validation = validateForm(values, enabled, status === 'complete');
    if (validation) return Alert.alert('Fiche incomplète', validation);
    setSaving(true);
    const input = buildInput(sondageId, values, enabled, status);
    try {
      // Écriture locale systématique — c'est elle qui alimente l'export
      // .atlasreturn. L'envoi au serveur n'est qu'un miroir opportuniste :
      // son échec ne doit jamais faire perdre une saisie de terrain.
      const draft: LabResultDraft = {
        id: newUuid(),
        missionId: params.missionId,
        sondageId,
        sampleCode: input.sample_code,
        depthTopM: input.depth_top_m,
        depthBottomM: input.depth_bottom_m,
        sample: input.sample,
        tests: input.tests,
        status,
        createdAt: new Date().toISOString(),
      };
      await atlaspackRepository.saveLabResultDraft(draft);
      setLocalItems((current) => [draft, ...current]);

      let synced = false;
      try {
        const created = await mobileApi.createLabResult(params.missionId, input);
        setItems((current) => [created, ...current]);
        setOffline(false);
        synced = true;
      } catch {
        setOffline(true);
      }

      setValues(initialValues());
      setEnabled(new Set(['atterberg']));
      setExpanded('atterberg');
      setShowForm(false);
      Alert.alert(
        'Résultat enregistré',
        synced
          ? (status === 'complete' ? 'La fiche d’essais est validée et synchronisée.' : 'Le brouillon est enregistré et synchronisé.')
          : 'Enregistré sur l’appareil. La fiche partira au bureau dans le prochain export .atlasreturn.',
      );
    } catch (caught) {
      Alert.alert('Enregistrement impossible', caught instanceof Error ? caught.message : 'Écriture locale impossible.');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray50 }}><ActivityIndicator color={colors.blue600} /><Text style={{ marginTop: 10, color: colors.gray500 }}>Chargement des fiches d’essais…</Text></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.gray50 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={{ backgroundColor: colors.blue50, borderRadius: radius.xl, padding: 14, flexDirection: 'row', gap: 12 }}>
        <Beaker size={23} color={colors.blue600} />
        <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.gray900, fontWeight: '700' }}>Résultats des essais en laboratoire</Text><Text style={{ color: colors.gray500, fontSize: 12 }}>Une fiche correspond à un échantillon prélevé dans un sondage.</Text></View>
      </View>

      {error ? <View style={{ backgroundColor: colors.red50, borderRadius: radius.lg, padding: 12 }}><Text style={{ color: colors.red500 }}>{error}</Text><Pressable onPress={() => void load()}><Text style={{ marginTop: 8, color: colors.blue600, fontWeight: '600' }}>Réessayer</Text></Pressable></View> : null}

      {offline ? <View style={{ backgroundColor: colors.yellow100, borderRadius: radius.lg, padding: 12 }}><Text style={{ color: colors.gray900, fontWeight: '700' }}>Mode hors-ligne</Text><Text style={{ color: colors.gray700, marginTop: 3, fontSize: 12 }}>La saisie est enregistrée sur l’appareil et partira au bureau dans le prochain export .atlasreturn.</Text></View> : null}

      {!sondageOptions.length ? <View style={{ backgroundColor: colors.yellow100, borderRadius: radius.xl, padding: 14 }}><Text style={{ color: colors.gray900, fontWeight: '700' }}>Aucun sondage enregistré</Text><Text style={{ color: colors.gray700, marginTop: 4, fontSize: 13 }}>Enregistrez d’abord le point terrain sur cet appareil. La fiche de laboratoire pourra ensuite y être rattachée, même sans réseau.</Text></View> : null}

      {showForm && sondageOptions.length ? <>
        <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 14, gap: 12 }}>
          <Text style={{ color: colors.gray900, fontWeight: '700', fontSize: 16 }}>Échantillon</Text>
          <Text style={{ color: colors.gray700, fontSize: 12, fontWeight: '600' }}>Sondage associé</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {sondageOptions.map((sondage) => <Pressable key={sondage.id} onPress={() => setSondageId(sondage.id)} style={{ borderWidth: 1, borderColor: sondageId === sondage.id ? colors.blue600 : colors.gray300, backgroundColor: sondageId === sondage.id ? colors.blue50 : colors.white, borderRadius: radius.full, paddingHorizontal: 13, paddingVertical: 9 }}><Text style={{ color: sondageId === sondage.id ? colors.blue600 : colors.gray700, fontWeight: '600' }}>{sondage.label}</Text></Pressable>)}
          </ScrollView>
          <Text style={{ color: colors.gray700, fontSize: 12, fontWeight: '600' }}>Code échantillon</Text>
          <TextInput value={values.sampleCode} onChangeText={(value) => setValue('sampleCode', value)} placeholder={`${selectedCode}-ECH-01`} placeholderTextColor={colors.gray400} autoCapitalize="characters" style={{ borderWidth: 1, borderColor: colors.gray300, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 11, color: colors.gray900 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><Field label="Profondeur haute" unit="m" value={values.depthTop} onChange={(value) => setValue('depthTop', value)} /><Field label="Profondeur basse" unit="m" value={values.depthBottom} onChange={(value) => setValue('depthBottom', value)} /></View>
          <Text style={{ color: colors.gray700, fontSize: 12, fontWeight: '600' }}>Description / nature du sol</Text>
          <TextInput value={values.description} onChangeText={(value) => setValue('description', value)} placeholder="Argile, limon, sable…" placeholderTextColor={colors.gray400} multiline style={{ borderWidth: 1, borderColor: colors.gray300, borderRadius: radius.lg, padding: 12, color: colors.gray900, minHeight: 72, textAlignVertical: 'top' }} />
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.gray900, fontWeight: '700', fontSize: 16 }}>Essais réalisés</Text>
          {TESTS.map((test) => {
            const active = enabled.has(test.id); const open = expanded === test.id && active;
            return <View key={test.id} style={{ backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden', borderWidth: active ? 1 : 0, borderColor: colors.blue600 }}>
              <Pressable onPress={() => toggleTest(test.id)} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: active ? colors.blue600 : colors.gray100, alignItems: 'center', justifyContent: 'center' }}>{active ? <CircleCheck size={16} color={colors.white} /> : <Plus size={15} color={colors.gray500} />}</View><Text style={{ flex: 1, color: colors.gray900, fontWeight: '700' }}>{test.label}</Text>{open ? <ChevronUp size={18} color={colors.gray500} /> : <ChevronDown size={18} color={colors.gray500} />}</Pressable>
              {open ? <View style={{ padding: 14, paddingTop: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {test.id === 'atterberg' ? <><Field label="WL" unit="%" value={values.wl} onChange={(v) => setValue('wl', v)} /><Field label="WP" unit="%" value={values.wp} onChange={(v) => setValue('wp', v)} /><View style={{ flex: 1, minWidth: 130, backgroundColor: colors.green50, borderRadius: radius.lg, padding: 11 }}><Text style={{ color: colors.gray500, fontSize: 12 }}>IP calculé</Text><Text style={{ color: colors.gray900, fontSize: 17, fontWeight: '700' }}>{ip ?? '—'} %</Text></View><Field label="IP du rapport" unit="%" value={values.ipReport} onChange={(v) => setValue('ipReport', v)} /></> : null}
                {test.id === 'vbs' ? <Field label="Valeur au bleu" unit="g/100 g" value={values.vbs} onChange={(v) => setValue('vbs', v)} /> : null}
                {test.id === 'gonflement' ? <><Field label="Potentiel EG" unit="%" value={values.eg} onChange={(v) => setValue('eg', v)} /><View style={{ gap: 5, flex: 1, minWidth: 130 }}><Text style={{ color: colors.gray700, fontSize: 12, fontWeight: '600' }}>Qualification</Text><TextInput value={values.egClass} onChangeText={(v) => setValue('egClass', v)} placeholder="Faible, moyen, élevé" placeholderTextColor={colors.gray400} style={{ borderWidth: 1, borderColor: colors.gray300, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 11, color: colors.gray900 }} /></View></> : null}
                {test.id === 'proctor' ? <><Field label="Densité sèche max" unit="kN/m³" value={values.proctorDensity} onChange={(v) => setValue('proctorDensity', v)} /><Field label="Teneur en eau optimale" unit="%" value={values.proctorWater} onChange={(v) => setValue('proctorWater', v)} /></> : null}
                {test.id === 'cbr' ? <Field label="Indice CBR" unit="%" value={values.cbr} onChange={(v) => setValue('cbr', v)} /> : null}
                {test.id === 'penetrometre' ? <Field label="Résistance dynamique Rd" unit="MPa" value={values.rd} onChange={(v) => setValue('rd', v)} /> : null}
                {test.id === 'pressiometre' ? <><Field label="Module Em" unit="MPa" value={values.em} onChange={(v) => setValue('em', v)} /><Field label="Pression limite Pl" unit="MPa" value={values.pl} onChange={(v) => setValue('pl', v)} /></> : null}
                {test.id === 'granulometrie' ? <><Field label="Passant à 2 mm" unit="%" value={values.pass2mm} onChange={(v) => setValue('pass2mm', v)} /><Field label="Passant à 0,08 mm" unit="%" value={values.pass80um} onChange={(v) => setValue('pass80um', v)} /></> : null}
              </View> : null}
            </View>;
          })}
        </View>

        <Pressable disabled={saving} onPress={() => void save('complete')} style={{ backgroundColor: colors.blue600, borderRadius: radius.xl, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: saving ? 0.6 : 1 }}><Save size={18} color={colors.white} /><Text style={{ color: colors.white, fontWeight: '700' }}>{saving ? 'Enregistrement…' : 'Valider la fiche d’essais'}</Text></Pressable>
        <Pressable disabled={saving} onPress={() => void save('draft')} style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray300, borderRadius: radius.xl, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}><ClipboardPenLine size={18} color={colors.gray700} /><Text style={{ color: colors.gray700, fontWeight: '700' }}>Enregistrer comme brouillon</Text></Pressable>
      </> : null}

      {!showForm && sondageOptions.length ? <Pressable onPress={() => setShowForm(true)} style={{ backgroundColor: colors.blue600, borderRadius: radius.xl, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}><Plus size={18} color={colors.white} /><Text style={{ color: colors.white, fontWeight: '700' }}>Nouvelle fiche d’essais</Text></Pressable> : null}

      {localItems.length ? <View style={{ flexDirection: 'row', gap: 10 }}><Pressable disabled={exporting} onPress={() => void runExport('csv')} style={{ flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray300, borderRadius: radius.xl, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: exporting ? 0.6 : 1 }}><Download size={17} color={colors.gray700} /><Text style={{ color: colors.gray700, fontWeight: '700' }}>Export CSV</Text></Pressable><Pressable disabled={exporting} onPress={() => void runExport('xlsx')} style={{ flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray300, borderRadius: radius.xl, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: exporting ? 0.6 : 1 }}><Download size={17} color={colors.gray700} /><Text style={{ color: colors.gray700, fontWeight: '700' }}>Export Excel</Text></Pressable></View> : null}

      {mergedItems.length ? <View style={{ gap: 9 }}><Text style={{ color: colors.gray900, fontWeight: '700', fontSize: 16 }}>Fiches enregistrées ({mergedItems.length})</Text>{mergedItems.map((item) => <View key={item.key} style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 14, gap: 5 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Beaker size={17} color={colors.blue600} /><Text style={{ flex: 1, color: colors.gray900, fontWeight: '700' }}>{item.sampleCode}</Text>{item.pendingExport ? <Text style={{ color: colors.gray500, fontSize: 11, fontWeight: '700' }}>Sur l’appareil</Text> : null}<Text style={{ color: item.status === 'complete' ? colors.green500 : colors.yellow500, fontSize: 12, fontWeight: '700' }}>{item.status === 'complete' ? 'Validée' : 'Brouillon'}</Text></View><Text style={{ color: colors.gray500, fontSize: 12 }}>{item.sondageLabel} · {item.depthTop} à {item.depthBottom} m{item.horizon ? ` · ${item.horizon}` : ''}</Text></View>)}</View> : null}
    </ScrollView>
  );
};

export { buildInput, validateForm };
