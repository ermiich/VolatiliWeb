from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import mapped classes so SQLAlchemy can resolve string-based relationships
# when worker tasks import only a subset of models.
from app.models.case import Case  # noqa: F401,E402
from app.models.dump import Dump, DumpStatus  # noqa: F401,E402
from app.models.plugin_execution import ExecutionStatus, PluginExecution  # noqa: F401,E402
