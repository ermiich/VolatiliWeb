"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-03-13 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    op.create_table(
        "case",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "dump",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("file_path", sa.String(length=1024), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("file_hash_sha256", sa.String(length=64), nullable=False),
        sa.Column("detected_os", sa.String(length=128), nullable=True),
        sa.Column("detected_os_version", sa.String(length=256), nullable=True),
        sa.Column("status", sa.Enum("uploaded", "detecting", "ready", "error", name="dump_status"), nullable=False, server_default="uploaded"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "plugin_execution",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("dump_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dump.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plugin_name", sa.String(length=128), nullable=False),
        sa.Column("plugin_display_name", sa.String(length=128), nullable=True),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.Enum("pending", "running", "completed", "failed", name="execution_status"), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("error_traceback", sa.Text(), nullable=True),
        sa.Column("result_row_count", sa.Integer(), nullable=True),
        sa.Column("result_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index("idx_dump_hash", "dump", ["file_hash_sha256"], unique=True)
    op.create_index("idx_execution_dump_plugin", "plugin_execution", ["dump_id", "plugin_name"], unique=True)
    op.create_index("idx_result_data_gin", "plugin_execution", ["result_data"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("idx_result_data_gin", table_name="plugin_execution")
    op.drop_index("idx_execution_dump_plugin", table_name="plugin_execution")
    op.drop_index("idx_dump_hash", table_name="dump")
    op.drop_table("plugin_execution")
    op.drop_table("dump")
    op.drop_table("case")
    op.execute("DROP EXTENSION IF EXISTS pgcrypto;")
