import psycopg2
conn = psycopg2.connect('postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean')
cur = conn.cursor()

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='atlas' AND table_name='v_echantillons_essais' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print("View cols:", cols[:20])

# Correlations argilosité
cur.execute("""
SELECT
    ROUND(CORR(vbs,ip)::numeric,3),
    ROUND(CORR(vbs,wl)::numeric,3),
    ROUND(CORR(vbs,wp)::numeric,3),
    ROUND(CORR(ip,wl)::numeric,3),
    ROUND(CORR(ip,wp)::numeric,3),
    ROUND(CORR(wl,wp)::numeric,3)
FROM atlas.v_echantillons_essais
""")
r = cur.fetchone()
print(f"VBS-IP={r[0]}  VBS-WL={r[1]}  VBS-WP={r[2]}")
print(f"IP-WL={r[3]}  IP-WP={r[4]}  WL-WP={r[5]}")

# EG correlations via join
cur.execute("""
SELECT
    ROUND(CORR(e.vbs, epg.cg)::numeric,3) vbs_eg,
    ROUND(CORR(e.ip,  epg.cg)::numeric,3) ip_eg,
    ROUND(CORR(e.wl,  epg.cg)::numeric,3) wl_eg,
    ROUND(CORR(e.wp,  epg.cg)::numeric,3) wp_eg,
    COUNT(*) n
FROM atlas.v_echantillons_essais e
JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id = e.echantillon_id
WHERE e.vbs IS NOT NULL AND epg.cg IS NOT NULL
""")
r = cur.fetchone()
print(f"VBS-EG={r[0]}  IP-EG={r[1]}  WL-EG={r[2]}  WP-EG={r[3]}  N={r[4]}")

# Portance correlations
cur.execute("""
SELECT
    ROUND(CORR(c.cbr_pct, p.gamma_d_max)::numeric,3) cbr_gd,
    ROUND(CORR(c.cbr_pct, p.w_opt)::numeric,3) cbr_wopt,
    ROUND(CORR(p.gamma_d_max, p.w_opt)::numeric,3) gd_wopt,
    COUNT(*) n
FROM atlas.essais_cbr c
JOIN atlas.echantillons ec ON ec.id=c.echantillon_id
JOIN atlas.essais_proctor p ON p.echantillon_id=ec.id
WHERE c.compactage_pct BETWEEN 94 AND 96
  AND c.cbr_pct IS NOT NULL AND p.gamma_d_max IS NOT NULL
""")
r = cur.fetchone()
print(f"Portance: CBR-gd={r[0]}  CBR-wopt={r[1]}  gd-wopt={r[2]}  N={r[3]}")

conn.close()
