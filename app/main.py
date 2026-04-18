from collections.abc import Generator
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import case, or_
from sqlalchemy.orm import Session

from app.database import Base, engine, ensure_database_schema, get_db
from app.models import Task, TaskPriority
from app.schemas import TaskCreate, TaskRead, TaskUpdate

Base.metadata.create_all(bind=engine)
ensure_database_schema()

app = FastAPI(title="TODO API")
app.mount("/static", StaticFiles(directory="app/static"), name="static")


def db_session() -> Generator[Session, None, None]:
    yield from get_db()


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse("app/static/index.html")


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/tasks/", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(db_session)) -> Task:
    task = Task(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        due_date=payload.due_date,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.get("/tasks/", response_model=list[TaskRead])
def list_tasks(
    is_completed: Optional[bool] = None,
    priority: Optional[TaskPriority] = None,
    search: Optional[str] = Query(default=None, min_length=1),
    sort_by: Literal["created_at", "due_date", "priority", "title"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
    db: Session = Depends(db_session),
) -> list[Task]:
    query = db.query(Task)

    if is_completed is not None:
        query = query.filter(Task.is_completed == is_completed)

    if priority is not None:
        query = query.filter(Task.priority == priority.value)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Task.title.ilike(pattern),
                Task.description.ilike(pattern),
            )
        )

    if sort_by == "title":
        sort_column = Task.title
    elif sort_by == "due_date":
        sort_column = Task.due_date
        nulls_position = case((Task.due_date.is_(None), 1), else_=0)
        query = query.order_by(nulls_position.asc())
    elif sort_by == "priority":
        sort_column = case(
            (Task.priority == TaskPriority.HIGH.value, 3),
            (Task.priority == TaskPriority.MEDIUM.value, 2),
            else_=1,
        )
    else:
        sort_column = Task.created_at

    query = query.order_by(sort_column.asc() if order == "asc" else sort_column.desc(), Task.id.desc())
    return query.all()


@app.get("/tasks/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(db_session)) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@app.delete("/tasks/completed", status_code=status.HTTP_200_OK)
def clear_completed_tasks(db: Session = Depends(db_session)) -> dict[str, int]:
    deleted_count = db.query(Task).filter(Task.is_completed.is_(True)).delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted_count}


@app.put("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(db_session)) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return task

    for field, value in update_data.items():
        setattr(task, field, value)

    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(db_session)) -> Response:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    db.delete(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
