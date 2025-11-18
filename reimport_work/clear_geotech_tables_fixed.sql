-- ============================================================================
-- SCRIPT DE NETTOYAGE DES TABLES GÉOTECHNIQUES (VERSION CORRIGÉE)
-- Supprime les LIGNES, conserve la STRUCTURE
-- ============================================================================

BEGIN;

-- Désactiver les triggers temporairement pour éviter les cascades
SET session_replication_role = replica;

-- Lock tables dans l'ordre des FK (enfants → parents) - seulement celles qui existent
LOCK TABLE public.essais_atterberg IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.essais_classif IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.essais_geotechniques IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.essais_physiques IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.essais_vbs IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.granulo_points IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.granulometrie_points IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.raw_lab_ags IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.raw_lab_agt IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.raw_lab_atterberg IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.echantillons IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.sondages IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.ref_types_essais IN ACCESS EXCLUSIVE MODE;

-- Supprimer les données (ordre FK : enfants → parents)
\echo 'Suppression essais et données laboratoire...'
DELETE FROM public.essais_atterberg;
DELETE FROM public.essais_classif;
DELETE FROM public.essais_geotechniques;
DELETE FROM public.essais_physiques;
DELETE FROM public.essais_vbs;
DELETE FROM public.granulo_points;
DELETE FROM public.granulometrie_points;
DELETE FROM public.raw_lab_ags;
DELETE FROM public.raw_lab_agt;
DELETE FROM public.raw_lab_atterberg;

\echo 'Suppression échantillons...'
DELETE FROM public.echantillons;

\echo 'Suppression sondages...'
DELETE FROM public.sondages WHERE deleted_at IS NULL;

\echo 'Suppression référentiels...'
DELETE FROM public.ref_types_essais;

-- Réactiver les triggers
SET session_replication_role = DEFAULT;

-- Vérification des suppressions
\echo 'Vérification des suppressions:'
SELECT 'sondages' as table_name, COUNT(*) as remaining_rows FROM public.sondages
UNION ALL
SELECT 'echantillons', COUNT(*) FROM public.echantillons
UNION ALL
SELECT 'essais_atterberg', COUNT(*) FROM public.essais_atterberg
UNION ALL
SELECT 'essais_geotechniques', COUNT(*) FROM public.essais_geotechniques
UNION ALL
SELECT 'ref_types_essais', COUNT(*) FROM public.ref_types_essais;

COMMIT;

-- Réindexation et statistiques
\echo 'Réindexation et mise à jour des statistiques...'
REINDEX TABLE public.sondages;
REINDEX TABLE public.echantillons;
ANALYZE public.sondages;
ANALYZE public.echantillons;

\echo '✅ Nettoyage terminé - Tables prêtes pour réimportation';
