"""
import_metrics.py - Métriques et logs structurés pour l'import AMESSEFE

Ce module fournit :
1. Tracking des phases d'import avec timestamps
2. Compteurs de lignes insérées/erreurs
3. Export JSON du rapport d'import
4. Logs formatés pour humains
"""

import json
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from enum import Enum


class PhaseStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL = "partial"  # Certaines localités en erreur
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class PhaseMetrics:
    """Métriques pour une phase d'import."""
    name: str
    description: str = ""
    status: PhaseStatus = PhaseStatus.PENDING
    
    # Timestamps
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    
    # Compteurs
    excel_records: int = 0
    excel_localites: int = 0
    db_inserts: int = 0
    db_updates: int = 0
    db_skipped: int = 0
    errors: int = 0
    
    # Détails erreurs
    error_details: List[Dict] = field(default_factory=list)
    
    # Localités concernées
    localites_ok: List[str] = field(default_factory=list)
    localites_error: List[str] = field(default_factory=list)
    
    @property
    def duration_s(self) -> Optional[float]:
        if self.start_time and self.end_time:
            return round(self.end_time - self.start_time, 2)
        return None
    
    @property
    def duration_str(self) -> str:
        d = self.duration_s
        if d is None:
            return "-"
        if d < 60:
            return f"{d:.1f}s"
        return f"{int(d // 60)}m {int(d % 60)}s"
    
    def start(self):
        self.status = PhaseStatus.RUNNING
        self.start_time = time.time()
    
    def finish(self, success: bool = True):
        self.end_time = time.time()
        if self.errors > 0 and self.db_inserts > 0:
            self.status = PhaseStatus.PARTIAL
        elif self.errors > 0:
            self.status = PhaseStatus.FAILED
        elif success:
            self.status = PhaseStatus.SUCCESS
        else:
            self.status = PhaseStatus.FAILED
    
    def add_error(self, localite: str, depth: float, message: str):
        self.errors += 1
        self.error_details.append({
            "localite": localite,
            "depth": depth,
            "message": message,
            "timestamp": datetime.now().isoformat(),
        })
        if localite not in self.localites_error:
            self.localites_error.append(localite)
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "status": self.status.value,
            "duration_s": self.duration_s,
            "excel_records": self.excel_records,
            "excel_localites": self.excel_localites,
            "db_inserts": self.db_inserts,
            "db_updates": self.db_updates,
            "db_skipped": self.db_skipped,
            "errors": self.errors,
            "localites_ok_count": len(self.localites_ok),
            "localites_error_count": len(self.localites_error),
            "error_details": self.error_details[:10],  # Limiter à 10 erreurs
        }


@dataclass
class ImportReport:
    """Rapport complet d'import."""
    script_version: str = "v4.0"
    source: str = "AMESSEFE Komi Yoan Freddy"
    
    # Timestamps
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    datetime_execution: str = ""
    
    # Mode
    dry_run: bool = False
    
    # Phases
    phases: Dict[str, PhaseMetrics] = field(default_factory=dict)
    
    # Résumé global
    total_localites: int = 0
    total_inserts: int = 0
    total_errors: int = 0
    
    # Schéma
    schema_valid: bool = False
    
    def __post_init__(self):
        self.datetime_execution = datetime.now().isoformat()
    
    @property
    def duration_s(self) -> Optional[float]:
        if self.start_time and self.end_time:
            return round(self.end_time - self.start_time, 2)
        return None
    
    @property
    def is_success(self) -> bool:
        return self.total_errors == 0 and self.schema_valid
    
    def add_phase(self, name: str, description: str = "") -> PhaseMetrics:
        phase = PhaseMetrics(name=name, description=description)
        self.phases[name] = phase
        return phase
    
    def get_phase(self, name: str) -> Optional[PhaseMetrics]:
        return self.phases.get(name)
    
    def compute_totals(self):
        self.total_inserts = sum(p.db_inserts + p.db_updates for p in self.phases.values())
        self.total_errors = sum(p.errors for p in self.phases.values())
    
    def to_dict(self) -> dict:
        self.compute_totals()
        return {
            "script_version": self.script_version,
            "source": self.source,
            "datetime_execution": self.datetime_execution,
            "duration_s": self.duration_s,
            "dry_run": self.dry_run,
            "schema_valid": self.schema_valid,
            "total_localites": self.total_localites,
            "total_inserts": self.total_inserts,
            "total_errors": self.total_errors,
            "is_success": self.is_success,
            "phases": {name: p.to_dict() for name, p in self.phases.items()},
        }
    
    def save_json(self, path: Path):
        """Sauvegarde le rapport en JSON."""
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)


class ImportLogger:
    """Logger formaté pour l'import AMESSEFE."""
    
    def __init__(self, report: ImportReport):
        self.report = report
        self._current_phase: Optional[PhaseMetrics] = None
    
    def header(self):
        ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        mode = " (DRY-RUN)" if self.report.dry_run else ""
        print()
        print("=" * 60)
        print(f"🚀 IMPORT AMESSEFE {self.report.script_version}{mode}")
        print(f"   {ts}")
        print("=" * 60)
    
    def schema_ok(self):
        print("\n✅ Schéma validé")
    
    def schema_fail(self):
        print("\n❌ Schéma invalide - Import ANNULÉ")
    
    def phase_start(self, phase: PhaseMetrics):
        self._current_phase = phase
        phase.start()
        print(f"\n-- Phase {phase.name}: {phase.description} --")
    
    def phase_progress(self, message: str):
        print(f"   {message}")
    
    def phase_end(self, phase: PhaseMetrics):
        phase.finish()
        status_icon = {
            PhaseStatus.SUCCESS: "✅",
            PhaseStatus.PARTIAL: "⚠️",
            PhaseStatus.FAILED: "❌",
            PhaseStatus.SKIPPED: "⏭️",
        }.get(phase.status, "❓")
        
        print(f"   {status_icon} Excel: {phase.excel_records} records / {phase.excel_localites} localités")
        print(f"      DB: {phase.db_inserts} inserts, {phase.db_updates} updates, "
              f"{phase.errors} erreurs ({phase.duration_str})")
        
        if phase.errors > 0 and phase.error_details:
            print(f"      Erreurs sur: {', '.join(phase.localites_error[:5])}"
                  + ("..." if len(phase.localites_error) > 5 else ""))
    
    def error(self, localite: str, depth: float, message: str):
        if self._current_phase:
            self._current_phase.add_error(localite, depth, message)
        print(f"   ❌ {localite}@{depth}m: {message}")
    
    def summary(self):
        self.report.compute_totals()
        print()
        print("=" * 60)
        print("📊 RÉSUMÉ")
        print("=" * 60)
        
        for name, phase in self.report.phases.items():
            status_icon = {
                PhaseStatus.SUCCESS: "✅",
                PhaseStatus.PARTIAL: "⚠️",
                PhaseStatus.FAILED: "❌",
                PhaseStatus.SKIPPED: "⏭️",
                PhaseStatus.PENDING: "⏳",
            }.get(phase.status, "❓")
            print(f"   {status_icon} {name:<12} {phase.db_inserts:>4} inserts, "
                  f"{phase.errors:>3} erreurs ({phase.duration_str})")
        
        print()
        print(f"   Total: {self.report.total_inserts} inserts, {self.report.total_errors} erreurs")
        
        if self.report.duration_s:
            print(f"   Durée totale: {self.report.duration_s:.1f}s")
        
        if self.report.is_success:
            print("\n✅ IMPORT TERMINÉ AVEC SUCCÈS")
        elif self.report.total_errors > 0 and self.report.total_inserts > 0:
            print(f"\n⚠️ IMPORT PARTIEL ({self.report.total_errors} erreurs)")
        else:
            print("\n❌ IMPORT ÉCHOUÉ")
    
    def report_saved(self, path: Path):
        print(f"\n📄 Rapport sauvegardé: {path}")


# =============================================================================
# FACTORY
# =============================================================================

def create_import_session(dry_run: bool = False) -> tuple[ImportReport, ImportLogger]:
    """Crée une session d'import avec rapport et logger."""
    report = ImportReport(dry_run=dry_run)
    logger = ImportLogger(report)
    return report, logger


# =============================================================================
# TEST
# =============================================================================

if __name__ == "__main__":
    # Simulation d'un import
    report, logger = create_import_session(dry_run=True)
    
    logger.header()
    
    # Phase sondages
    phase = report.add_phase("sondages", "Création des sondages")
    logger.phase_start(phase)
    phase.excel_localites = 92
    phase.db_inserts = 92
    time.sleep(0.1)
    logger.phase_end(phase)
    
    # Phase VBS
    phase = report.add_phase("vbs", "Import VBS")
    logger.phase_start(phase)
    phase.excel_records = 224
    phase.excel_localites = 75
    phase.db_inserts = 220
    phase.errors = 4
    phase.localites_error = ["test1", "test2"]
    time.sleep(0.1)
    logger.phase_end(phase)
    
    logger.summary()
    
    # Sauvegarder
    report_path = Path("data/xlsx/test_import_report.json")
    report.save_json(report_path)
    logger.report_saved(report_path)
