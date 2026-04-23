from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, index=True)

    classrooms = relationship("Classroom", back_populates="teacher", cascade="all, delete")
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete")
    submissions = relationship("Submission", back_populates="student", cascade="all, delete")


class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    subject = Column(String(150), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    join_code = Column(String(16), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    teacher = relationship("User", back_populates="classrooms")
    enrollments = relationship("Enrollment", back_populates="classroom", cascade="all, delete")
    assignments = relationship("Assignment", back_populates="classroom", cascade="all, delete")
    modules = relationship("Module", back_populates="classroom", cascade="all, delete")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    classroom = relationship("Classroom", back_populates="enrollments")
    student = relationship("User", back_populates="enrollments")

    __table_args__ = (UniqueConstraint("classroom_id", "student_id", name="uq_classroom_student"),)


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    topic = Column(String(120), nullable=False)
    deadline = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    classroom = relationship("Classroom", back_populates="assignments")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False, default=1)
    file_url = Column(String(255), nullable=True)
    text_content = Column(Text, nullable=True)
    ai_score = Column(Float, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    ai_suggestions = Column(Text, nullable=True)
    teacher_score = Column(Float, nullable=True)
    teacher_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_latest = Column(Boolean, nullable=False, default=True, index=True)

    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", back_populates="submissions")
    peer_reviews = relationship("PeerReview", back_populates="submission", cascade="all, delete")


class PeerReview(Base):
    __tablename__ = "peer_reviews"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    submission = relationship("Submission", back_populates="peer_reviews")
    reviewer = relationship("User")

    __table_args__ = (UniqueConstraint("submission_id", "reviewer_id", name="uq_submission_reviewer"),)


class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    file_url = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    classroom = relationship("Classroom", back_populates="modules")
