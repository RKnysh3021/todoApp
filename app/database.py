from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def ensure_database_schema() -> None:
    inspector = inspect(engine)
    if "tasks" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("tasks")}
    alter_statements = []

    if "priority" not in columns:
        alter_statements.append(
            "ALTER TABLE tasks ADD COLUMN priority VARCHAR(10) NOT NULL DEFAULT "
            "'medium'"
        )

    if "due_date" not in columns:
        alter_statements.append("ALTER TABLE tasks ADD COLUMN due_date DATE")

    if not alter_statements:
        return

    with engine.begin() as connection:
        for statement in alter_statements:
            connection.exec_driver_sql(statement)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
