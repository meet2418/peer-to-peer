from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str


class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6)
    role: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True


class ClassroomCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    subject: str = Field(min_length=2, max_length=150)


class ClassroomJoin(BaseModel):
    join_code: str = Field(min_length=4, max_length=16)


class ClassroomOut(BaseModel):
    id: int
    name: str
    subject: str
    join_code: str
    teacher_id: int
    teacher_name: Optional[str] = None
    created_at: datetime


class ClassroomMemberOut(BaseModel):
    user_id: int
    name: str
    email: EmailStr
    role: str
    joined_at: Optional[datetime] = None


class ClassroomPeopleOut(BaseModel):
    classroom_id: int
    classroom_name: str
    teacher: ClassroomMemberOut
    students: list[ClassroomMemberOut]


class AssignmentCreate(BaseModel):
    classroom_id: int
    title: str
    description: str
    topic: str
    deadline: datetime


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    topic: Optional[str] = None
    deadline: Optional[datetime] = None


class AssignmentOut(BaseModel):
    id: int
    classroom_id: int
    classroom_name: Optional[str] = None
    title: str
    description: str
    topic: str
    deadline: datetime
    created_at: datetime


class PeerReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: Optional[str] = Field(default=None, max_length=1000)


class PeerReviewOut(BaseModel):
    id: int
    rating: int
    feedback: Optional[str] = None
    reviewer_label: str
    created_at: datetime


class SubmissionOut(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    attempt_number: int
    is_latest: bool
    student_name: Optional[str] = None
    anonymous_label: Optional[str] = None
    file_url: Optional[str] = None
    text_content: Optional[str] = None
    ai_score: Optional[float] = None
    ai_feedback: Optional[str] = None
    ai_suggestions: Optional[str] = None
    teacher_score: Optional[float] = None
    teacher_feedback: Optional[str] = None
    final_score: Optional[float] = None
    final_feedback: Optional[str] = None
    peer_rating_avg: Optional[float] = None
    peer_rating_count: int = 0
    peer_reviews: list[PeerReviewOut] = Field(default_factory=list)
    created_at: datetime


class SubmissionMyOut(BaseModel):
    submission_id: int
    assignment_id: int
    assignment_title: str
    classroom_id: int
    classroom_name: str
    topic: str
    attempt_number: int
    is_latest: bool
    file_url: Optional[str] = None
    text_content: Optional[str] = None
    ai_score: Optional[float] = None
    ai_feedback: Optional[str] = None
    ai_suggestions: Optional[str] = None
    teacher_score: Optional[float] = None
    teacher_feedback: Optional[str] = None
    final_score: Optional[float] = None
    final_feedback: Optional[str] = None
    submitted_at: datetime


class SubmissionOverride(BaseModel):
    teacher_score: float = Field(ge=0, le=100)
    teacher_feedback: str = Field(min_length=2, max_length=2000)


class LeaderboardEntry(BaseModel):
    rank: int
    student_alias: str
    average_score: float
    submissions_count: int


class ProgressOut(BaseModel):
    total_assignments: int
    submitted_assignments: int
    pending_assignments: int
    average_score: float


class ModuleOut(BaseModel):
    id: int
    classroom_id: int
    name: str
    file_url: str
    created_at: datetime


class PeerHighlightItem(BaseModel):
    label: str
    rating: int
    feedback: Optional[str] = None
    created_at: datetime


class PeerHighlightsOut(BaseModel):
    reviews_given: int
    reviews_received: int
    average_received_rating: float
    class_average_peer_rating: float
    recent_feedback: list[PeerHighlightItem]
