-- Mailles d'une mission — définition unique.
--
-- Une mission peut couvrir plusieurs mailles. Trois sources coexistaient et
-- divergeaient :
--   * `colab_missions.maille_id` — la maille principale, celle qu'affichent la
--     carte, la fiche de mission, l'ordre de mission PDF et le fond hors-ligne ;
--   * `colab_missions.zone_label` — la liste déclarée, affichée à l'opérateur ;
--   * `colab_mission_maille_items` — un remplissage historique qui, pour 15
--     missions, désignait une maille située à des dizaines de kilomètres de la
--     zone réellement attribuée. Aucun code ne le lisait ; il est ignoré ici.
--
-- Règle retenue : les codes de `zone_label` qui correspondent à une maille
-- réelle, plus la maille principale. `zone_label` contient parfois un nom de
-- lieu (« Sanguera ») et non un code : la maille principale garantit alors un
-- résultat non vide.
CREATE OR REPLACE VIEW atlas.v_mission_mailles AS
SELECT DISTINCT
    m.id  AS mission_id,
    mc.id AS maille_id,
    mc.code AS maille_code
FROM atlas.colab_missions m
JOIN atlas.mailles mc
  ON mc.id = m.maille_id
 OR mc.code IN (
      SELECT trim(c)
      FROM unnest(string_to_array(COALESCE(m.zone_label, ''), ',')) AS c
      WHERE trim(c) <> ''
    )
WHERE m.deleted_at IS NULL;
