"""add command suffix to plugin execution

Revision ID: 0002_cmdsuffix_plugin_exec
Revises: 0001_initial_schema
Create Date: 2026-05-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002_cmdsuffix_plugin_exec"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "plugin_execution",
        sa.Column("command_suffix", sa.Text(), nullable=False, server_default=sa.text("''")),
    )
    op.drop_index("idx_execution_dump_plugin", table_name="plugin_execution")
    op.create_index(
        "idx_execution_dump_plugin_command",
        "plugin_execution",
        ["dump_id", "plugin_name", "command_suffix"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_execution_dump_plugin_command", table_name="plugin_execution")
    op.create_index("idx_execution_dump_plugin", "plugin_execution", ["dump_id", "plugin_name"], unique=True)
    op.drop_column("plugin_execution", "command_suffix")