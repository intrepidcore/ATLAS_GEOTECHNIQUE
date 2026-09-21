/**
 * Décompose le `maps/offline.mbtiles` d'un paquet importé en fichiers
 * `{z}/{x}/{y}.png` sur le stockage local, pour que Leaflet (dans la
 * WebView de MissionMapScreen) puisse les charger via `file://` sans aucun
 * réseau. Exécuté une fois par paquet, à la demande (mise en cache locale).
 *
 * MBTiles stocke les lignes en schéma TMS (`tile_row` inversé par rapport à
 * XYZ) — cf. le commentaire équivalent dans
 * services/api-geo/src/atlaspack/offline_tiles.rs. On reconvertit ici vers
 * XYZ car c'est le schéma qu'attend le gabarit d'URL standard de Leaflet
 * (`{z}/{x}/{y}.png`).
 */
import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { bytesToB64 } from './crypto';

const SQLITE_SUBDIR = `${FileSystem.documentDirectory}SQLite/`;
const TILES_ROOT = `${FileSystem.documentDirectory}offline-tiles/`;

interface TileRow {
  zoom_level: number;
  tile_column: number;
  tile_row: number;
  tile_data: Uint8Array;
}

export function offlineTilesDirFor(packageId: string): string {
  return `${TILES_ROOT}${packageId}/`;
}

/** true si l'explosion a déjà eu lieu pour ce paquet (marqueur de complétion). */
export async function offlineTilesReady(packageId: string): Promise<boolean> {
  const marker = `${offlineTilesDirFor(packageId)}.complete`;
  const info = await FileSystem.getInfoAsync(marker);
  return info.exists;
}

/**
 * Décompose le mbtiles en arborescence de fichiers PNG. Idempotent : ne
 * refait rien si déjà fait pour ce `packageId`. Ne lève pas d'exception en
 * cas d'absence de fond hors-ligne dans le paquet (mbtilesPath null) —
 * l'app retombe alors sur les fonds distants (nécessitent une connexion).
 */
export async function explodeMbtilesIfNeeded(packageId: string, mbtilesPath: string | null): Promise<number> {
  if (!mbtilesPath) return 0;
  if (await offlineTilesReady(packageId)) return -1; // déjà fait, compte non recalculé

  const outputDir = offlineTilesDirFor(packageId);
  await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true }).catch(() => {});
  await FileSystem.makeDirectoryAsync(SQLITE_SUBDIR, { intermediates: true }).catch(() => {});

  // expo-sqlite ouvre par nom dans son répertoire SQLite dédié — on y copie
  // le mbtiles (lecture seule, fichier temporaire) plutôt que d'ouvrir un
  // chemin arbitraire.
  const dbName = `atlaspack-tiles-${packageId}.db`;
  const dbPath = `${SQLITE_SUBDIR}${dbName}`;
  await FileSystem.copyAsync({ from: mbtilesPath, to: dbPath });

  const db = await SQLite.openDatabaseAsync(dbName);
  let count = 0;
  try {
    const rows = await db.getAllAsync<TileRow>('SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles');
    for (const row of rows) {
      const z = row.zoom_level;
      const x = row.tile_column;
      const n = 2 ** z;
      const xyzY = n - 1 - row.tile_row; // inversion TMS -> XYZ
      const dir = `${outputDir}${z}/${x}/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      await FileSystem.writeAsStringAsync(`${dir}${xyzY}.png`, bytesToB64(row.tile_data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      count++;
    }
    await FileSystem.writeAsStringAsync(`${outputDir}.complete`, String(count));
  } finally {
    await db.closeAsync();
    await FileSystem.deleteAsync(dbPath, { idempotent: true }).catch(() => {});
  }
  return count;
}
