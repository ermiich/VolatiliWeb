from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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

WINDOWS_PLUGIN_NAMES = [
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
        "description": "Informacion general del sistema operativo y el volcado",
    },
    "windows.pslist.PsList": {
        "display_name": "Process List",
        "description": "Lista de procesos activos al momento del volcado",
    },
    "windows.pstree.PsTree": {
        "display_name": "Process Tree",
        "description": "Arbol de procesos con jerarquia padre-hijo",
    },
    "windows.netscan.NetScan": {
        "display_name": "Network Scan",
        "description": "Conexiones de red activas y sockets",
    },
    "windows.cmdline.CmdLine": {
        "display_name": "Command Lines",
        "description": "Argumentos de linea de comandos de cada proceso",
    },
    "windows.dlllist.DllList": {
        "display_name": "DLL List",
        "description": "DLLs cargadas por cada proceso",
    },
    "windows.malfind.Malfind": {
        "display_name": "Malfind",
        "description": "Detecta regiones de memoria con posible codigo inyectado",
    },
}


def _default_display_name(plugin_name: str) -> str:
    tail = plugin_name.split(".")[-1]
    return tail.replace("_", " ")


def _build_plugin_catalog() -> list[dict]:
    catalog = []
    for name in WINDOWS_PLUGIN_NAMES:
        override = PLUGIN_OVERRIDES.get(name, {})
        catalog.append(
            {
                "name": name,
                "display_name": override.get("display_name", _default_display_name(name)),
                "description": override.get("description", f"Plugin Volatility: {name}"),
                "class_path": name,
                "os": "windows",
            }
        )
    return catalog


PLUGIN_CATALOG = _build_plugin_catalog()


def _get_plugin_entry(plugin_name: str):
    for plugin in PLUGIN_CATALOG:
        if plugin["name"] == plugin_name:
            return plugin
    return None


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

    if not dump.detected_os:
        raise HTTPException(status_code=422, detail="El dump no tiene OS detectado")

    plugin_entry = _get_plugin_entry(payload.plugin_name)
    if plugin_entry is None:
        raise HTTPException(status_code=422, detail="Plugin no soportado")

    existing = await session.execute(
        select(PluginExecution).where(
            PluginExecution.dump_id == dump_id,
            PluginExecution.plugin_name == payload.plugin_name,
        )
    )
    execution = existing.scalar_one_or_none()

    if execution and execution.status == ExecutionStatus.completed and (execution.result_row_count or 0) > 0:
        response.headers["X-Cached"] = "true"
        response.status_code = 200
        return execution

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
        task = celery_app.send_task("run_plugin", args=[str(execution.id)])
        execution.celery_task_id = task.id

        await session.commit()
        await session.refresh(execution)
        response.status_code = 202
        return execution

    if execution and execution.status in {ExecutionStatus.pending, ExecutionStatus.running}:
        response.status_code = 202
        return execution

    new_execution = PluginExecution(
        dump_id=dump_id,
        plugin_name=payload.plugin_name,
        plugin_display_name=plugin_entry.get("display_name"),
        status=ExecutionStatus.pending,
    )
    session.add(new_execution)
    await session.flush()

    celery_app = get_celery_app()
    task = celery_app.send_task("run_plugin", args=[str(new_execution.id)])
    new_execution.celery_task_id = task.id
    await session.commit()
    await session.refresh(new_execution)

    response.status_code = 202
    return new_execution


@router.get("/executions/{execution_id}", response_model=PluginExecutionResponse)
async def get_execution(execution_id: str, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(PluginExecution).where(PluginExecution.id == execution_id))
    execution = result.scalar_one_or_none()
    if execution is None:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution


@router.get("/dumps/{dump_id}/executions", response_model=list[PluginExecutionResponse])
async def list_executions(dump_id: str, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(PluginExecution).where(PluginExecution.dump_id == dump_id))
    return result.scalars().all()
