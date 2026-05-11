from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel

from app.schemas.plugin_execution import PluginExecutionResponse


class DumpResponse(BaseModel):
    id: UUID
    case_id: UUID
    filename: str
    file_size_bytes: int
    file_hash_sha256: str
    detected_os: Optional[str] = None
    detected_os_version: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class DumpDetailResponse(DumpResponse):
    executions: List[PluginExecutionResponse] = []
