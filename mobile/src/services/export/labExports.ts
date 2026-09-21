/**
 * Export des fiches d'essais de laboratoire en CSV et Excel (.xlsx).
 *
 * La source est TOUJOURS la base locale (`lab_results_draft`), jamais le
 * serveur : ces exports doivent fonctionner sur le terrain, sans réseau,
 * exactement comme la saisie. Ils sont complémentaires du `.atlasreturn`,
 * qui reste le canal officiel de remontée vers le bureau — le CSV et le
 * XLSX sont des sorties de travail (vérification, partage, tableur).
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zip } from 'react-native-zip-archive';

import { atlaspackRepository, newUuid, type LabResultDraft } from '@/services/atlaspack/repository';

type Cell = string | number | null;

interface Column {
  header: string;
  value: (r: LabResultDraft) => Cell;
}

function test(r: LabResultDraft, name: string): Record<string, unknown> | null {
  const tests = (r.tests ?? {}) as Record<string, unknown>;
  const t = tests[name];
  return t && typeof t === 'object' ? (t as Record<string, unknown>) : null;
}

function num(v: unknown): Cell {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function sieve(r: LabResultDraft, mm: number): Cell {
  const g = test(r, 'granulometrie');
  const points = (g?.points ?? []) as Array<{ sieve_mm?: number; passant_pct?: number }>;
  const p = points.find((pt) => pt.sieve_mm === mm);
  return num(p?.passant_pct);
}

function sampleField(r: LabResultDraft, key: string): Cell {
  const sample = (r.sample ?? {}) as Record<string, unknown>;
  const v = sample[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Colonnes à plat : une ligne = un échantillon, un essai non réalisé reste vide. */
const COLUMNS: Column[] = [
  { header: 'Code échantillon', value: (r) => r.sampleCode },
  { header: 'Sondage', value: (r) => r.sondageId },
  { header: 'Profondeur haute (m)', value: (r) => num(r.depthTopM) },
  { header: 'Profondeur basse (m)', value: (r) => num(r.depthBottomM) },
  { header: 'Statut', value: (r) => (r.status === 'complete' ? 'Validée' : 'Brouillon') },
  { header: 'Saisie le', value: (r) => r.createdAt },
  { header: 'Description', value: (r) => sampleField(r, 'description') },
  { header: 'État échantillon', value: (r) => sampleField(r, 'condition') },
  { header: 'WL (%)', value: (r) => num(test(r, 'atterberg')?.wl_pct) },
  { header: 'WP (%)', value: (r) => num(test(r, 'atterberg')?.wp_pct) },
  { header: 'IP rapport (%)', value: (r) => num(test(r, 'atterberg')?.ip_rapport) },
  {
    header: 'IP calculé (%)',
    value: (r) => {
      const wl = test(r, 'atterberg')?.wl_pct;
      const wp = test(r, 'atterberg')?.wp_pct;
      return typeof wl === 'number' && typeof wp === 'number' ? Math.round((wl - wp) * 10) / 10 : null;
    },
  },
  { header: 'VBS (g/100g)', value: (r) => num(test(r, 'vbs')?.vbs_g100g) },
  { header: 'Gonflement EG (%)', value: (r) => num(test(r, 'gonflement')?.eg_pct) },
  {
    header: 'Gonflement qualitatif',
    value: (r) => {
      const v = test(r, 'gonflement')?.eg_qualitatif;
      return typeof v === 'string' && v.length > 0 ? v : null;
    },
  },
  { header: 'Proctor densite seche max (kN/m3)', value: (r) => num(test(r, 'proctor')?.gamma_d_max_knm3) },
  { header: 'Proctor teneur en eau optimale (%)', value: (r) => num(test(r, 'proctor')?.w_opt_pct) },
  { header: 'CBR (%)', value: (r) => num(test(r, 'cbr')?.cbr_pct) },
  { header: 'Pénétromètre Rd (MPa)', value: (r) => num(test(r, 'penetrometre')?.rd_mpa) },
  { header: 'Pressiomètre Em (MPa)', value: (r) => num(test(r, 'pressiometre')?.em_mpa) },
  { header: 'Pressiomètre Pl (MPa)', value: (r) => num(test(r, 'pressiometre')?.pl_mpa) },
  { header: 'Passant 2 mm (%)', value: (r) => sieve(r, 2) },
  { header: 'Passant 0,08 mm (%)', value: (r) => sieve(r, 0.08) },
];

export interface LabExportResult {
  fileUri: string;
  fileName: string;
  rowCount: number;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

async function share(fileUri: string, mimeType: string, dialogTitle: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType, dialogTitle });
  }
}

// ── CSV ────────────────────────────────────────────────────────────────────

function csvCell(v: Cell): string {
  if (v === null) return '';
  const s = String(v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Séparateur `;` et BOM UTF-8 : c'est ce qu'attend Excel en configuration
 * francophone. Avec une virgule et sans BOM, le fichier s'ouvre sur une seule
 * colonne et les accents sont illisibles.
 */
export async function exportLabResultsCsv(missionId: string): Promise<LabExportResult> {
  const rows = await atlaspackRepository.listLabResultsForMission(missionId);
  const lines = [COLUMNS.map((c) => csvCell(c.header)).join(';')];
  for (const r of rows) lines.push(COLUMNS.map((c) => csvCell(c.value(r))).join(';'));
  const content = '﻿' + lines.join('\r\n') + '\r\n';

  const fileName = 'fiches-labo-' + stamp() + '.csv';
  const fileUri = FileSystem.documentDirectory + fileName;
  await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
  await share(fileUri, 'text/csv', 'Exporter les fiches de laboratoire (CSV)');
  return { fileUri, fileName, rowCount: rows.length };
}

// ── XLSX ───────────────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetCell(ref: string, v: Cell): string {
  if (v === null) return '';
  if (typeof v === 'number') return '<c r="' + ref + '"><v>' + v + '</v></c>';
  // `inlineStr` évite la table de chaînes partagées : plus verbeux, mais un
  // seul fichier XML à produire et aucun index à maintenir.
  return (
    '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' +
    xmlEscape(String(v)) +
    '</t></is></c>'
  );
}

/**
 * Écrit un vrai `.xlsx` (paquet OOXML zippé) sans dépendance supplémentaire :
 * `react-native-zip-archive` est déjà utilisé pour le `.atlasreturn`.
 */
export async function exportLabResultsXlsx(missionId: string): Promise<LabExportResult> {
  const rows = await atlaspackRepository.listLabResultsForMission(missionId);

  const xmlRows: string[] = [];
  xmlRows.push('<row r="1">' + COLUMNS.map((c, i) => sheetCell(colName(i) + '1', c.header)).join('') + '</row>');
  rows.forEach((r, ri) => {
    const rowNum = ri + 2;
    xmlRows.push(
      '<row r="' + rowNum + '">' +
        COLUMNS.map((c, i) => sheetCell(colName(i) + rowNum, c.value(r))).join('') +
        '</row>',
    );
  });

  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' + xmlRows.join('') + '</sheetData></worksheet>';

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Fiches labo" sheetId="1" r:id="rId1"/></sheets></workbook>';

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '</Relationships>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>';

  const staging = FileSystem.cacheDirectory + 'xlsx-' + newUuid() + '/';
  await FileSystem.makeDirectoryAsync(staging + '_rels', { intermediates: true });
  await FileSystem.makeDirectoryAsync(staging + 'xl/_rels', { intermediates: true });
  await FileSystem.makeDirectoryAsync(staging + 'xl/worksheets', { intermediates: true });

  await FileSystem.writeAsStringAsync(staging + '[Content_Types].xml', contentTypes);
  await FileSystem.writeAsStringAsync(staging + '_rels/.rels', rootRels);
  await FileSystem.writeAsStringAsync(staging + 'xl/workbook.xml', workbook);
  await FileSystem.writeAsStringAsync(staging + 'xl/_rels/workbook.xml.rels', workbookRels);
  await FileSystem.writeAsStringAsync(staging + 'xl/worksheets/sheet1.xml', sheet);

  const fileName = 'fiches-labo-' + stamp() + '.xlsx';
  const fileUri = FileSystem.documentDirectory + fileName;
  await zip(staging, fileUri);
  await FileSystem.deleteAsync(staging, { idempotent: true });

  await share(
    fileUri,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Exporter les fiches de laboratoire (Excel)',
  );
  return { fileUri, fileName, rowCount: rows.length };
}
