from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from deps import require_role
from models import Assignment, Classroom, Enrollment, User
from schemas import AssignmentCreate, AssignmentOut, AssignmentUpdate

router = APIRouter(prefix="/assignments", tags=["Assignments"])


def _classroom_or_404(db: Session, classroom_id: int) -> Classroom:
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return classroom


@router.get("", response_model=list[AssignmentOut])
def list_assignments(
    classroom_id: int | None = Query(default=None),
    current_user: User = Depends(require_role("teacher", "student")),
    db: Session = Depends(get_db),
):
    query = db.query(Assignment).join(Classroom, Classroom.id == Assignment.classroom_id)
    if current_user.role == "teacher":
        query = query.filter(Classroom.teacher_id == current_user.id)
    else:
        query = query.join(Enrollment, Enrollment.classroom_id == Classroom.id).filter(
            Enrollment.student_id == current_user.id
        )
    if classroom_id:
        query = query.filter(Assignment.classroom_id == classroom_id)

    rows = query.order_by(Assignment.deadline.asc()).all()
    return [
        AssignmentOut(
            id=row.id,
            classroom_id=row.classroom_id,
            classroom_name=row.classroom.name if row.classroom else None,
            title=row.title,
            description=row.description,
            topic=row.topic,
            deadline=row.deadline,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("", response_model=AssignmentOut)
def create_assignment(
    payload: AssignmentCreate,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    classroom = _classroom_or_404(db, payload.classroom_id)
    if classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can create assignments only in your own classrooms")

    assignment = Assignment(
        classroom_id=payload.classroom_id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        topic=payload.topic.strip(),
        deadline=payload.deadline,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return AssignmentOut(
        id=assignment.id,
        classroom_id=assignment.classroom_id,
        classroom_name=assignment.classroom.name if assignment.classroom else None,
        title=assignment.title,
        description=assignment.description,
        topic=assignment.topic,
        deadline=assignment.deadline,
        created_at=assignment.created_at,
    )


@router.put("/{assignment_id}", response_model=AssignmentOut)
def update_assignment(
    assignment_id: int,
    payload: AssignmentUpdate,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not assignment.classroom or assignment.classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit assignments in your classrooms")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(assignment, field, value.strip() if isinstance(value, str) else value)

    db.commit()
    db.refresh(assignment)
    return AssignmentOut(
        id=assignment.id,
        classroom_id=assignment.classroom_id,
        classroom_name=assignment.classroom.name if assignment.classroom else None,
        title=assignment.title,
        description=assignment.description,
        topic=assignment.topic,
        deadline=assignment.deadline,
        created_at=assignment.created_at,
    )


@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not assignment.classroom or assignment.classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete assignments in your classrooms")

    db.delete(assignment)
    db.commit()
    return {"message": "Assignment deleted"}
