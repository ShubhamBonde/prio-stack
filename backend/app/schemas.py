from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

ItemState = Literal["todo", "in_progress", "blocked", "done"]
FrequencyType = Literal["daily", "weekly", "custom"]


class ItemCreate(BaseModel):
    parent_id: Optional[int] = None
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    state: ItemState = "todo"
    notes: str = ""
    priority: int = 1
    due_at: Optional[datetime] = None
    alarm_enabled: bool = False
    required_frequency: FrequencyType = "daily"
    frequency_days: int = Field(default=1, ge=1, le=30)


class ItemUpdate(BaseModel):
    parent_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    state: Optional[ItemState] = None
    notes: Optional[str] = None
    priority: Optional[int] = None
    due_at: Optional[datetime] = None
    alarm_enabled: Optional[bool] = None
    required_frequency: Optional[FrequencyType] = None
    frequency_days: Optional[int] = Field(default=None, ge=1, le=30)


class ItemOut(BaseModel):
    id: int
    parent_id: Optional[int]
    title: str
    description: str
    state: ItemState
    notes: str
    priority: int
    due_at: Optional[datetime]
    alarm_enabled: bool
    required_frequency: FrequencyType
    frequency_days: int
    points_awarded: int
    created_at: datetime
    updated_at: datetime


class RewardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    cost_points: int = Field(ge=1)
    is_active: bool = True


class RewardOut(BaseModel):
    id: int
    name: str
    cost_points: int
    is_active: bool


class SummaryOut(BaseModel):
    total_items: int
    done_items: int
    completion_rate: float
    point_balance: int
    active_streaks: int


class GoalBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    deadline_at: Optional[datetime] = None
    tags: list[str] = Field(default_factory=list)
    priority: int = 1


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline_at: Optional[datetime] = None
    tags: Optional[list[str]] = None
    priority: Optional[int] = None


class GoalOut(GoalBase):
    id: int
    created_at: datetime
    updated_at: datetime


class GoalReorderEntry(BaseModel):
    id: int
    priority: int


class ProjectBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    deadline_at: Optional[datetime] = None
    tags: list[str] = Field(default_factory=list)
    priority: int = 1


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline_at: Optional[datetime] = None
    tags: Optional[list[str]] = None
    priority: Optional[int] = None


class ProjectOut(ProjectBase):
    id: int
    goal_id: int
    created_at: datetime
    updated_at: datetime


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    state: ItemState = "todo"
    notes: str = ""
    priority: int = 1
    due_at: Optional[datetime] = None
    alarm_enabled: bool = False
    required_frequency: FrequencyType = "daily"
    frequency_days: int = Field(default=1, ge=1, le=30)


class TaskCreate(TaskBase):
    parent_id: Optional[int] = None


class TaskUpdate(BaseModel):
    parent_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    state: Optional[ItemState] = None
    notes: Optional[str] = None
    priority: Optional[int] = None
    due_at: Optional[datetime] = None
    alarm_enabled: Optional[bool] = None
    required_frequency: Optional[FrequencyType] = None
    frequency_days: Optional[int] = Field(default=None, ge=1, le=30)


class TaskOut(TaskBase):
    id: int
    project_id: int
    parent_id: Optional[int]
    points_awarded: int
    created_at: datetime
    updated_at: datetime


class TimelineGroup(BaseModel):
    label: str
    items: list[TaskOut]


class AuthStatusOut(BaseModel):
    configured: bool
    authenticated: bool


class AuthSetupIn(BaseModel):
    password: str = Field(min_length=8, max_length=200)


class AuthLoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class AuthResetIn(BaseModel):
    new_password: str = Field(min_length=8, max_length=200)


class AuthTokenOut(BaseModel):
    token: str


class NotificationSettingsUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = Field(default=None, ge=1, le=65535)
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    from_email: Optional[str] = None
    to_email: Optional[str] = None


class NotificationSettingsOut(BaseModel):
    email_enabled: bool
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password_set: bool
    smtp_use_tls: bool
    from_email: str
    to_email: str
