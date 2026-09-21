/**
 * Vérifie le mapping ligne SQLite (snake_case, tel que retourné par
 * `SELECT *`) -> `AtlasPackMeta` (camelCase). Un bug réel de ce type a cassé
 * la connexion hors-ligne en conditions réelles le 2026-08-31 : un ancien
 * mapping réutilisait par erreur l'interface camelCase comme type de ligne
 * brute, lisait `row.missionIds` (undefined, la vraie clé est
 * `mission_ids`), et `JSON.parse(undefined)` échouait avec "Unexpected
 * character: u". Ce test échoue si la même erreur de nommage réapparaît.
 */
import { rowToAtlasPackMeta, type AtlasPackMetaRow } from '@/services/atlaspack/repository';

function realisticRow(overrides: Partial<AtlasPackMetaRow> = {}): AtlasPackMetaRow {
  return {
    package_id: 'a68c1977-2b4d-4f0a-a800-f008dc7de2de',
    operator_user_id: '8a361b71-fe58-49c9-ba2f-b5a83b69b731',
    operator_email: 'protazertyuiop@gmail.com',
    format_version: 1,
    schema_version: 1,
    generated_at: '2026-08-31T10:17:59.143594+00:00',
    expires_at: '2026-09-30T10:17:59.143594+00:00',
    signing_key_id: '3abbc3fe1810b6e8',
    password_salt_b64: 'CTKatlJuGRBtisCQquGTTw==',
    argon2_m_cost: 65536,
    argon2_t_cost: 3,
    argon2_p_cost: 4,
    argon2_hash_len: 32,
    mission_ids: JSON.stringify(['a649afbb-8dfa-45ee-8ad4-6ab17f05b0ad', 'aca2d552-e652-45fa-9cb4-f07d97c720cb']),
    data_bin_path: '/data/atlaspack/a68c1977.../data.bin',
    mbtiles_path: '/data/atlaspack/a68c1977.../offline.mbtiles',
    imported_at: '2026-08-31T13:00:00.000Z',
    last_unlocked_at: null,
    ...overrides,
  };
}

describe('rowToAtlasPackMeta — mapping snake_case (SQLite) -> camelCase', () => {
  it('maps every field correctly from a realistic raw row', () => {
    const meta = rowToAtlasPackMeta(realisticRow());
    expect(meta.packageId).toBe('a68c1977-2b4d-4f0a-a800-f008dc7de2de');
    expect(meta.operatorUserId).toBe('8a361b71-fe58-49c9-ba2f-b5a83b69b731');
    expect(meta.operatorEmail).toBe('protazertyuiop@gmail.com');
    expect(meta.argon2MCost).toBe(65536);
    expect(meta.argon2TCost).toBe(3);
    expect(meta.argon2PCost).toBe(4);
    expect(meta.argon2HashLen).toBe(32);
    expect(meta.passwordSaltB64).toBe('CTKatlJuGRBtisCQquGTTw==');
    expect(meta.dataBinPath).toContain('data.bin');
    expect(meta.mbtilesPath).toContain('offline.mbtiles');
  });

  it('parses mission_ids (JSON TEXT column) into a real array', () => {
    const meta = rowToAtlasPackMeta(realisticRow());
    expect(meta.missionIds).toEqual([
      'a649afbb-8dfa-45ee-8ad4-6ab17f05b0ad',
      'aca2d552-e652-45fa-9cb4-f07d97c720cb',
    ]);
  });

  it('handles a null mbtiles_path / last_unlocked_at (packages without offline maps, never unlocked)', () => {
    const meta = rowToAtlasPackMeta(realisticRow({ mbtiles_path: null, last_unlocked_at: null }));
    expect(meta.mbtilesPath).toBeNull();
    expect(meta.lastUnlockedAt).toBeNull();
  });

  it('throws a clear diagnostic error — not a generic JSON SyntaxError — if mission_ids is corrupt', () => {
    expect(() => rowToAtlasPackMeta(realisticRow({ mission_ids: 'not valid json' }))).toThrow(
      /mission_ids illisible pour le paquet a68c1977/,
    );
  });

  it('never produces the literal string "undefined" from a missing/undefined column (regression guard)', () => {
    // Simule ce que ferait un ancien bug de mapping camelCase : la colonne
    // n'existe simplement pas sous ce nom -> undefined -> JSON.parse(undefined)
    // se transforme en JSON.parse("undefined") et casse avec "Unexpected
    // character: u". On vérifie que le mapping ACTUEL ne peut plus produire ça.
    const row = realisticRow();
    expect(row.mission_ids).not.toBe('undefined');
    const meta = rowToAtlasPackMeta(row);
    expect(Array.isArray(meta.missionIds)).toBe(true);
  });
});
