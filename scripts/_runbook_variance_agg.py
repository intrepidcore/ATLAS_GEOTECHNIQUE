import os
from pathlib import Path

for line in (Path(__file__).resolve().parent.parent / ".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"\''))

import psycopg2

conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.autocommit = True
c = conn.cursor()
c.execute(
    """
    SELECT maille_id, variance_kriging, norm_variance_v1, priority_score_v1
    FROM atlas.v_campaign_priority_score
    WHERE variance_kriging IS NOT NULL
    LIMIT 8
    """
)
print("sample_with_variance:", c.fetchall())
c.execute(
    """
    SELECT COUNT(*)::bigint,
           AVG(variance_kriging)::float8,
           MAX(variance_kriging)::float8
    FROM atlas.v_campaign_priority_score
    WHERE variance_kriging IS NOT NULL
    """
)
print("count_avg_max_variance_zone_mailles:", c.fetchone())
conn.close()
