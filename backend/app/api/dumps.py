from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.storage import (
    calculate_sha256_streaming,
    delete_dump_file,
    ensure_case_directory,
    get_dump_path,
)
from app.database import get_async_session
from app.models.case import Case
from app.models.dump import Dump, DumpStatus
from app.schemas.dump import DumpResponse, DumpDetailResponse
from celery import Celery


router = APIRouter()

ALLOWED_EXTENSIONS = {".raw", ".mem", ".dmp"}

_celery_app = None


def get_celery_app() -> Celery:
    global _celery_app
    if _celery_app is None:
        _celery_app = Celery("volatiliweb_api", broker=settings.celery_broker_url)
    return _celery_app


@router.post("/cases/{case_id}/dumps", response_model=DumpResponse, status_code=201)
async def upload_dump(
    case_id: str,
    response: Response,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_async_session),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Extension de archivo no soportada")

    result = await session.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    file_hash, file_size = await calculate_sha256_streaming(file, chunk_size=1024 * 1024)

    if file_size == 0:
        raise HTTPException(status_code=422, detail="El archivo esta vacio")

    if file_size > max_bytes:
        raise HTTPException(status_code=413, detail="Archivo supera el limite configurado")

    existing = await session.execute(select(Dump).where(Dump.file_hash_sha256 == file_hash))
    existing_dump = existing.scalar_one_or_none()
    if existing_dump is not None:
        response.headers["X-Deduplicated"] = "true"
        return existing_dump

    new_dump = Dump(
        case_id=case_id,
        filename=file.filename,
        file_path="",
        file_size_bytes=file_size,
        file_hash_sha256=file_hash,
        status=DumpStatus.uploaded,
    )
    session.add(new_dump)
    await session.flush()

    ensure_case_directory(case_id)
    target_path = get_dump_path(case_id, str(new_dump.id), ext)

    with target_path.open("wb") as handle:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)

    new_dump.file_path = str(target_path)
    await session.commit()
    await session.refresh(new_dump)

    celery_app = get_celery_app()
    celery_app.send_task("detect_os", args=[str(new_dump.id)], priority=9)

    response.status_code = 201
    return new_dump


@router.get("/cases/{case_id}/dumps", response_model=list[DumpResponse])
async def list_dumps(case_id: str, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Dump).where(Dump.case_id == case_id))
    return result.scalars().all()


@router.get("/dumps/{dump_id}", response_model=DumpDetailResponse)
async def get_dump(dump_id: str, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(
        select(Dump).where(Dump.id == dump_id).options(selectinload(Dump.executions))
    )
    dump = result.scalar_one_or_none()
    if dump is None:
        raise HTTPException(status_code=404, detail="Dump not found")
    return dump


@router.delete("/dumps/{dump_id}", status_code=204)
async def delete_dump(dump_id: str, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Dump).where(Dump.id == dump_id))
    dump = result.scalar_one_or_none()
    if dump is None:
        raise HTTPException(status_code=404, detail="Dump not found")

    delete_dump_file(dump.file_path)
    await session.delete(dump)
    await session.commit()
    return None


@router.post("/dumps/{dump_id}/detect-os", status_code=202)
async def detect_os(dump_id: str, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Dump).where(Dump.id == dump_id))
    dump = result.scalar_one_or_none()
    if dump is None:
        raise HTTPException(status_code=404, detail="Dump not found")

    celery_app = get_celery_app()
    celery_app.send_task("detect_os", args=[dump_id], priority=9)
    return {"status": "queued"}
