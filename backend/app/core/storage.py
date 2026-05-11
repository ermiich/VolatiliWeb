import hashlib
from pathlib import Path
from typing import Optional

from fastapi import UploadFile

from app.config import settings


def get_dump_path(case_id: str, dump_id: str, extension: str) -> Path:
    return Path(settings.evidence_path) / case_id / f"{dump_id}{extension}"


def ensure_case_directory(case_id: str) -> Path:
    path = Path(settings.evidence_path) / case_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def delete_dump_file(file_path: str) -> bool:
    path = Path(file_path)
    if path.exists():
        path.unlink()
        return True
    return False


async def calculate_sha256_streaming(
    file: UploadFile,
    chunk_size: int = 1024 * 1024,
) -> tuple[str, int]:
    hasher = hashlib.sha256()
    size_bytes = 0
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        size_bytes += len(chunk)
        hasher.update(chunk)
    file.file.seek(0)
    return hasher.hexdigest(), size_bytes
