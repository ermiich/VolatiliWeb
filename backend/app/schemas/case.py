from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.dump import DumpDetailResponse


class CaseCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None


class CaseResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CaseDetailResponse(CaseResponse):
    dumps: List[DumpDetailResponse] = []
