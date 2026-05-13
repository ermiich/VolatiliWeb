import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship

from app.models import Base


class ExecutionStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class PluginExecution(Base):
    __tablename__ = "plugin_execution"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    dump_id = Column(UUID(as_uuid=True), ForeignKey("dump.id", ondelete="CASCADE"), nullable=False)
    plugin_name = Column(String(128), nullable=False)
    plugin_display_name = Column(String(128), nullable=True)
    command_suffix = Column(Text, nullable=False, server_default=text("''"))
    celery_task_id = Column(String(255), nullable=True)
    status = Column(Enum(ExecutionStatus, name="execution_status"), nullable=False, server_default="pending")
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    error_traceback = Column(Text, nullable=True)
    result_row_count = Column(Integer, nullable=True)
    result_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    dump = relationship("Dump", back_populates="executions")
