BEGIN;

-- Empilement cartographique : les géométries de zones d'étude sont indépendantes ;
-- une même maille peut intersecter plusieurs unités (seuil 10 % dans recalc_mailles_zones_etude).
-- L'ordre définit quelle contour est dessiné « au-dessus » sur la carte (dernier = plus visible).
ALTER TABLE atlas.zones_etude
    ADD COLUMN IF NOT EXISTS carte_overlay_order INTEGER NOT NULL DEFAULT 100;

COMMENT ON COLUMN atlas.zones_etude.carte_overlay_order IS
  'Ordre d''affichage carte : valeurs plus petites = dessinées en premier (sous-couches). Chevauchements géologiques attendus en zone de transition.';

UPDATE atlas.zones_etude SET carte_overlay_order = 10 WHERE code = 'PLAINE_OTI_TG';
UPDATE atlas.zones_etude SET carte_overlay_order = 20 WHERE code = 'FOSSE_LIONS_TG';
UPDATE atlas.zones_etude SET carte_overlay_order = 30 WHERE code = 'DEPRESSION_BADO_TG';
UPDATE atlas.zones_etude SET carte_overlay_order = 40 WHERE code = 'PLAINE_MONO_TG';
UPDATE atlas.zones_etude SET carte_overlay_order = 50 WHERE code = 'DEPRESSION_LAMA_TG';

COMMENT ON TABLE atlas.mailles_zones_etude IS
  'Liaison maille-zone par intersection géométrique. Chevauchements entre zones voisines (ex. Lama / Mono) '
  'reflètent des transitions réelles ou des emprises de cartes sources différentes ; le kriging reste '
  'calculé par zone séparément. Pour une attribution unique en synthèse, privilégier la zone de pct_intersection maximale.';

COMMIT;
