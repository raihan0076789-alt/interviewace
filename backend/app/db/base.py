from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base every model inherits from. Alembic's autogenerate
    discovers tables by importing this Base's metadata, so every new model file
    must be imported somewhere that runs before Alembic looks (see
    app/models/__init__.py and alembic/env.py)."""
    pass
