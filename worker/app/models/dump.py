import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, BigInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship

from app.models import Base


class DumpStatus(str, enum.Enum):
    uploaded = "uploaded"
    detecting = "detecting"
    ready = "ready"
    error = "error"


class Dump(Base):
    __tablename__ = "dump"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    case_id = Column(UUID(as_uuid=True), ForeignKey("case.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(512), nullable=False)
    file_path = Column(String(1024), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    file_hash_sha256 = Column(String(64), nullable=False, unique=True)
    detected_os = Column(String(128), nullable=True)
    detected_os_version = Column(String(256), nullable=True)
    status = Column(Enum(DumpStatus, name="dump_status"), nullable=False, server_default="uploaded")
    error_message = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    case = relationship("Case", back_populates="dumps")
    executions = relationship("PluginExecution", back_populates="dump", cascade="all, delete-orphan")
