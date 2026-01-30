import argparse
import json
import os
import smtplib
import ssl
import time
from email.message import EmailMessage
from typing import Any, Dict, List, Optional, Tuple

try:
    import psycopg2  # type: ignore
    from psycopg2.extras import RealDictCursor  # type: ignore
    _DB_DRIVER = "psycopg2"
except Exception:  # pragma: no cover
    psycopg2 = None  # type: ignore
    RealDictCursor = None  # type: ignore
    _DB_DRIVER = "psycopg"

    import psycopg  # type: ignore
    from psycopg.rows import dict_row  # type: ignore


def get_env(name: str, default: Optional[str] = None) -> str:
    v = os.getenv(name)
    if v is None or v == "":
        if default is not None:
            return default
        raise RuntimeError(f"Missing env var: {name}")
    return v


def connect_db():
    dsn = get_env("DATABASE_URL")
    if _DB_DRIVER == "psycopg2":
        return psycopg2.connect(dsn)  # type: ignore
    conn = psycopg.connect(dsn)  # type: ignore
    conn.autocommit = False
    return conn


def _dict_cursor(conn):
    if _DB_DRIVER == "psycopg2":
        return conn.cursor(cursor_factory=RealDictCursor)  # type: ignore
    return conn.cursor(row_factory=dict_row)  # type: ignore


def db_log(cursor, job_id: str, level: str, message: str, details: Optional[Dict[str, Any]] = None):
    cursor.execute(
        """
        INSERT INTO atlas.colab_email_job_logs (job_id, level, message, details)
        VALUES (%s, %s, %s, %s::jsonb)
        """,
        (job_id, level, message, json.dumps(details or {})),
    )


def claim_next_job(conn) -> Optional[Dict[str, Any]]:
    with _dict_cursor(conn) as cur:
        cur.execute("BEGIN")
        cur.execute(
            """
            SELECT id, job_type, status, params
            FROM atlas.colab_email_jobs
            WHERE status = 'pending'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
            """
        )
        job = cur.fetchone()
        if not job:
            cur.execute("COMMIT")
            return None

        cur.execute(
            """
            UPDATE atlas.colab_email_jobs
            SET status = 'running', started_at = NOW(), error = NULL
            WHERE id = %s
            """,
            (job["id"],),
        )
        db_log(cur, str(job["id"]), "info", "Job démarré", {"job_type": job["job_type"]})
        cur.execute("COMMIT")
        return job


def fetch_recipients(conn, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    with _dict_cursor(conn) as cur:
        assignment_ids = params.get("assignment_ids") or []
        if isinstance(assignment_ids, list) and len(assignment_ids) > 0:
            cur.execute(
                """
                SELECT
                    d.assignment_id,
                    d.student_id,
                    d.full_name,
                    d.email,
                    d.maille_code,
                    m.adm3_name AS commune,
                    m.adm1_name AS region,
                    ST_YMin(ST_Transform(m.geom, 4326)::box3d) AS bbox_sud,
                    ST_YMax(ST_Transform(m.geom, 4326)::box3d) AS bbox_nord,
                    ST_XMin(ST_Transform(m.geom, 4326)::box3d) AS bbox_ouest,
                    ST_XMax(ST_Transform(m.geom, 4326)::box3d) AS bbox_est,
                    ST_Y(ST_Centroid(ST_Transform(m.geom, 4326))) AS centroid_lat,
                    ST_X(ST_Centroid(ST_Transform(m.geom, 4326))) AS centroid_lon
                FROM atlas.v_colab_maille_assignment_details d
                JOIN atlas.mailles m ON m.id = d.maille_id
                WHERE d.assignment_id = ANY(%s)
                  AND d.email IS NOT NULL AND d.email <> ''
                ORDER BY d.student_id
                """,
                (assignment_ids,),
            )
        else:
            cur.execute(
                """
                SELECT
                    d.assignment_id,
                    d.student_id,
                    d.full_name,
                    d.email,
                    d.maille_code,
                    m.adm3_name AS commune,
                    m.adm1_name AS region,
                    ST_YMin(ST_Transform(m.geom, 4326)::box3d) AS bbox_sud,
                    ST_YMax(ST_Transform(m.geom, 4326)::box3d) AS bbox_nord,
                    ST_XMin(ST_Transform(m.geom, 4326)::box3d) AS bbox_ouest,
                    ST_XMax(ST_Transform(m.geom, 4326)::box3d) AS bbox_est,
                    ST_Y(ST_Centroid(ST_Transform(m.geom, 4326))) AS centroid_lat,
                    ST_X(ST_Centroid(ST_Transform(m.geom, 4326))) AS centroid_lon
                FROM atlas.v_colab_maille_assignment_details d
                JOIN atlas.mailles m ON m.id = d.maille_id
                WHERE d.email IS NOT NULL AND d.email <> ''
                ORDER BY d.student_id
                """
            )
        rows = cur.fetchall()

    if params.get("limit"):
        try:
            lim = int(params["limit"])
            if lim > 0:
                return rows[:lim]
        except Exception:
            return rows

    return rows


def build_email(from_addr: str, to_addr: str, subject: str, body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.set_content(body)
    return msg


def send_gmail_smtp(messages: List[Tuple[str, EmailMessage]]):
    gmail_user = get_env("GMAIL_USER")
    gmail_app_password = get_env("GMAIL_APP_PASSWORD")

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
        server.login(gmail_user, gmail_app_password)
        for to_addr, msg in messages:
            server.send_message(msg)


def render_subject() -> str:
    return os.getenv("COLAB_NOTIFY_SUBJECT", "Affectation mission terrain – Atlas Géotechnique")


def compute_centroid_from_bbox(xmin: Any, ymin: Any, xmax: Any, ymax: Any) -> Optional[Tuple[float, float]]:
    try:
        if xmin is None or ymin is None or xmax is None or ymax is None:
            return None
        fxmin = float(xmin)
        fymin = float(ymin)
        fxmax = float(xmax)
        fymax = float(ymax)
        lat = (fymin + fymax) / 2.0
        lon = (fxmin + fxmax) / 2.0
        return (lat, lon)
    except Exception:
        return None


def build_google_maps_link(lat: float, lon: float) -> str:
    # Simple and robust: open Google Maps centered on coordinates
    return f"https://www.google.com/maps?q={lat},{lon}"


def render_body(recipient: Dict[str, Any], options: Dict[str, Any]) -> str:
    full_name = (recipient.get("full_name") or "").strip() or recipient.get("student_id")
    maille_code = recipient.get("maille_code")
    commune = recipient.get("commune")
    region = recipient.get("region")

    bbox_nord = recipient.get("bbox_nord")
    bbox_sud = recipient.get("bbox_sud")
    bbox_est = recipient.get("bbox_est")
    bbox_ouest = recipient.get("bbox_ouest")

    centroid_lat = recipient.get("centroid_lat")
    centroid_lon = recipient.get("centroid_lon")

    try:
        centroid_lat_f = float(centroid_lat) if centroid_lat is not None else None
        centroid_lon_f = float(centroid_lon) if centroid_lon is not None else None
    except Exception:
        centroid_lat_f = None
        centroid_lon_f = None

    maps_link = (
        build_google_maps_link(centroid_lat_f, centroid_lon_f)
        if centroid_lat_f is not None and centroid_lon_f is not None
        else ""
    )

    def fmt(v: Any) -> str:
        if v is None:
            return ""
        try:
            return f"{float(v):.6f}"
        except Exception:
            return str(v)

    return "\n".join(
        [
            f"Bonjour {full_name},",
            "",
            "Vous avez été affecté(e) à une mission de reconnaissance terrain dans le cadre du projet Atlas Géotechnique.",
            "",
            "📌 Détails de la mission",
            "- Type de mission : Reconnaissance géotechnique",
            f"- Maille assignée : {maille_code}",
            f"- Commune : {commune}",
            f"- Région : {region}",
            "",
            "🗺️ Zone de travail (emprise de la maille)",
            f"- Nord : {fmt(bbox_nord)}",
            f"- Sud : {fmt(bbox_sud)}",
            f"- Est : {fmt(bbox_est)}",
            f"- Ouest : {fmt(bbox_ouest)}",
            "",
            "📍 Accès rapide à la zone sur Google Maps",
            maps_link,
            "",
            "(Le lien vous positionne automatiquement au centre de la maille.)",
            "",
            "Merci de confirmer la bonne réception de cette mission et de procéder aux travaux terrain conformément aux consignes du projet.",
            "",
            "En cas de difficulté ou d’ambiguïté sur la zone, merci de contacter l’équipe de coordination.",
            "",
            "Bonne mission et bon travail sur le terrain.",
            "",
            "Cordialement,",
            "L’équipe Atlas Géotechnique",
        ]
    )


def mark_assignment_log(conn, job_id: str, assignment_id: str, status: str, error: Optional[str] = None):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE atlas.colab_maille_notification_logs
            SET status = %s,
                sent_at = CASE WHEN %s IN ('sent','failed','skipped') THEN NOW() ELSE sent_at END,
                error = %s
            WHERE assignment_id = %s AND email_job_id = %s
            """,
            (status, status, error, assignment_id, job_id),
        )
        conn.commit()


def complete_job(conn, job_id: str, status: str, error: Optional[str] = None):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE atlas.colab_email_jobs
            SET status = %s, finished_at = NOW(), error = %s
            WHERE id = %s
            """,
            (status, error, job_id),
        )
        conn.commit()


def process_job(conn, job: Dict[str, Any]) -> None:
    job_id = str(job["id"])
    params = job.get("params") or {}

    options = params.get("options") or {}

    with _dict_cursor(conn) as cur:
        db_log(cur, job_id, "info", "Récupération des destinataires", {})
        conn.commit()

    recipients = fetch_recipients(conn, params)

    from_addr = os.getenv("GMAIL_FROM", os.getenv("GMAIL_USER", ""))
    if not from_addr:
        raise RuntimeError("Missing env var: GMAIL_FROM (or GMAIL_USER)")

    dry_run = str(os.getenv("COLAB_NOTIFY_DRY_RUN", "false")).lower() in ("1", "true", "yes")

    messages: List[Tuple[str, EmailMessage]] = []
    for r in recipients:
        to_addr = r.get("email")
        if not to_addr:
            continue
        subject = render_subject()
        body = render_body(r, options)
        msg = build_email(from_addr, to_addr, subject, body)
        messages.append((to_addr, msg))

    with _dict_cursor(conn) as cur:
        db_log(cur, job_id, "info", "Emails préparés", {"count": len(messages), "dry_run": dry_run})
        conn.commit()

    if dry_run:
        for to_addr, _msg in messages:
            with _dict_cursor(conn) as cur:
                db_log(cur, job_id, "info", "DRY_RUN: email non envoyé", {"to": to_addr})
                conn.commit()
        for r in recipients:
            assignment_id = r.get("assignment_id")
            if assignment_id:
                mark_assignment_log(conn, job_id, str(assignment_id), "skipped", None)
        complete_job(conn, job_id, "completed", None)
        return

    try:
        send_gmail_smtp(messages)
    except Exception as e:
        for r in recipients:
            assignment_id = r.get("assignment_id")
            if assignment_id:
                mark_assignment_log(conn, job_id, str(assignment_id), "failed", str(e))
        raise

    with _dict_cursor(conn) as cur:
        for r in recipients:
            to_addr = r.get("email")
            if not to_addr:
                continue
            db_log(cur, job_id, "info", "Email envoyé", {"to": to_addr})
        conn.commit()

    for r in recipients:
        assignment_id = r.get("assignment_id")
        if assignment_id:
            mark_assignment_log(conn, job_id, str(assignment_id), "sent", None)

    complete_job(conn, job_id, "completed", None)


def run_once() -> int:
    conn = connect_db()
    try:
        job = claim_next_job(conn)
        if not job:
            return 0

        try:
            process_job(conn, job)
            return 1
        except Exception as e:
            with _dict_cursor(conn) as cur:
                db_log(cur, str(job["id"]), "error", "Job failed", {"error": str(e)})
                conn.commit()
            complete_job(conn, str(job["id"]), "failed", str(e))
            return 1
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--sleep", type=float, default=5.0)
    args = parser.parse_args()

    if not args.loop:
        run_once()
        return

    while True:
        processed = run_once()
        if processed == 0:
            time.sleep(args.sleep)


if __name__ == "__main__":
    main()
