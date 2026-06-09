#!/usr/bin/env python3
"""Extract all metrics needed for the article from the DB."""
import psycopg2, json

conn = psycopg2.connect('postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean')
cur = conn.cursor()

print("=" * 60)
print("STATISTIQUES DESCRIPTIVES")
print("=" * 60)

for param, col, tbl in [
    ('VBS (g/100g)', 'vbs', 'v_echantillons_essais'),
    ('IP (%)', 'ip', 'v_echantillons_essais'),
    ('WL (%)', 'wl', 'v_echantillons_essais'),
    ('WP (%)', 'wp', 'v_echantillons_essais'),
]:
    cur.execute(f"""SELECT
        ROUND(AVG({col})::numeric,2), ROUND(STDDEV({col})::numeric,2),
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY {col})::numeric,2),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY {col})::numeric,2),
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY {col})::numeric,2),
        ROUND(MAX({col})::numeric,2), COUNT({col})
        FROM atlas.{tbl} WHERE {col} IS NOT NULL""")
    r = cur.fetchone()
    print(f"{param}: mean={r[0]}, std={r[1]}, Q1={r[2]}, med={r[3]}, Q3={r[4]}, max={r[5]}, N={r[6]}")

cur.execute("""SELECT ROUND(AVG(cg)::numeric,2), ROUND(STDDEV(cg)::numeric,2),
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cg)::numeric,2),
    ROUND(MAX(cg)::numeric,2), COUNT(cg)
    FROM atlas.essais_potentiel_gonflement WHERE cg IS NOT NULL""")
r = cur.fetchone()
print(f"EG (%): mean={r[0]}, std={r[1]}, med={r[2]}, max={r[3]}, N={r[4]}")

cur.execute("""SELECT ROUND(AVG(cbr_pct)::numeric,1), ROUND(STDDEV(cbr_pct)::numeric,1),
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cbr_pct)::numeric,1),
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cbr_pct)::numeric,1),
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cbr_pct)::numeric,1),
    ROUND(MAX(cbr_pct)::numeric,1), COUNT(cbr_pct)
    FROM atlas.essais_cbr WHERE cbr_pct IS NOT NULL AND compactage_pct BETWEEN 94 AND 96""")
r = cur.fetchone()
print(f"CBR95 (%): mean={r[0]}, std={r[1]}, Q1={r[2]}, med={r[3]}, Q3={r[4]}, max={r[5]}, N={r[6]}")

cur.execute("""SELECT ROUND(AVG(rd_mpa)::numeric,1), ROUND(STDDEV(rd_mpa)::numeric,1),
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rd_mpa)::numeric,1),
    ROUND(MAX(rd_mpa)::numeric,1), COUNT(rd_mpa)
    FROM atlas.essais_penetrometre WHERE rd_mpa IS NOT NULL AND rd_mpa > 0""")
r = cur.fetchone()
print(f"Rd (MPa): mean={r[0]}, std={r[1]}, med={r[2]}, max={r[3]}, N={r[4]}")

cur.execute("""SELECT ROUND(AVG(gamma_d_max)::numeric,3), ROUND(STDDEV(gamma_d_max)::numeric,3),
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gamma_d_max)::numeric,3),
    ROUND(MAX(gamma_d_max)::numeric,3), COUNT(gamma_d_max)
    FROM atlas.essais_proctor WHERE gamma_d_max IS NOT NULL AND gamma_d_max BETWEEN 1.2 AND 2.5""")
r = cur.fetchone()
print(f"gamma_d (kN/m3): mean={r[0]}, std={r[1]}, med={r[2]}, max={r[3]}, N={r[4]}")

cur.execute("""SELECT ROUND(AVG(w_opt)::numeric,1), ROUND(STDDEV(w_opt)::numeric,1),
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY w_opt)::numeric,1),
    ROUND(MAX(w_opt)::numeric,1), COUNT(w_opt)
    FROM atlas.essais_proctor WHERE w_opt IS NOT NULL AND w_opt BETWEEN 5 AND 35""")
r = cur.fetchone()
print(f"w_opt (%): mean={r[0]}, std={r[1]}, med={r[2]}, max={r[3]}, N={r[4]}")

print()
print("=" * 60)
print("LOO-RMSE KED HIERARCHIQUE (runs les plus récents)")
print("=" * 60)
cur.execute("""
    SELECT DISTINCT ON (parameter_id) parameter_id,
        metrics->'loo_residual'->>'rmse' as loo_rmse,
        metrics->>'n_train' as n_train
    FROM atlas.ai_interpolation_runs
    WHERE method = 'ked_hierarchical_5levels'
      AND metrics->'loo_residual'->>'rmse' IS NOT NULL
    ORDER BY parameter_id, (metrics->>'n_train')::int DESC NULLS LAST, created_at DESC
""")
for r in cur.fetchall():
    try:
        loo = round(float(r[1]), 3)
        print(f"  {r[0]}: LOO-RMSE={loo}, N={r[2]}")
    except:
        print(f"  {r[0]}: LOO-RMSE=None, N={r[2]}")

print()
print("=" * 60)
print("LOO-RMSE RK SCORPAN (runs les plus récents)")
print("=" * 60)
cur.execute("""
    SELECT DISTINCT ON (parameter_id) parameter_id,
        metrics->>'loo_rmse' as loo_rmse,
        metrics->>'n_train' as n_train
    FROM atlas.ai_interpolation_runs
    WHERE method = 'regression_kriging_scorpan'
      AND metrics->>'loo_rmse' IS NOT NULL
    ORDER BY parameter_id, created_at DESC
""")
for r in cur.fetchall():
    try:
        loo = round(float(r[1]), 3)
        print(f"  {r[0]}: LOO-RMSE={loo}, N={r[2]}")
    except:
        print(f"  {r[0]}: LOO-RMSE=None, N={r[2]}")

print()
print("=" * 60)
print("FUSION BLUP — Réduction de variance")
print("=" * 60)
cur.execute("""
    SELECT DISTINCT ON (parameter_id) parameter_id, metrics
    FROM atlas.ai_interpolation_runs
    WHERE method = 'ked_rk_fusion_bayesian'
    ORDER BY parameter_id, created_at DESC
""")
for r in cur.fetchall():
    m = r[1] or {}
    s2k = m.get('sigma2_ked_mean')
    s2r = m.get('sigma2_rk_mean')
    s2f = m.get('sigma2_fusion_mean')
    red = m.get('variance_reduction_pct')
    print(f"  {r[0]}: sigma2_KED={s2k}, sigma2_RK={s2r}, sigma2_Fus={s2f}, reduc={red}%")

print()
print("=" * 60)
print("MTGP — Prédictions moyennes")
print("=" * 60)
cur.execute("""
    SELECT DISTINCT ON (parameter_id) parameter_id, metrics
    FROM atlas.ai_interpolation_runs
    WHERE method = 'mtgp_icm_gpflow'
    ORDER BY parameter_id, created_at DESC
""")
for r in cur.fetchall():
    m = r[1] or {}
    print(f"  {r[0]}: pred_mean={m.get('pred_mean')}, pred_var={m.get('pred_var_mean')}, N={m.get('n_train')}")

print()
print("=" * 60)
print("NOMBRE DE SONDAGES PAR REGION")
print("=" * 60)
cur.execute("""
    SELECT COALESCE(adm1_name, 'Non géocodé') as region, COUNT(*)
    FROM atlas.sondages WHERE deleted_at IS NULL
    GROUP BY adm1_name ORDER BY count DESC
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

print()
print("=" * 60)
print("VARIOGRAMME PARAMS (VBS H1)")
print("=" * 60)
cur.execute("""
    SELECT DISTINCT ON (parameter_id) parameter_id, metrics
    FROM atlas.ai_interpolation_runs
    WHERE method='ked_hierarchical_5levels' AND parameter_id='vbs_ked_h1'
    ORDER BY parameter_id, (metrics->>'n_train')::int DESC NULLS LAST, created_at DESC
    LIMIT 1
""")
r = cur.fetchone()
if r:
    m = r[1] or {}
    print(f"  VBS H1 variogram: {json.dumps(m.get('variogram_params', m.get('variogram', {})), indent=2)}")

conn.close()
print("\nDone.")
