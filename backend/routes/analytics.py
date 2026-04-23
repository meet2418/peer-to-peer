from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from deps import require_role
from models import Assignment, Classroom, Enrollment, PeerReview, Submission, User
from schemas import LeaderboardEntry, PeerHighlightItem, PeerHighlightsOut, ProgressOut

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(
    classroom_id: int | None = None,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    if classroom_id is not None:
        enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.classroom_id == classroom_id, Enrollment.student_id == current_user.id)
            .first()
        )
        if not enrolled:
            raise HTTPException(status_code=403, detail="You are not enrolled in this classroom")

    base_query = (
        db.query(
            Submission.student_id,
            func.avg(func.coalesce(Submission.teacher_score, Submission.ai_score)).label("avg_score"),
            func.count(Submission.id).label("count"),
        )
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .join(Enrollment, Enrollment.classroom_id == Assignment.classroom_id)
        .filter(
            Submission.is_latest.is_(True),
            func.coalesce(Submission.teacher_score, Submission.ai_score).isnot(None),
            Enrollment.classroom_id == Assignment.classroom_id,
        )
    )

    if classroom_id is not None:
        base_query = base_query.filter(Assignment.classroom_id == classroom_id)
    else:
        base_query = base_query.filter(Enrollment.student_id == current_user.id)

    rows = (
        base_query.group_by(Submission.student_id)
        .order_by(func.avg(func.coalesce(Submission.teacher_score, Submission.ai_score)).desc())
        .all()
    )

    return [
        LeaderboardEntry(
            rank=index + 1,
            student_alias=f"Student {index + 1}",
            average_score=round(float(row.avg_score), 2),
            submissions_count=int(row.count),
        )
        for index, row in enumerate(rows)
    ]


@router.get("/progress", response_model=ProgressOut)
def student_progress(
    classroom_id: int | None = None,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    if classroom_id is not None:
        enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.classroom_id == classroom_id, Enrollment.student_id == current_user.id)
            .first()
        )
        if not enrolled:
            raise HTTPException(status_code=403, detail="You are not enrolled in this classroom")

    total_assignments = (
        db.query(func.count(Assignment.id))
        .join(Enrollment, Enrollment.classroom_id == Assignment.classroom_id)
        .filter(Enrollment.student_id == current_user.id, Enrollment.classroom_id == Assignment.classroom_id)
    )
    if classroom_id is not None:
        total_assignments = total_assignments.filter(Assignment.classroom_id == classroom_id)
    total_assignments = total_assignments.scalar() or 0

    submitted_assignments = (
        db.query(func.count(Submission.id))
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .join(Enrollment, Enrollment.classroom_id == Assignment.classroom_id)
        .filter(
            Enrollment.student_id == current_user.id,
            Submission.student_id == current_user.id,
            Submission.is_latest.is_(True),
            Enrollment.classroom_id == Assignment.classroom_id,
        )
    )
    if classroom_id is not None:
        submitted_assignments = submitted_assignments.filter(Assignment.classroom_id == classroom_id)
    submitted_assignments = submitted_assignments.scalar() or 0

    avg_score = (
        db.query(func.avg(func.coalesce(Submission.teacher_score, Submission.ai_score)))
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .join(Enrollment, Enrollment.classroom_id == Assignment.classroom_id)
        .filter(
            Enrollment.student_id == current_user.id,
            Submission.student_id == current_user.id,
            Submission.is_latest.is_(True),
        )
    )
    if classroom_id is not None:
        avg_score = avg_score.filter(Assignment.classroom_id == classroom_id)
    avg_score = avg_score.scalar() or 0

    pending = max(0, int(total_assignments) - int(submitted_assignments))
    return ProgressOut(
        total_assignments=int(total_assignments),
        submitted_assignments=int(submitted_assignments),
        pending_assignments=pending,
        average_score=round(float(avg_score), 2),
    )


@router.get("/performance")
def teacher_performance(
    classroom_id: int | None = None,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    assignments_query = (
        db.query(Assignment.id)
        .join(Classroom, Classroom.id == Assignment.classroom_id)
        .filter(Classroom.teacher_id == current_user.id)
    )
    enrollments_query = (
        db.query(func.count(func.distinct(Enrollment.student_id)))
        .join(Classroom, Classroom.id == Enrollment.classroom_id)
        .filter(Classroom.teacher_id == current_user.id)
    )
    scores_query = (
        db.query(func.avg(func.coalesce(Submission.teacher_score, Submission.ai_score)))
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .join(Classroom, Classroom.id == Assignment.classroom_id)
        .filter(
            Classroom.teacher_id == current_user.id,
            Submission.is_latest.is_(True),
            func.coalesce(Submission.teacher_score, Submission.ai_score).isnot(None),
        )
    )
    graded_query = (
        db.query(func.count(Submission.id))
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .join(Classroom, Classroom.id == Assignment.classroom_id)
        .filter(
            Classroom.teacher_id == current_user.id,
            Submission.is_latest.is_(True),
            func.coalesce(Submission.teacher_score, Submission.ai_score).isnot(None),
        )
    )

    if classroom_id is not None:
        classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
        if not classroom or classroom.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="You are not allowed to access this classroom")
        assignments_query = assignments_query.filter(Assignment.classroom_id == classroom_id)
        enrollments_query = enrollments_query.filter(Enrollment.classroom_id == classroom_id)
        scores_query = scores_query.filter(Assignment.classroom_id == classroom_id)
        graded_query = graded_query.filter(Assignment.classroom_id == classroom_id)

    assignment_ids_subquery = assignments_query.subquery()
    total_assignments = db.query(func.count()).select_from(assignment_ids_subquery).scalar() or 0
    total_students = enrollments_query.scalar() or 0
    average_score = scores_query.scalar() or 0
    graded_assignments = graded_query.scalar() or 0

    return {
        "total_students": int(total_students),
        "average_score": round(float(average_score), 2),
        "graded_assignments": int(graded_assignments),
        "total_assignments": int(total_assignments),
    }


@router.get("/peer-highlights", response_model=PeerHighlightsOut)
def peer_highlights(
    classroom_id: int | None = None,
    current_user: User = Depends(require_role("teacher", "student")),
    db: Session = Depends(get_db),
):
    if classroom_id is None:
        raise HTTPException(status_code=400, detail="classroom_id is required")

    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if current_user.role == "teacher":
        if classroom.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="You are not allowed to access this classroom")
    else:
        enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.classroom_id == classroom_id, Enrollment.student_id == current_user.id)
            .first()
        )
        if not enrolled:
            raise HTTPException(status_code=403, detail="You are not enrolled in this classroom")

    class_reviews_query = (
        db.query(PeerReview)
        .join(Submission, Submission.id == PeerReview.submission_id)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .filter(Assignment.classroom_id == classroom_id)
    )
    class_reviews = class_reviews_query.order_by(PeerReview.created_at.desc(), PeerReview.id.desc()).all()
    class_avg = round(float(sum(item.rating for item in class_reviews) / len(class_reviews)), 2) if class_reviews else 0.0

    if current_user.role == "teacher":
        reviewer_ids = sorted({item.reviewer_id for item in class_reviews})
        alias_map = {user_id: f"Student {idx + 1}" for idx, user_id in enumerate(reviewer_ids)}
        recent = [
            PeerHighlightItem(
                label=alias_map.get(item.reviewer_id, "Student"),
                rating=item.rating,
                feedback=item.feedback,
                created_at=item.created_at,
            )
            for item in class_reviews[:8]
        ]
        return PeerHighlightsOut(
            reviews_given=0,
            reviews_received=len(class_reviews),
            average_received_rating=class_avg,
            class_average_peer_rating=class_avg,
            recent_feedback=recent,
        )

    reviews_given = len([item for item in class_reviews if item.reviewer_id == current_user.id])
    reviews_on_my_work = (
        db.query(PeerReview)
        .join(Submission, Submission.id == PeerReview.submission_id)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .filter(
            Assignment.classroom_id == classroom_id,
            Submission.student_id == current_user.id,
            Submission.is_latest.is_(True),
        )
        .order_by(PeerReview.created_at.desc(), PeerReview.id.desc())
        .all()
    )
    my_avg = round(float(sum(item.rating for item in reviews_on_my_work) / len(reviews_on_my_work)), 2) if reviews_on_my_work else 0.0
    recent = [
        PeerHighlightItem(
            label="Anonymous User",
            rating=item.rating,
            feedback=item.feedback,
            created_at=item.created_at,
        )
        for item in reviews_on_my_work[:8]
    ]
    return PeerHighlightsOut(
        reviews_given=reviews_given,
        reviews_received=len(reviews_on_my_work),
        average_received_rating=my_avg,
        class_average_peer_rating=class_avg,
        recent_feedback=recent,
    )
