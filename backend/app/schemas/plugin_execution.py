from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel


class PluginExecutionRequest(BaseModel):
    plugin_name: Optional[str] = None
    command_suffix: Optional[str] = None


class PluginExecutionResponse(BaseModel):
    id: UUID
    dump_id: UUID
    plugin_name: str
    plugin_display_name: Optional[str] = None
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_row_count: Optional[int] = None
    result_data: Optional[List[Dict[str, Any]]] = None
    error_message: Optional[str] = None
    error_traceback: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
