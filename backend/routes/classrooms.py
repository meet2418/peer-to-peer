import random
import string

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from deps import require_role
from models import Classroom, Enrollment, User
from schemas import ClassroomCreate, ClassroomJoin, ClassroomMemberOut, ClassroomOut, ClassroomPeopleOut

router = APIRouter(prefix="/classrooms", tags=["Classrooms"])


def _join_code(db: Session) -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choice(alphabet) for _ in range(6))
        exists = db.query(Classroom).filter(Classroom.join_code == code).first()
        if not exists:
            return code


@router.post("", response_model=ClassroomOut)
def create_classroom(
    payload: ClassroomCreate,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    classroom = Classroom(
        name=payload.name.strip(),
        subject=payload.subject.strip(),
        teacher_id=current_user.id,
        join_code=_join_code(db),
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return ClassroomOut(
        id=classroom.id,
        name=classroom.name,
        subject=classroom.subject,
        join_code=classroom.join_code,
        teacher_id=classroom.teacher_id,
        teacher_name=current_user.name,
        created_at=classroom.created_at,
    )


@router.get("", response_model=list[ClassroomOut])
def list_my_classrooms(
    current_user: User = Depends(require_role("teacher", "student")),
    db: Session = Depends(get_db),
):
    if current_user.role == "teacher":
        rows = (
            db.query(Classroom)
            .filter(Classroom.teacher_id == current_user.id)
            .order_by(Classroom.created_at.desc())
            .all()
        )
    else:
        rows = (
            db.query(Classroom)
            .join(Enrollment, Enrollment.classroom_id == Classroom.id)
            .filter(Enrollment.student_id == current_user.id)
            .order_by(Classroom.created_at.desc())
            .all()
        )

    return [
        ClassroomOut(
            id=row.id,
            name=row.name,
            subject=row.subject,
            join_code=row.join_code,
            teacher_id=row.teacher_id,
            teacher_name=row.teacher.name if row.teacher else None,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("/join", response_model=ClassroomOut)
def join_classroom(
    payload: ClassroomJoin,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    classroom = (
        db.query(Classroom)
        .filter(Classroom.join_code == payload.join_code.strip().upper())
        .first()
    )
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid classroom join code")

    already = (
        db.query(Enrollment)
        .filter(Enrollment.classroom_id == classroom.id, Enrollment.student_id == current_user.id)
        .first()
    )
    if already:
        return ClassroomOut(
            id=classroom.id,
            name=classroom.name,
            subject=classroom.subject,
            join_code=classroom.join_code,
            teacher_id=classroom.teacher_id,
            teacher_name=classroom.teacher.name if classroom.teacher else None,
            created_at=classroom.created_at,
        )

    db.add(Enrollment(classroom_id=classroom.id, student_id=current_user.id))
    db.commit()
    db.refresh(classroom)
    return ClassroomOut(
        id=classroom.id,
        name=classroom.name,
        subject=classroom.subject,
        join_code=classroom.join_code,
        teacher_id=classroom.teacher_id,
        teacher_name=classroom.teacher.name if classroom.teacher else None,
        created_at=classroom.created_at,
    )


@router.get("/{classroom_id}/people", response_model=ClassroomPeopleOut)
def classroom_people(
    classroom_id: int,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view people in your own classrooms")

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.classroom_id == classroom_id)
        .order_by(Enrollment.created_at.asc())
        .all()
    )
    students = [
        ClassroomMemberOut(
            user_id=enrollment.student.id,
            name=enrollment.student.name,
            email=enrollment.student.email,
            role=enrollment.student.role,
            joined_at=enrollment.created_at,
        )
        for enrollment in enrollments
        if enrollment.student is not None
    ]

    teacher = classroom.teacher
    if teacher is None:
        raise HTTPException(status_code=500, detail="Classroom teacher not found")

    return ClassroomPeopleOut(
        classroom_id=classroom.id,
        classroom_name=classroom.name,
        teacher=ClassroomMemberOut(
            user_id=teacher.id,
            name=teacher.name,
            email=teacher.email,
            role=teacher.role,
            joined_at=classroom.created_at,
        ),
        students=students,
    )
