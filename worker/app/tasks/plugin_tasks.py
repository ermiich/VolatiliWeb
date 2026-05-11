import traceback
from datetime import datetime, timezone
from sqlalchemy import select

from app.celery_app import celery_app
from app.config import settings
from app.database import SessionLocal
from app.models.dump import Dump, DumpStatus
from app.models.plugin_execution import PluginExecution, ExecutionStatus
from app.tasks.volatility_runner import execute_volatility_plugin


PLUGIN_CATALOG = [
    {
        "name": "windows.info.Info",
        "display_name": "System Info",
        "description": "Informacion general del sistema operativo y el volcado",
        "class_path": "windows.info.Info",
        "os": "windows",
    },
    {
        "name": "windows.pslist.PsList",
        "display_name": "Process List",
        "description": "Lista de procesos activos al momento del volcado",
        "class_path": "windows.pslist.PsList",
        "os": "windows",
    },
    {
        "name": "windows.pstree.PsTree",
        "display_name": "Process Tree",
        "description": "Arbol de procesos con jerarquia padre-hijo",
        "class_path": "windows.pstree.PsTree",
        "os": "windows",
    },
    {
        "name": "windows.netscan.NetScan",
        "display_name": "Network Scan",
        "description": "Conexiones de red activas y sockets",
        "class_path": "windows.netscan.NetScan",
        "os": "windows",
    },
    {
        "name": "windows.cmdline.CmdLine",
        "display_name": "Command Lines",
        "description": "Argumentos de linea de comandos de cada proceso",
        "class_path": "windows.cmdline.CmdLine",
        "os": "windows",
    },
    {
        "name": "windows.dlllist.DllList",
        "display_name": "DLL List",
        "description": "DLLs cargadas por cada proceso",
        "class_path": "windows.dlllist.DllList",
        "os": "windows",
    },
    {
        "name": "windows.malfind.Malfind",
        "display_name": "Malfind (lento)",
        "description": "Detecta regiones de memoria con posible codigo inyectado",
        "class_path": "windows.malfind.Malfind",
        "os": "windows",
    },
]


def _get_plugin_class_path(plugin_name: str) -> str | None:
    if plugin_name.startswith("windows."):
        return plugin_name
    for plugin in PLUGIN_CATALOG:
        if plugin["name"] == plugin_name:
            return plugin["class_path"]
    return None


@celery_app.task(bind=True, name="detect_os")
def detect_os(self, dump_id: str):
    session = SessionLocal()
    try:
        dump = session.execute(select(Dump).where(Dump.id == dump_id)).scalar_one_or_none()
        if dump is None:
            return

        dump.status = DumpStatus.detecting
        session.commit()

        result = execute_volatility_plugin(
            dump.file_path,
            "windows.info.Info",
            settings.symbols_path,
        )

        detected_version = None
        for row in result.get("rows", []):
            if row.get("Variable") in {"Major/Minor", "Version", "Build"}:
                detected_version = row.get("Value")
                break

        dump.detected_os = "windows"
        dump.detected_os_version = detected_version
        dump.status = DumpStatus.ready
        dump.error_message = None
        session.commit()

    except Exception as exc:
        session.rollback()
        dump = session.execute(select(Dump).where(Dump.id == dump_id)).scalar_one_or_none()
        if dump is not None:
            dump.status = DumpStatus.error
            dump.error_message = str(exc)
            session.commit()
    finally:
        session.close()


@celery_app.task(bind=True, name="run_plugin")
def run_plugin(self, execution_id: str):
    session = SessionLocal()
    try:
        execution = session.execute(
            select(PluginExecution).where(PluginExecution.id == execution_id)
        ).scalar_one_or_none()
        if execution is None:
            return

        dump = session.execute(select(Dump).where(Dump.id == execution.dump_id)).scalar_one_or_none()
        if dump is None:
            return

        execution.status = ExecutionStatus.running
        execution.started_at = datetime.now(timezone.utc)
        session.commit()

        class_path = _get_plugin_class_path(execution.plugin_name)
        if class_path is None:
            raise RuntimeError(f"Plugin '{execution.plugin_name}' no encontrado")

        result = execute_volatility_plugin(dump.file_path, class_path, settings.symbols_path)

        execution.status = ExecutionStatus.completed
        execution.result_data = result.get("rows")
        execution.result_row_count = len(result.get("rows", []))
        execution.completed_at = datetime.now(timezone.utc)
        session.commit()

    except Exception as exc:
        session.rollback()
        execution = session.execute(
            select(PluginExecution).where(PluginExecution.id == execution_id)
        ).scalar_one_or_none()
        if execution is not None:
            execution.status = ExecutionStatus.failed
            execution.error_message = str(exc)[:500]
            execution.error_traceback = traceback.format_exc()
            execution.completed_at = datetime.now(timezone.utc)
            session.commit()
    finally:
        session.close()
