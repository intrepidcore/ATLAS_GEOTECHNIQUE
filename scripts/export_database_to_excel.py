import re
import pandas as pd
from sqlalchemy import create_engine, text

# ⚙️ Configuration Postgres depuis .env
PGURL = "postgresql+psycopg2://atlas:atlas@localhost:5432/atlas_clean"

# Schémas à exporter
SCHEMAS = ["public", "atlas"]  # ajoutez/enlevez selon votre projet

# Sécurité Excel : noms de feuille uniques, <= 31 chars, pas : \ / ? * [ ]
def sheet_name_safe(name: str, used: set) -> str:
    s = re.sub(r'[:\\/?*\[\]]', '_', name)
    s = s[:31] or "Sheet"
    base = s
    i = 1
    while s in used:
        suffix = f"_{i}"
        s = (base[:31-len(suffix)] + suffix)
        i += 1
    used.add(s)
    return s

engine = create_engine(PGURL)
used_names = set()

with engine.begin() as conn, pd.ExcelWriter("atlas_export.xlsx", engine="openpyxl") as writer:
    # Récupère toutes les tables
    tables = conn.execute(text("""
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_type='BASE TABLE'
          AND table_schema = ANY(:schemas)
        ORDER BY table_schema, table_name
    """), {"schemas": SCHEMAS}).fetchall()

    for schema, table in tables:
        fq = f'"{schema}"."{table}"'
        print(f"Export {fq} …")

        # Détection colonnes geometry/geography pour conversion GeoJSON
        geom_cols = [r[0] for r in conn.execute(text("""
            SELECT a.attname
            FROM pg_attribute a
            JOIN pg_class c ON a.attrelid=c.oid
            JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname=:schema AND c.relname=:table
              AND a.attnum>0 AND NOT a.attisdropped
              AND (format_type(a.atttypid, a.atttypmod)='geometry'
                   OR format_type(a.atttypid, a.atttypmod)='geography')
        """), {"schema": schema, "table": table}).fetchall()]

        # Build SELECT avec ST_AsGeoJSON pour les géoms
        if geom_cols:
            cols = conn.execute(text(f"""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema=:schema AND table_name=:table
                ORDER BY ordinal_position
            """), {"schema": schema, "table": table}).fetchall()
            select_list = []
            for (col,) in cols:
                if col in geom_cols:
                    select_list.append(f'ST_AsGeoJSON("{col}") AS "{col}"')
                else:
                    select_list.append(f'"{col}"')
            sql = f"SELECT {', '.join(select_list)} FROM {fq}"
        else:
            sql = f"SELECT * FROM {fq}"

        # ⚠️ Grosse table ? Faites-le par chunks si besoin
        df = pd.read_sql(sql, conn)
        
        # Convertir les colonnes datetime avec timezone en datetime sans timezone
        for col in df.columns:
            if pd.api.types.is_datetime64tz_dtype(df[col]):
                df[col] = df[col].dt.tz_localize(None)

        # Respect de la limite Excel (≈1,048,576 lignes/feuille)
        if len(df) > 1_048_000:
            start = 0
            part = 1
            while start < len(df):
                chunk = df.iloc[start:start+1_000_000]
                name = sheet_name_safe(f"{schema}.{table}_p{part}", used_names)
                chunk.to_excel(writer, index=False, sheet_name=name)
                start += 1_000_000
                part += 1
        else:
            name = sheet_name_safe(f"{schema}.{table}", used_names)
            df.to_excel(writer, index=False, sheet_name=name)

print("✅ Export terminé → atlas_export.xlsx")
