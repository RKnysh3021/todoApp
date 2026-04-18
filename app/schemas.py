from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models import TaskPriority


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    priority: Literal["low", "medium", "high"] = TaskPriority.MEDIUM.value
    due_date: Optional[date] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    due_date: Optional[date] = None
    is_completed: Optional[bool] = None


class TaskRead(BaseModel):
    id: int
    title: str
    description: Optional[str]
    priority: Literal["low", "medium", "high"]
    due_date: Optional[date]
    is_completed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
