-- Migration v0.7.0 : Grille nationale Togo ~2 km² par maille
--
-- Cette migration :
-- 1. Crée une table country_tg pour stocker le polygone du Togo
-- 2. Prépare la structure pour générer une grille nationale avec mailles de ~2 km²
--
-- La génération de la grille elle-même se fait via l'ETL (voir etl/cli.py : make-grid)
-- car elle nécessite le polygone du Togo chargé au préalable.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Table pour stocker le polygone du pays (Togo)
CREATE TABLE IF NOT EXISTS country_tg (
  id SERIAL PRIMARY KEY,
  name text NOT NULL DEFAULT 'Togo',
  geom geometry(Polygon, 4326) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_country_tg_geom ON country_tg USING GIST (geom);

-- Note: Le polygone sera inséré via ETL (commande load-country)
-- La grille sera générée via ETL (commande make-grid) qui :
--   1. Lit le polygone depuis country_tg
--   2. Le transforme en EPSG:25231
--   3. Génère une grille carrée avec mailles de côté ~1414.21356 m (aire ~2 km²)
--   4. Clippe chaque cellule au polygone du Togo
--   5. Insère les mailles dans la table 'mailles' existante
