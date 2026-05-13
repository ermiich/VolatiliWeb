import re
import shlex

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.config import settings
from app.database import get_async_session
from app.models.dump import Dump, DumpStatus
from app.models.plugin_execution import PluginExecution, ExecutionStatus
from app.schemas.plugin_execution import PluginExecutionRequest, PluginExecutionResponse
from celery import Celery


router = APIRouter()

_celery_app = None


def get_celery_app() -> Celery:
    global _celery_app
    if _celery_app is None:
        _celery_app = Celery("volatiliweb_api", broker=settings.celery_broker_url)
    return _celery_app

WINDOWS_PLUGIN_CLASS_PATHS = [
    "windows.amcache.Amcache",
    "windows.bigpools.BigPools",
    "windows.callbacks.Callbacks",
    "windows.cmdline.CmdLine",
    "windows.cmdscan.CmdScan",
    "windows.consoles.Consoles",
    "windows.crashinfo.Crashinfo",
    "windows.debugregisters.DebugRegisters",
    "windows.deskscan.DeskScan",
    "windows.desktops.Desktops",
    "windows.devicetree.DeviceTree",
    "windows.dlllist.DllList",
    "windows.driverirp.DriverIrp",
    "windows.drivermodule.DriverModule",
    "windows.driverscan.DriverScan",
    "windows.dumpfiles.DumpFiles",
    "windows.envars.Envars",
    "windows.etwpatch.EtwPatch",
    "windows.filescan.FileScan",
    "windows.getservicesids.GetServiceSIDs",
    "windows.getsids.GetSIDs",
    "windows.handles.Handles",
    "windows.hollowprocesses.HollowProcesses",
    "windows.iat.IAT",
    "windows.info.Info",
    "windows.joblinks.JobLinks",
    "windows.kpcrs.KPCRs",
    "windows.ldrmodules.LdrModules",
    "windows.malfind.Malfind",
    "windows.malware.drivermodule.DriverModule",
    "windows.malware.hollowprocesses.HollowProcesses",
    "windows.malware.ldrmodules.LdrModules",
    "windows.malware.malfind.Malfind",
    "windows.malware.pebmasquerade.PebMasquerade",
    "windows.malware.processghosting.ProcessGhosting",
    "windows.malware.psxview.PsXView",
    "windows.malware.skeleton_key_check.Skeleton_Key_Check",
    "windows.malware.suspicious_threads.SuspiciousThreads",
    "windows.malware.svcdiff.SvcDiff",
    "windows.malware.unhooked_system_calls.UnhookedSystemCalls",
    "windows.mbrscan.MBRScan",
    "windows.memmap.Memmap",
    "windows.modscan.ModScan",
    "windows.modules.Modules",
    "windows.mutantscan.MutantScan",
    "windows.netscan.NetScan",
    "windows.netstat.NetStat",
    "windows.orphan_kernel_threads.Threads",
    "windows.pe_symbols.PESymbols",
    "windows.pedump.PEDump",
    "windows.poolscanner.PoolScanner",
    "windows.privileges.Privs",
    "windows.processghosting.ProcessGhosting",
    "windows.pslist.PsList",
    "windows.psscan.PsScan",
    "windows.pstree.PsTree",
    "windows.psxview.PsXView",
    "windows.registry.amcache.Amcache",
    "windows.registry.certificates.Certificates",
    "windows.registry.getcellroutine.GetCellRoutine",
    "windows.registry.hivelist.HiveList",
    "windows.registry.hivescan.HiveScan",
    "windows.registry.printkey.PrintKey",
    "windows.registry.scheduled_tasks.ScheduledTasks",
    "windows.registry.userassist.UserAssist",
    "windows.scheduled_tasks.ScheduledTasks",
    "windows.sessions.Sessions",
    "windows.shimcachemem.ShimcacheMem",
    "windows.skeleton_key_check.Skeleton_Key_Check",
    "windows.ssdt.SSDT",
    "windows.statistics.Statistics",
    "windows.strings.Strings",
    "windows.suspended_threads.SuspendedThreads",
    "windows.suspicious_threads.SuspiciousThreads",
    "windows.svcdiff.SvcDiff",
    "windows.svclist.SvcList",
    "windows.svcscan.SvcScan",
    "windows.symlinkscan.SymlinkScan",
    "windows.thrdscan.ThrdScan",
    "windows.threads.Threads",
    "windows.timers.Timers",
    "windows.truecrypt.Passphrase",
    "windows.unhooked_system_calls.unhooked_system_calls",
    "windows.unloadedmodules.UnloadedModules",
    "windows.vadinfo.VadInfo",
    "windows.vadregexscan.VadRegExScan",
    "windows.vadwalk.VadWalk",
    "windows.verinfo.VerInfo",
    "windows.virtmap.VirtMap",
    "windows.windows.Windows",
    "windows.windowstations.WindowStations",
]

PLUGIN_OVERRIDES = {
    "windows.info.Info": {
        "display_name": "System Info",
        "description": "Resumen del sistema operativo y metadatos del dump",
    },
    "windows.pslist.PsList": {
        "display_name": "Process List",
        "description": "Lista de procesos activos y su contexto basico",
    },
    "windows.pstree.PsTree": {
        "display_name": "Process Tree",
        "description": "Arbol jerarquico de procesos detectados en memoria",
    },
    "windows.netscan.NetScan": {
        "display_name": "Network Scan",
        "description": "Conexiones de red y sockets activos detectados en memoria",
    },
    "windows.cmdline.CmdLine": {
        "display_name": "Command Lines",
        "description": "Lineas de comando asociadas a cada proceso",
    },
    "windows.dlllist.DllList": {
        "display_name": "DLL List",
        "description": "Modulos DLL cargados por cada proceso",
    },
    "windows.malfind.Malfind": {
        "display_name": "Malfind",
        "description": "Detecta regiones de memoria con indicios de inyeccion o codigo sospechoso",
    },
}


def _humanize_plugin_tail(plugin_tail: str) -> str:
    label = plugin_tail.replace("_", " ")
    label = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", label)
    label = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", label)

    acronym_words = {"api", "dll", "iat", "mbr", "ntfs", "os", "pe", "pid", "ppid", "ssdt", "tcp", "udp", "vad"}
    parts = []
    for word in label.split():
        if word.isupper():
            parts.append(word)
        elif word.lower() in acronym_words:
            parts.append(word.upper())
        else:
            parts.append(word.capitalize())
    return " ".join(parts)


def _canonical_plugin_name(plugin_name: str) -> str:
    plugin_name = (plugin_name or "").strip()
    if not plugin_name:
        return plugin_name
    return PLUGIN_NAME_ALIASES.get(plugin_name, plugin_name)


def _default_display_name(plugin_name: str) -> str:
    tail = plugin_name.split(".")[-1]
    return _humanize_plugin_tail(tail)


def _default_description(display_name: str) -> str:
    return f"Plugin de Volatility 3 para analizar {display_name.lower()}."


def _build_plugin_catalog() -> list[dict]:
    catalog = []
    seen_names = set()
    for class_path in WINDOWS_PLUGIN_CLASS_PATHS:
        name = ".".join(class_path.split(".")[:-1])
        if name in seen_names:
            continue
        seen_names.add(name)
        override = PLUGIN_OVERRIDES.get(class_path, {})
        display_name = override.get("display_name", _default_display_name(name))
        catalog.append(
            {
                "name": name,
                "display_name": display_name,
                "description": override.get("description", _default_description(display_name)),
                "class_path": class_path,
                "os": "windows",
            }
        )
    return catalog


PLUGIN_CATALOG = _build_plugin_catalog()

PLUGIN_NAME_ALIASES = {
    plugin["name"]: plugin["name"] for plugin in PLUGIN_CATALOG
}
PLUGIN_NAME_ALIASES.update(
    {
        plugin["class_path"]: plugin["name"]
        for plugin in PLUGIN_CATALOG
    }
)

PLUGIN_CLASS_PATH_BY_NAME = {
    plugin["name"]: plugin["class_path"]
    for plugin in PLUGIN_CATALOG
}


def _get_plugin_entry(plugin_name: str):
    plugin_name = _canonical_plugin_name(plugin_name)
    for plugin in PLUGIN_CATALOG:
        if plugin["name"] == plugin_name:
            return plugin
    return None


LOCKED_COMMAND_TOKENS = {
    "-f",
    "--file",
    "-q",
    "--quiet",
    "-r",
    "--renderer",
    "-s",
    "--symbol-dirs",
}

RESERVED_COMMAND_TOKENS = {"python", "python3", "vol.py"}


def _get_plugin_display_name(plugin_name: str) -> str:
    plugin_entry = _get_plugin_entry(plugin_name)
    if plugin_entry is not None:
        return plugin_entry["display_name"]
    return _default_display_name(_canonical_plugin_name(plugin_name))


def _get_plugin_class_path(plugin_name: str) -> str | None:
    plugin_entry = _get_plugin_entry(plugin_name)
    if plugin_entry is not None:
        return plugin_entry["class_path"]
    return None


def _normalize_command_request(
    plugin_name: str | None,
    command_suffix: str | None,
) -> tuple[str, str]:
    normalized_suffix = (command_suffix or "").strip()
    tokens: list[str] = []

    if normalized_suffix:
        try:
            tokens = shlex.split(normalized_suffix)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="El comando contiene comillas sin cerrar") from exc

    normalized_plugin = _canonical_plugin_name(plugin_name or "")
    if normalized_plugin:
        if normalized_plugin.startswith("-") or normalized_plugin.lower() in RESERVED_COMMAND_TOKENS:
            raise HTTPException(status_code=422, detail="El comando debe empezar por un plugin de Volatility")
        if tokens and _canonical_plugin_name(tokens[0]).lower() == normalized_plugin.lower():
            tokens = tokens[1:]
    else:
        if not tokens:
            raise HTTPException(status_code=422, detail="Debes indicar un plugin o un comando de Volatility")
        normalized_plugin = _canonical_plugin_name(tokens.pop(0))
        if normalized_plugin.startswith("-") or normalized_plugin.lower() in RESERVED_COMMAND_TOKENS:
            raise HTTPException(status_code=422, detail="El comando debe empezar por un plugin de Volatility")

    if not _get_plugin_entry(normalized_plugin):
        raise HTTPException(status_code=422, detail="Plugin no soportado")

    for token in tokens:
        lowered = token.lower()
        if lowered in LOCKED_COMMAND_TOKENS:
            raise HTTPException(
                status_code=422,
                detail="No puedes cambiar el fichero, los símbolos ni el renderer desde la web",
            )
        if lowered in RESERVED_COMMAND_TOKENS:
            raise HTTPException(
                status_code=422,
                detail="No incluyas python ni vol.py; el wrapper ya los añade",
            )

    return normalized_plugin, shlex.join(tokens) if tokens else ""


def _serialize_execution(execution: PluginExecution) -> PluginExecutionResponse:
    canonical_plugin_name = _canonical_plugin_name(execution.plugin_name)
    payload = {
        "id": execution.id,
        "dump_id": execution.dump_id,
        "plugin_name": canonical_plugin_name,
        "plugin_display_name": execution.plugin_display_name or _get_plugin_display_name(canonical_plugin_name),
        "status": execution.status,
        "started_at": execution.started_at,
        "completed_at": execution.completed_at,
        "result_row_count": execution.result_row_count,
        "result_data": execution.result_data,
        "error_message": execution.error_message,
        "error_traceback": execution.error_traceback,
        "created_at": execution.created_at,
    }
    return PluginExecutionResponse.model_validate(payload)


class SetOSRequest(BaseModel):
    detected_os: str
    detected_os_version: str | None = None


@router.get("/plugins")
async def list_plugins():
    return PLUGIN_CATALOG


@router.post("/dumps/{dump_id}/execute", response_model=PluginExecutionResponse, status_code=202)
async def execute_plugin(
    dump_id: str,
    payload: PluginExecutionRequest,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
):
    dump_result = await session.execute(select(Dump).where(Dump.id == dump_id))
    dump = dump_result.scalar_one_or_none()
    if dump is None:
        raise HTTPException(status_code=404, detail="Dump not found")


    if dump.status != DumpStatus.ready:
        raise HTTPException(status_code=422, detail="El dump no esta listo para analizar")

    plugin_name, command_suffix = _normalize_command_request(payload.plugin_name, payload.command_suffix)
    plugin_entry = _get_plugin_entry(plugin_name)
    if plugin_entry is None:
        raise HTTPException(status_code=422, detail="Plugin no soportado")

    # Permitir ejecutar plugins de detección de OS aunque no haya OS detectado
    detection_plugins = {"windows.info"}  # Agrega aquí más si hay para otros OS
    if not dump.detected_os and plugin_name not in detection_plugins:
        raise HTTPException(status_code=422, detail="El dump no tiene OS detectado. Solo puedes ejecutar plugins de detección de OS.")

    existing = await session.execute(
        select(PluginExecution).where(
            PluginExecution.dump_id == dump_id,
            PluginExecution.plugin_name.in_({plugin_name, plugin_entry["class_path"]}),
            PluginExecution.command_suffix == command_suffix,
        )
    )
    execution = existing.scalar_one_or_none()

    if execution and execution.status == ExecutionStatus.completed and (execution.result_row_count or 0) > 0:
        response.headers["X-Cached"] = "true"
        response.status_code = 200
        return _serialize_execution(execution)

    if execution and execution.status == ExecutionStatus.completed:
        # Re-run stale/empty cached executions without violating unique constraints.
        execution.status = ExecutionStatus.pending
        execution.error_message = None
        execution.error_traceback = None
        execution.result_data = None
        execution.result_row_count = None
        execution.started_at = None
        execution.completed_at = None

        celery_app = get_celery_app()
        task = celery_app.send_task("run_plugin", args=[str(execution.id), plugin_entry["class_path"]])
        execution.celery_task_id = task.id

        await session.commit()
        await session.refresh(execution)
        response.status_code = 202
        return _serialize_execution(execution)

    if execution and execution.status in {ExecutionStatus.pending, ExecutionStatus.running}:
        response.status_code = 202
        return _serialize_execution(execution)

    new_execution = PluginExecution(
        dump_id=dump_id,
        plugin_name=plugin_name,
        plugin_display_name=_get_plugin_display_name(plugin_name),
        command_suffix=command_suffix,
        status=ExecutionStatus.pending,
    )
    session.add(new_execution)
    await session.flush()

    celery_app = get_celery_app()
    task = celery_app.send_task("run_plugin", args=[str(new_execution.id), plugin_entry["class_path"]])
    new_execution.celery_task_id = task.id
    await session.commit()
    await session.refresh(new_execution)

    response.status_code = 202
    return _serialize_execution(new_execution)


@router.post("/dumps/{dump_id}/set_os", status_code=200)
async def set_os_for_dump(dump_id: str, payload: SetOSRequest, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Dump).where(Dump.id == dump_id))
    dump = result.scalar_one_or_none()
    if dump is None:
        raise HTTPException(status_code=404, detail="Dump not found")
    dump.detected_os = payload.detected_os
    dump.detected_os_version = payload.detected_os_version
    dump.status = DumpStatus.ready
    await session.commit()
    await session.refresh(dump)
    return {"message": "OS actualizado", "detected_os": dump.detected_os, "detected_os_version": dump.detected_os_version}


@router.get("/executions/{execution_id}", response_model=PluginExecutionResponse)
async def get_execution(execution_id: str, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(
        select(PluginExecution)
        .where(PluginExecution.id == execution_id)
        .options(selectinload(PluginExecution.dump))
    )
    execution = result.scalar_one_or_none()
    if execution is None:
        raise HTTPException(status_code=404, detail="Execution not found")
    return _serialize_execution(execution)


@router.get("/dumps/{dump_id}/executions", response_model=list[PluginExecutionResponse])
async def list_executions(dump_id: str, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(
        select(PluginExecution)
        .where(PluginExecution.dump_id == dump_id)
        .options(selectinload(PluginExecution.dump))
    )
    executions = result.scalars().all()
    return [
        _serialize_execution(execution)
        for execution in executions
    ]
