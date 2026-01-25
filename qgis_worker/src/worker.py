import os
import sys
import time
import signal
from typing import Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from qgis.core import (
    QgsApplication,
    QgsProject,
    QgsLayoutExporter,
    QgsDataSourceUri,
    QgsVectorLayer,
    QgsRuleBasedRenderer,
)
from qgis.PyQt.QtXml import QDomDocument
from qgis.core import QgsPrintLayout, QgsReadWriteContext
from qgis.core import QgsLayoutItemMap
from qgis.core import QgsLayoutItemLegend
from qgis.PyQt.QtGui import QColor
from qgis.PyQt.QtCore import Qt
from qgis.core import QgsLayoutPoint, QgsLayoutSize, QgsUnitTypes
from qgis.core import QgsLayoutItemScaleBar


POLL_INTERVAL_SECONDS = float(os.getenv("POLL_INTERVAL", "2"))

run_flag = True


def _signal_handler(sig, frame):
    global run_flag
    print("[Worker] Arrêt demandé...", flush=True)
    run_flag = False


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    v = os.getenv(name)
    if v is None or v == "":
        return default
    return v


def _ensure_layout_from_template(project: QgsProject, template_path: str, expected_layout_name: Optional[str] = None) -> str:
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"QGIS_TEMPLATE not found: {template_path}")

    with open(template_path, "r", encoding="utf-8") as f:
        xml = f.read()

    doc = QDomDocument()
    if not doc.setContent(xml):
        raise RuntimeError("Failed to parse QPT XML")

    layout = QgsPrintLayout(project)
    layout.initializeDefaults()

    ctx = QgsReadWriteContext()
    # QPT templates can include their own name; we can override after load.
    layout.loadFromTemplate(doc, ctx)

    # Derive name: prefer explicit env, else keep template name.
    if expected_layout_name:
        layout.setName(expected_layout_name)
    elif not layout.name():
        layout.setName("atlas_base_skeleton")

    project.layoutManager().addLayout(layout)
    return layout.name()


def _get_db_connection() -> psycopg2.extensions.connection:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is required")
    conn = psycopg2.connect(dsn)
    conn.autocommit = True

    # Make behavior explicit even if we schema-qualify in queries.
    try:
        with conn.cursor() as cur:
            cur.execute("SET search_path TO atlas, public")
    except Exception:
        # Non-fatal: some roles may not have rights, but keep going.
        pass

    return conn


def _db_sanity_check(conn) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute("select current_database(), current_user, to_regclass('atlas.export_jobs')")
            db, user, reg = cur.fetchone()
            print(f"[Worker] DB sanity: db={db} user={user} atlas.export_jobs={reg}", flush=True)
    except Exception as e:
        print(f"[Worker] DB sanity check failed: {e}", flush=True)


def _fetch_pending_job(conn) -> Optional[dict]:
    """Atomically claim a PENDING job and return it (id + payload)."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            UPDATE atlas.export_jobs
            SET status = 'PROCESSING', updated_at = NOW()
            WHERE id = (
                SELECT id
                FROM atlas.export_jobs
                WHERE status = 'PENDING'
                ORDER BY created_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            RETURNING id, payload;
            """
        )
        return cur.fetchone()


def _finish_job(conn, job_id: str, status: str, result_path: Optional[str] = None, error: Optional[str] = None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE atlas.export_jobs
            SET status = %s, result_path = %s, error_log = %s, updated_at = NOW()
            WHERE id = %s
            """,
            (status, result_path, error, job_id),
        )


def _load_postgis_layer(project: QgsProject) -> QgsVectorLayer:
    host = _env("QGIS_PG_HOST", _env("PGHOST", "db"))
    port = _env("QGIS_PG_PORT", _env("PGPORT", "5432"))
    database = _env("QGIS_PG_DATABASE", _env("PGDATABASE", "atlas_clean"))
    username = _env("QGIS_PG_USER", _env("PGUSER", "atlas"))
    password = _env("QGIS_PG_PASSWORD", _env("PGPASSWORD", "atlas"))

    schema = _env("QGIS_PG_SCHEMA", "atlas")
    table = _env("QGIS_PG_TABLE", "mailles")
    geom_column = _env("QGIS_PG_GEOM", "geom")
    key_column = _env("QGIS_PG_KEY", "id")
    srid = _env("QGIS_PG_SRID", "25231")

    uri = QgsDataSourceUri()
    uri.setConnection(host, port, database, username, password)
    uri.setDataSource(schema, table, geom_column, "", key_column)
    try:
        uri.setSrid(srid)
    except Exception:
        # setSrid can vary across QGIS versions; non-fatal.
        pass

    layer_name = _env("QGIS_LAYER_NAME", f"{schema}.{table}")
    layer = QgsVectorLayer(uri.uri(False), layer_name, "postgres")

    print(
        f"[Worker] PostGIS layer: name={layer_name} schema={schema} table={table} geom={geom_column} srid={srid}",
        flush=True,
    )
    print(f"[Worker] PostGIS layer isValid={layer.isValid()}", flush=True)
    if not layer.isValid():
        raise RuntimeError("Couche PostGIS invalide (check QGIS_PG_* env + provider postgres)")

    project.addMapLayer(layer)

    try:
        feature_count = layer.featureCount()
    except Exception:
        feature_count = -1
    extent = layer.extent()

    print(f"[Worker] PostGIS layer featureCount={feature_count}", flush=True)
    print(
        f"[Worker] PostGIS layer extent={extent.xMinimum()},{extent.yMinimum()},{extent.xMaximum()},{extent.yMaximum()}",
        flush=True,
    )

    if feature_count == 0:
        raise RuntimeError("PostGIS layer vide (featureCount=0) — échec anti-illusion")

    return layer


def _apply_style(layer: QgsVectorLayer, style_data: dict) -> None:
    style_type = (style_data or {}).get("type")
    if style_type != "rule_based":
        raise RuntimeError(f"Style non supporté: {style_type}")

    rules = (style_data or {}).get("rules") or []
    if not isinstance(rules, list) or len(rules) == 0:
        raise RuntimeError("Style rule_based invalide: rules manquantes")

    root_rule = QgsRuleBasedRenderer.Rule(None)
    for r in rules:
        if not isinstance(r, dict):
            raise RuntimeError("Style rule_based invalide: une rule n'est pas un objet")

        label = r.get("label")
        color_hex = r.get("color")
        filter_exp = r.get("filter_exp")

        if not label or not color_hex or not filter_exp:
            raise RuntimeError("Style rule_based invalide: label/color/filter_exp requis")

        symbol = layer.renderer().symbol().clone() if layer.renderer() and layer.renderer().symbol() else None
        if symbol is None:
            symbol = QgsRuleBasedRenderer.defaultSymbol(layer.geometryType())

        symbol.setColor(QColor(color_hex))
        _remove_symbol_stroke(symbol)

        child = QgsRuleBasedRenderer.Rule(symbol)
        child.setLabel(label)
        child.setFilterExpression(filter_exp)
        root_rule.appendChild(child)

    renderer = QgsRuleBasedRenderer(root_rule)
    layer.setRenderer(renderer)
    layer.triggerRepaint()


def _remove_symbol_stroke(symbol) -> None:
    if symbol is None:
        return
    try:
        sl = symbol.symbolLayer(0)
        if sl is None:
            return

        if hasattr(sl, "setStrokeStyle"):
            sl.setStrokeStyle(Qt.NoPen)

        if hasattr(sl, "setStrokeWidth"):
            sl.setStrokeWidth(0)

        if hasattr(sl, "setStrokeColor"):
            sl.setStrokeColor(QColor(0, 0, 0, 0))
    except Exception:
        pass


def force_layout_metrics(layout: QgsPrintLayout, vlayer: QgsVectorLayer) -> None:
    print("[Worker] 📐 Application du Layout 'Code-First'...", flush=True)

    PAGE_WIDTH = 210
    MARGIN = 10
    CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN)

    title = layout.itemById("TitleLabel")
    if title:
        try:
            title.attemptMove(QgsLayoutPoint(MARGIN, MARGIN, QgsUnitTypes.LayoutMillimeters))
            title.attemptResize(QgsLayoutSize(CONTENT_WIDTH, 20, QgsUnitTypes.LayoutMillimeters))
        except Exception:
            pass

    map_item = layout.itemById("MainMap")
    if isinstance(map_item, QgsLayoutItemMap):
        map_y = 35
        map_height = 230
        try:
            map_item.attemptMove(QgsLayoutPoint(MARGIN, map_y, QgsUnitTypes.LayoutMillimeters))
            map_item.attemptResize(QgsLayoutSize(CONTENT_WIDTH, map_height, QgsUnitTypes.LayoutMillimeters))
        except Exception:
            pass

        try:
            map_item.setCrs(vlayer.crs())
        except Exception:
            pass

        try:
            extent = vlayer.extent()
            extent.grow(extent.width() * 0.05)
            map_item.zoomToExtent(extent)
            print(f"[Worker] 🔍 Zoom forcé sur : {extent.toString()}", flush=True)
        except Exception as e:
            print(f"[Worker] ⚠️ Zoom forcé impossible: {e}", flush=True)

    scale = layout.itemById("ScaleBar")
    if isinstance(scale, QgsLayoutItemScaleBar):
        try:
            scale.setUnits(QgsUnitTypes.DistanceKilometers)
            scale.setUnitLabel("km")
            scale.setMapUnitsPerScaleBarUnit(1000)
        except Exception:
            pass
        try:
            scale.attemptMove(QgsLayoutPoint(140, 255, QgsUnitTypes.LayoutMillimeters))
        except Exception:
            pass
        try:
            scale.update()
        except Exception:
            pass

    legend = layout.itemById("MainLegend")
    if legend:
        try:
            legend.attemptMove(QgsLayoutPoint(MARGIN + 5, 220, QgsUnitTypes.LayoutMillimeters))
        except Exception:
            pass


def _refresh_legend(layout: QgsPrintLayout, map_item: QgsLayoutItemMap) -> None:
    legend = layout.itemById("MainLegend")
    if not isinstance(legend, QgsLayoutItemLegend):
        return
    try:
        legend.setLinkedMap(map_item)
    except Exception:
        pass

    try:
        legend.refresh()
    except Exception:
        pass


def _set_layout_label_text(layout: QgsPrintLayout, item_id: str, text: Optional[str]) -> None:
    if text is None:
        return
    item = layout.itemById(item_id)
    if item is None:
        return
    try:
        item.setText(text)
    except Exception:
        pass


def _apply_grid(map_item: QgsLayoutItemMap, grid_data: Optional[dict]) -> None:
    if not grid_data or not isinstance(grid_data, dict):
        return
    if grid_data.get("enabled") is False:
        return

    interval = grid_data.get("interval")
    if interval is None:
        interval = 2000

    try:
        interval = float(interval)
    except Exception:
        interval = 2000

    try:
        grids = map_item.grids()
        # Ensure at least one grid exists
        if getattr(grids, "size", lambda: 0)() == 0:
            grid = grids.addGrid("grid")
        else:
            grid = grids.grid(0)

        grid.setEnabled(True)

        # CRS units: here we assume meters (SRID 25231). Interval is also in map units.
        if hasattr(grid, "setIntervalX"):
            grid.setIntervalX(interval)
        if hasattr(grid, "setIntervalY"):
            grid.setIntervalY(interval)
    except Exception:
        # Non-fatal: grid API differs per QGIS version/template
        pass


def _process_job(project: QgsProject, job: dict) -> str:
    job_id = str(job["id"])
    payload = job.get("payload") or {}

    print(f"[Worker] ⚙️ Traitement du Job {job_id}...", flush=True)

    layout_name = _env("QGIS_LAYOUT", "atlas_base_skeleton")
    layout = project.layoutManager().layoutByName(layout_name)
    if layout is None:
        raise RuntimeError(f"Layout '{layout_name}' introuvable")

    layer = _load_postgis_layer(project)
    layer.setName(payload.get("layer_name", "Mailles Géotechniques"))
    map_item = layout.itemById("MainMap")
    if isinstance(map_item, QgsLayoutItemMap):
        map_item.setLayers([layer])
    else:
        raise RuntimeError("Layout item 'MainMap' introuvable ou pas une carte")

    style_data = payload.get("style")
    if style_data:
        _apply_style(layer, style_data)

    _apply_grid(map_item, payload.get("grid"))

    force_layout_metrics(layout, layer)

    _refresh_legend(layout, map_item)

    _set_layout_label_text(layout, "TitleLabel", payload.get("title", "Titre par défaut"))

    _set_layout_label_text(layout, "SubtitleLabel", payload.get("subtitle"))
    _set_layout_label_text(layout, "FooterLabel", payload.get("footer"))

    output_path = f"/data/exports/job_{job_id}.pdf"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    exporter = QgsLayoutExporter(layout)
    result = exporter.exportToPdf(output_path, QgsLayoutExporter.PdfExportSettings())
    if result != QgsLayoutExporter.Success:
        raise RuntimeError("Échec de l'export QGIS")

    return output_path


def main() -> int:
    print("[Worker] 🚀 Démarrage...", flush=True)

    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    QgsApplication.setPrefixPath("/usr", True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        project = QgsProject.instance()
        template_path = _env("QGIS_TEMPLATE", "/app/templates/atlas_base_skeleton.qpt")
        requested_layout_name = _env("QGIS_LAYOUT", "atlas_base_skeleton")
        actual_layout_name = _ensure_layout_from_template(project, template_path, expected_layout_name=requested_layout_name)
        print(f"[Worker] ✅ Layout prêt : {actual_layout_name}", flush=True)

        conn = _get_db_connection()
        print("[Worker] ✅ Connexion DB OK", flush=True)
        _db_sanity_check(conn)

        while run_flag:
            try:
                job = _fetch_pending_job(conn)
            except Exception as e:
                print(f"[Worker] ❌ Erreur fetch_job: {e}", flush=True)
                time.sleep(POLL_INTERVAL_SECONDS)
                continue

            if job:
                try:
                    output_file = _process_job(project, job)
                    _finish_job(conn, str(job["id"]), "COMPLETED", result_path=output_file)
                    print(f"[Worker] ✅ Job {job['id']} terminé !", flush=True)
                except Exception as e:
                    print(f"[Worker] ❌ Job {job['id']} échoué : {e}", flush=True)
                    _finish_job(conn, str(job["id"]), "FAILED", error=str(e))
            else:
                time.sleep(POLL_INTERVAL_SECONDS)

        conn.close()
        return 0

    finally:
        qgs.exitQgis()
        print("[Worker] 👋 Fin du worker.", flush=True)


if __name__ == "__main__":
    sys.exit(main())
