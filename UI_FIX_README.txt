=============================================================================
  FIX UI DISPLAY - Les donnees n'apparaissent pas dans la carte
=============================================================================

PROBLEME: Les donnees importees ne s'affichent pas dans l'interface carte.

-----------------------------------------------------------------------------
SOLUTION RAPIDE (3 COMMANDES)
-----------------------------------------------------------------------------

1. Diagnostic:
   psql -U atlas -d atlas_clean -f diagnostic_ui.sql

2. Creer vues spread:
   psql -U atlas -d atlas_clean -f create_spread_views.sql

3. Refresh vues:
   psql -U atlas -d atlas_clean -f refresh_views.sql

4. Vider cache navigateur: Ctrl+Shift+R

-----------------------------------------------------------------------------
OU SCRIPT AUTOMATIQUE
-----------------------------------------------------------------------------

powershell -ExecutionPolicy Bypass -File fix_ui_display.ps1

Ce script fait tout automatiquement:
  - Diagnostic base de donnees
  - Creation vues spread
  - Refresh vues materialisees
  - Verifications
  - Recommandations API/Frontend

-----------------------------------------------------------------------------
TOP 5 CAUSES
-----------------------------------------------------------------------------

1. Tous les geom sont NULL et pas de "spread"
   Fix: psql -U atlas -d atlas_clean -f create_spread_views.sql

2. Endpoint carte branche sur ancienne vue
   Fix: Repointer API sur mv_mailles_geotech

3. Vue materialisee non rafraichie
   Fix: psql -U atlas -d atlas_clean -f refresh_views.sql

4. Cache Frontend
   Fix: Ctrl+Shift+R (hard refresh)

5. Champs de style non alignes
   Fix: Verifier couche lit w_avg, ip_avg, vbs_avg

-----------------------------------------------------------------------------
STRATEGIE ADM3 SPREAD
-----------------------------------------------------------------------------

Pour les sites SANS coordonnees GPS mais avec code ADM3:
  - On "diffuse" leurs donnees sur TOUTES les mailles de leur commune
  - Les donnees deviennent visibles immediatement
  - Des qu'un geom est renseigne, le site sort automatiquement du spread

Vues creees:
  - v_sondages_spread          Sites sans geom dupliques sur mailles ADM3
  - v_mailles_geotech          Agregation par maille (reel + spread)
  - mv_mailles_geotech         Version materialisee (performance)
  - mailles_geotechnique_stats Vue de compatibilite

-----------------------------------------------------------------------------
VERIFICATIONS SQL RAPIDES
-----------------------------------------------------------------------------

-- Donnees importees ?
SELECT count(*) FROM sondages;
SELECT count(*) FROM echantillons;

-- Geometrie ?
SELECT code, (geom IS NOT NULL) AS has_geom, adm3_code FROM sondages;

-- Vues creees ?
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('v_sondages_spread', 'mv_mailles_geotech');

-- Mailles avec stats ?
SELECT COUNT(*) FROM mv_mailles_geotech;

-- Exemple donnees
SELECT maille_id, w_avg, ip_avg, vbs_avg, n, has_spread 
FROM mv_mailles_geotech LIMIT 5;

-----------------------------------------------------------------------------
API - EXEMPLE SQL
-----------------------------------------------------------------------------

Avant (ancienne vue):
  SELECT m.geom, s.*
  FROM mailles m
  LEFT JOIN mailles_geotechnique_stats s ON s.maille_id = m.id;

Apres (nouvelle vue):
  SELECT m.geom, s.*
  FROM mailles m
  LEFT JOIN mv_mailles_geotech s ON s.maille_id = m.id;

Champs disponibles:
  - w_avg          Teneur en eau moyenne
  - ip_avg         Indice de plasticite moyen
  - vbs_avg        Valeur au bleu moyen
  - n              Nombre d'echantillons
  - has_spread     Booleen (true si donnees spread ADM3)

-----------------------------------------------------------------------------
FRONTEND - CONFIGURATION COUCHE
-----------------------------------------------------------------------------

Verifier que la couche lit les bons champs:

{
  id: 'mailles-geotech',
  source: {
    type: 'geojson',
    data: '/api/mailles/stats'
  },
  paint: {
    'fill-color': [
      'interpolate',
      ['linear'],
      ['get', 'w_avg'],  // Doit correspondre au champ SQL
      0, '#ffffcc',
      10, '#a1dab4',
      20, '#41b6c4',
      30, '#225ea8'
    ]
  }
}

-----------------------------------------------------------------------------
WORKFLOW COMPLET
-----------------------------------------------------------------------------

1. Import donnees:
   python scripts\02_import_excel.py --file atlas_import_example.xlsx --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" --import-raw yes

2. Creer vues spread (une seule fois):
   psql -U atlas -d atlas_clean -f create_spread_views.sql

3. Refresh vues (apres chaque import):
   psql -U atlas -d atlas_clean -f refresh_views.sql

4. Verifier API pointe sur mv_mailles_geotech

5. Vider cache frontend (Ctrl+Shift+R)

6. Tester carte dans navigateur

-----------------------------------------------------------------------------
TESTS API
-----------------------------------------------------------------------------

# Sante API
curl -s http://localhost:8080/api/health | jq .

# Stats mailles (JSON)
curl -s "http://localhost:8080/api/mailles/stats?limit=5" | jq .

# Compteur features
curl -s "http://localhost:8080/api/mailles/stats" | jq '.features | length'

# Exemple proprietes
curl -s "http://localhost:8080/api/mailles/stats?limit=1" | jq '.features[0].properties'

-----------------------------------------------------------------------------
PURGE (RESET POUR TESTS)
-----------------------------------------------------------------------------

# Purge tables RAW uniquement
psql -U atlas -d atlas_clean -f purge_raw_tables.sql

# Purge TOUT (RAW + Canoniques) - ATTENTION !
psql -U atlas -d atlas_clean -c "
  TRUNCATE raw_lab_agt, raw_lab_ags, raw_lab_atterberg RESTART IDENTITY;
  TRUNCATE essais_vbs, essais_atterberg, granulo_points, echantillons, sondages RESTART IDENTITY CASCADE;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;
"

-----------------------------------------------------------------------------
CHECKLIST FINALE
-----------------------------------------------------------------------------

[ ] Diagnostic SQL execute (diagnostic_ui.sql)
[ ] Vues spread creees (create_spread_views.sql)
[ ] Vue materialisee rafraichie (refresh_views.sql)
[ ] API pointe sur mv_mailles_geotech
[ ] Champs frontend alignes (w_avg, ip_avg, vbs_avg)
[ ] Cache navigateur vide (Ctrl+Shift+R)
[ ] Tests API reussis (curl)
[ ] Carte affiche les donnees

-----------------------------------------------------------------------------
FICHIERS DISPONIBLES
-----------------------------------------------------------------------------

Scripts SQL:
  - diagnostic_ui.sql          Diagnostic complet (5 checks)
  - create_spread_views.sql    Creer vues spread ADM3
  - refresh_views.sql          Rafraichir vues materialisees
  - purge_raw_tables.sql       Purge tables RAW

Scripts PowerShell:
  - fix_ui_display.ps1         Script automatique complet

Documentation:
  - DEBUG_UI_GUIDE.md          Guide debug complet
  - QUICKSTART_v1.5.3.md       Guide demarrage rapide
  - PRODUCTION_READY_v1.5.3.md Validation production

-----------------------------------------------------------------------------
SUPPORT
-----------------------------------------------------------------------------

Pour plus de details, consulter:
  - DEBUG_UI_GUIDE.md          Guide complet avec exemples code
  - docs/RAW_IMPORT_README.md  Guide import RAW

=============================================================================
Version: 1.5.3
Status: Guide Debug UI Complet
Date: 2025-10-24
=============================================================================
