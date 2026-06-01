#!/usr/bin/env python3
"""
run_all.py — Orchestrateur complet import V10_MASTER
Intrepid Core Engineering Standards

Usage:
    python run_all.py [--dry-run-only] [--skip-dry-run] [--from-phase N]

Phases :
  dry  : Validation (lecture seule) — OBLIGATOIRE avant import
  02   : Sondages + géocodage
  03   : Données laboratoire (atterberg, proctor, classif, physiques, cbr-95)
  04   : Profils in-situ (pénétromètre, pressiomètre)
  05   : Courbes CBR + Proctor
  post : Mise à jour h_canon existants + lancement pipeline

Exit codes :
  0 = succès complet
  1 = erreur critique
  2 = dry-run échoué (migrations manquantes)
"""
import sys, subprocess, logging, argparse, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import DATABASE_URL, LOGS_DIR

log_file = LOGS_DIR / "run_all.log"
logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file, encoding="utf-8"),
              logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

PHASES = {
    "dry":  "dry_run_v10.py",
    "02":   "phase_02_import_sondages.py",
    "03":   "phase_03_import_labo.py",
    "04":   "phase_04_import_insitu.py",
    "05":   "phase_05_import_cbr_proctor.py",
}


def run_phase(name: str, skip_on_error: bool = False) -> bool:
    script = Path(__file__).parent / PHASES[name]
    log.info(f"{'='*60}")
    log.info(f">> PHASE {name} : {script.name}")
    t0 = time.time()

    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=False,  # stdout/stderr live
    )
    elapsed = time.time() - t0

    if result.returncode == 0:
        log.info(f"OK Phase {name} terminée en {elapsed:.1f}s")
        return True
    else:
        msg = f"KO Phase {name} ÉCHEC (code {result.returncode}) en {elapsed:.1f}s"
        if skip_on_error:
            log.warning(msg + " — continuité forcée")
            return False
        else:
            log.error(msg + " — ARRÊT")
            return False


def run_post_import(conn_url: str):
    """
    Post-import :
    1. Backfill h_canon pour echantillons existants sans h_canon (historiques)
    2. Forcer mise à jour maille_code via trigger géospatial
    3. Log résumé des insertions
    """
    import psycopg2

    log.info("=" * 60)
    log.info(">> POST-IMPORT — Backfill h_canon + stats")

    conn = psycopg2.connect(conn_url)
    try:
        with conn.cursor() as cur:
            # Backfill h_canon pour echantillons sans h_canon
            cur.execute("""
                UPDATE atlas.echantillons
                SET h_canon = CASE
                  WHEN depth_m <= 1.0  THEN 'H1'
                  WHEN depth_m <= 1.5  THEN 'H2'
                  ELSE                      'H3'
                END
                WHERE h_canon IS NULL
                  AND depth_m IS NOT NULL
            """)
            backfilled = cur.rowcount
            log.info(f"  h_canon backfillés (historiques) : {backfilled}")

            # Stats finales
            cur.execute("""
                SELECT
                  (SELECT COUNT(*) FROM atlas.sondages)              AS sondages,
                  (SELECT COUNT(*) FROM atlas.echantillons)          AS echantillons,
                  (SELECT COUNT(*) FROM atlas.essais_atterberg)      AS atterberg,
                  (SELECT COUNT(*) FROM atlas.essais_proctor)        AS proctor,
                  (SELECT COUNT(*) FROM atlas.essais_classif)        AS classif,
                  (SELECT COUNT(*) FROM atlas.essais_physiques)      AS physiques,
                  (SELECT COUNT(*) FROM atlas.essais_cbr)            AS cbr,
                  (SELECT COUNT(*) FROM atlas.essais_penetrometre)   AS penetrometre,
                  (SELECT COUNT(*) FROM atlas.essais_pressiometre)   AS pressiometre
            """)
            row = cur.fetchone()
            names = ["sondages","echantillons","atterberg","proctor","classif",
                     "physiques","cbr","penetrometre","pressiometre"]
            log.info("\n  ÉTAT DB FINAL :")
            for name, val in zip(names, row):
                log.info(f"    {name:20s} : {val:>8,}")

        conn.commit()
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run-only", action="store_true",
                        help="Ne faire que le dry-run")
    parser.add_argument("--skip-dry-run", action="store_true",
                        help="Sauter le dry-run (DÉCONSEILLÉ)")
    parser.add_argument("--from-phase", type=str, default=None,
                        help="Reprendre à partir de la phase (02/03/04/05)")
    args = parser.parse_args()

    log.info("+==========================================================+")
    log.info("|     IMPORT V10_MASTER — ATLAS GÉOTECHNIQUE TOGO         |")
    log.info("+==========================================================╝")
    log.info(f"  DB  : {DATABASE_URL}")

    # Dry-run obligatoire
    if not args.skip_dry_run:
        ok = run_phase("dry")
        if not ok:
            log.error("Dry-run ÉCHEC — import annulé")
            sys.exit(2)
        if args.dry_run_only:
            log.info("Mode --dry-run-only : arrêt après validation")
            sys.exit(0)
    else:
        log.warning("! Dry-run IGNORÉ (--skip-dry-run)")

    # Déterminer la phase de départ
    all_phases = ["02", "03", "04", "05"]
    from_phase = args.from_phase
    if from_phase and from_phase in all_phases:
        start_idx = all_phases.index(from_phase)
        phases_to_run = all_phases[start_idx:]
        log.info(f"Reprise depuis phase {from_phase}")
    else:
        phases_to_run = all_phases

    # Exécuter les phases
    for phase in phases_to_run:
        ok = run_phase(phase)
        if not ok:
            log.error(f"Import interrompu à la phase {phase}")
            log.error("Corriger l'erreur et relancer avec --from-phase " + phase)
            sys.exit(1)

    # Post-import
    run_post_import(DATABASE_URL)

    log.info("=" * 60)
    log.info("OK IMPORT V10_MASTER TERMINÉ")
    log.info("  -> Lancer les calculs : python trigger_pipeline.py")
    log.info(f"  -> Log complet : {log_file}")
    sys.exit(0)


if __name__ == "__main__":
    main()
