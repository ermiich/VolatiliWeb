import shlex
import traceback
from datetime import datetime, timezone
from sqlalchemy import select

from app.celery_app import celery_app
from app.config import settings
from app.database import SessionLocal
from app.models.dump import Dump, DumpStatus
from app.models.plugin_execution import PluginExecution, ExecutionStatus
from app.tasks.volatility_runner import execute_volatility_plugin


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
def run_plugin(self, execution_id: str, plugin_class_path: str | None = None):
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

        extra_args = shlex.split(execution.command_suffix) if execution.command_suffix else None
        resolved_class_path = plugin_class_path or execution.plugin_name
        if resolved_class_path == execution.plugin_name and resolved_class_path.count(".") < 2:
            raise RuntimeError(f"Plugin '{execution.plugin_name}' no encontrado")
        result = execute_volatility_plugin(
            dump.file_path,
            resolved_class_path,
            settings.symbols_path,
            extra_args=extra_args,
        )

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
