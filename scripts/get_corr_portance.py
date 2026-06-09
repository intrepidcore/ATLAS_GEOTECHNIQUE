import psycopg2
conn = psycopg2.connect('postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean')
cur = conn.cursor()
cur.execute("""
SELECT
    CORR(e.vbs,e.ip) vbs_ip, CORR(e.vbs,e.wl) vbs_wl, CORR(e.vbs,e.wp) vbs_wp,
    CORR(e.ip,e.wl) ip_wl, CORR(e.ip,e.wp) ip_wp, CORR(e.wl,e.wp) wl_wp,
    CORR(e.vbs,e.eg) vbs_eg, CORR(e.ip,e.eg) ip_eg, CORR(e.wl,e.eg) wl_eg,
    CORR(e.wp,e.eg) wp_eg
FROM atlas.v_echantillons_essais e""")
r=cur.fetchone()
labels=['vbs_ip','vbs_wl','vbs_wp','ip_wl','ip_wp','wl_wp','vbs_eg','ip_eg','wl_eg','wp_eg']
for l,v in zip(labels,r):
    print(f'{l}: {float(v):.3f}' if v else f'{l}: N/A')

cur.execute("""
SELECT
    CORR(c.cbr_pct, p.gamma_d_max) cbr_gd,
    CORR(c.cbr_pct, p.w_opt) cbr_wopt,
    CORR(p.gamma_d_max, p.w_opt) gd_wopt,
    COUNT(*) n
FROM atlas.essais_cbr c
JOIN atlas.echantillons ec ON ec.id=c.echantillon_id
JOIN atlas.essais_proctor p ON p.echantillon_id=ec.id
WHERE c.compactage_pct BETWEEN 94 AND 96
  AND c.cbr_pct IS NOT NULL AND p.gamma_d_max IS NOT NULL""")
r=cur.fetchone()
for l,v in zip(['CBR-gd','CBR-wopt','gd-wopt'],[r[0],r[1],r[2]]):
    print(f'{l}: {float(v):.3f}' if v else f'{l}: N/A')
print(f'N_proctor_cbr: {r[3]}')
conn.close()
