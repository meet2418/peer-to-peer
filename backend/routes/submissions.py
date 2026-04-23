from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user, require_role
from models import Assignment, Classroom, Enrollment, PeerReview, Submission, User
from schemas import PeerReviewCreate, PeerReviewOut, SubmissionMyOut, SubmissionOut, SubmissionOverride
from services.file_viewer import get_file_preview_payload
from services.groq_service import evaluate_submission

router = APIRouter(prefix="/submissions", tags=["Submissions"])

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".gif", ".webp"}


def _assignment_or_404(db: Session, assignment_id: int) -> Assignment:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


def _ensure_student_in_classroom(db: Session, classroom_id: int, student_id: int) -> None:
    enrolled = (
        db.query(Enrollment)
        .filter(Enrollment.classroom_id == classroom_id, Enrollment.student_id == student_id)
        .first()
    )
    if not enrolled:
        raise HTTPException(status_code=403, detail="You are not enrolled in this classroom")


def _ensure_teacher_owns_classroom(classroom: Classroom, teacher_id: int) -> None:
    if classroom.teacher_id != teacher_id:
        raise HTTPException(status_code=403, detail="You are not allowed to access this classroom")


def _to_submission_out_for_teacher(s: Submission) -> SubmissionOut:
    reviews = sorted(s.peer_reviews, key=lambda review: (review.created_at, review.id))
    avg_rating = None
    if reviews:
        avg_rating = round(sum(review.rating for review in reviews) / len(reviews), 1)
    final_score = s.teacher_score if s.teacher_score is not None else s.ai_score
    final_feedback = s.teacher_feedback if s.teacher_feedback else s.ai_feedback
    return SubmissionOut(
        id=s.id,
        assignment_id=s.assignment_id,
        student_id=s.student_id,
        attempt_number=s.attempt_number,
        is_latest=s.is_latest,
        student_name=s.student.name,
        file_url=s.file_url,
        text_content=s.text_content,
        ai_score=s.ai_score,
        ai_feedback=s.ai_feedback,
        ai_suggestions=s.ai_suggestions,
        teacher_score=s.teacher_score,
        teacher_feedback=s.teacher_feedback,
        final_score=final_score,
        final_feedback=final_feedback,
        peer_rating_avg=avg_rating,
        peer_rating_count=len(reviews),
        peer_reviews=[
            PeerReviewOut(
                id=review.id,
                rating=review.rating,
                feedback=review.feedback,
                reviewer_label="Anonymous User",
                created_at=review.created_at,
            )
            for review in reviews
        ],
        created_at=s.created_at,
    )


@router.post("")
def create_or_resubmit_submission(
    assignment_id: int = Form(...),
    text_content: str = Form(default=""),
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    assignment = _assignment_or_404(db, assignment_id)
    _ensure_student_in_classroom(db, assignment.classroom_id, current_user.id)

    if datetime.utcnow() > assignment.deadline:
        raise HTTPException(status_code=400, detail="Deadline has passed")

    latest = (
        db.query(Submission)
        .filter(
            Submission.assignment_id == assignment_id,
            Submission.student_id == current_user.id,
            Submission.is_latest.is_(True),
        )
        .order_by(Submission.attempt_number.desc(), Submission.id.desc())
        .first()
    )
    max_attempt = (
        db.query(func.max(Submission.attempt_number))
        .filter(Submission.assignment_id == assignment_id, Submission.student_id == current_user.id)
        .scalar()
        or 0
    )
    attempt_number = int(max_attempt) + 1

    final_text = (text_content or "").strip()
    file_url = latest.file_url if latest else None
    file_text_stub = ""

    if file:
        extension = Path(file.filename or "").suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        safe_name = f"{uuid4().hex}{extension}"
        file_path = UPLOADS_DIR / safe_name
        with file_path.open("wb") as out:
            out.write(file.file.read())
        file_url = f"/uploads/{safe_name}"
        file_text_stub = f"[Student uploaded file: {file.filename}]"

    if not final_text and not file_url:
        raise HTTPException(status_code=400, detail="Submission text or file is required")

    if latest:
        latest.is_latest = False

    ai_input = final_text if final_text else file_text_stub
    evaluation = evaluate_submission(
        topic=assignment.topic,
        assignment_description=assignment.description,
        submission_text=ai_input,
    )

    submission = Submission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        attempt_number=attempt_number,
        file_url=file_url,
        text_content=final_text or None,
        ai_score=evaluation.get("score"),
        ai_feedback=evaluation.get("feedback"),
        ai_suggestions=evaluation.get("improvements"),
        is_latest=True,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    return {
        "message": "Submission created and evaluated" if attempt_number == 1 else "Resubmission created and evaluated",
        "attempt_number": submission.attempt_number,
        "ai_score": submission.ai_score,
        "ai_feedback": submission.ai_feedback,
        "ai_suggestions": submission.ai_suggestions,
        "final_score": submission.ai_score,
    }


@router.patch("/{submission_id}/override", response_model=SubmissionOut)
def override_submission_score(
    submission_id: int,
    payload: SubmissionOverride,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    assignment = _assignment_or_404(db, submission.assignment_id)
    _ensure_teacher_owns_classroom(assignment.classroom, current_user.id)

    submission.teacher_score = payload.teacher_score
    submission.teacher_feedback = payload.teacher_feedback.strip()
    db.commit()
    db.refresh(submission)
    return _to_submission_out_for_teacher(submission)


@router.get("/assignment/{assignment_id}", response_model=list[SubmissionOut])
def list_assignment_latest_submissions(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assignment = _assignment_or_404(db, assignment_id)
    if current_user.role == "teacher":
        _ensure_teacher_owns_classroom(assignment.classroom, current_user.id)
    else:
        _ensure_student_in_classroom(db, assignment.classroom_id, current_user.id)

    rows = (
        db.query(Submission)
        .filter(Submission.assignment_id == assignment_id, Submission.is_latest.is_(True))
        .order_by(Submission.created_at.asc(), Submission.id.asc())
        .all()
    )

    if current_user.role == "teacher":
        return [_to_submission_out_for_teacher(s) for s in rows]

    rows = [row for row in rows if row.student_id != current_user.id]
    unique_students = sorted({s.student_id for s in rows})
    alias_map = {student_id: f"Student {index + 1}" for index, student_id in enumerate(unique_students)}
    out = []
    for s in rows:
        reviews = sorted(s.peer_reviews, key=lambda review: (review.created_at, review.id))
        avg_rating = None
        if reviews:
            avg_rating = round(sum(review.rating for review in reviews) / len(reviews), 1)
        final_score = s.teacher_score if s.teacher_score is not None else s.ai_score
        final_feedback = s.teacher_feedback if s.teacher_feedback else s.ai_feedback
        out.append(
            SubmissionOut(
                id=s.id,
                assignment_id=s.assignment_id,
                student_id=s.student_id,
                attempt_number=s.attempt_number,
                is_latest=s.is_latest,
                anonymous_label=alias_map[s.student_id],
                file_url=s.file_url,
                text_content=s.text_content,
                ai_score=s.ai_score,
                ai_feedback=s.ai_feedback,
                ai_suggestions=s.ai_suggestions,
                teacher_score=s.teacher_score,
                teacher_feedback=s.teacher_feedback,
                final_score=final_score,
                final_feedback=final_feedback,
                peer_rating_avg=avg_rating,
                peer_rating_count=len(reviews),
                peer_reviews=[
                    PeerReviewOut(
                        id=review.id,
                        rating=review.rating,
                        feedback=review.feedback,
                        reviewer_label="Anonymous User",
                        created_at=review.created_at,
                    )
                    for review in reviews
                ],
                created_at=s.created_at,
            )
        )
    return out


@router.post("/{submission_id}/peer-review", response_model=PeerReviewOut)
def create_or_update_peer_review(
    submission_id: int,
    payload: PeerReviewCreate,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = _assignment_or_404(db, submission.assignment_id)
    _ensure_student_in_classroom(db, assignment.classroom_id, current_user.id)

    if submission.student_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot rate your own submission")

    review = (
        db.query(PeerReview)
        .filter(PeerReview.submission_id == submission_id, PeerReview.reviewer_id == current_user.id)
        .first()
    )

    feedback = (payload.feedback or "").strip() or None
    if review:
        review.rating = payload.rating
        review.feedback = feedback
    else:
        review = PeerReview(
            submission_id=submission_id,
            reviewer_id=current_user.id,
            rating=payload.rating,
            feedback=feedback,
        )
        db.add(review)

    db.commit()
    db.refresh(review)
    return PeerReviewOut(
        id=review.id,
        rating=review.rating,
        feedback=review.feedback,
        reviewer_label="Anonymous User",
        created_at=review.created_at,
    )


@router.get("/assignment/{assignment_id}/student/{student_id}/history", response_model=list[SubmissionOut])
def list_student_history_for_teacher(
    assignment_id: int,
    student_id: int,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    assignment = _assignment_or_404(db, assignment_id)
    _ensure_teacher_owns_classroom(assignment.classroom, current_user.id)
    rows = (
        db.query(Submission)
        .filter(Submission.assignment_id == assignment_id, Submission.student_id == student_id)
        .order_by(Submission.attempt_number.asc(), Submission.id.asc())
        .all()
    )
    return [_to_submission_out_for_teacher(s) for s in rows]


@router.get("/history/{assignment_id}", response_model=list[SubmissionMyOut])
def my_submission_history_for_assignment(
    assignment_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    assignment = _assignment_or_404(db, assignment_id)
    _ensure_student_in_classroom(db, assignment.classroom_id, current_user.id)

    rows = (
        db.query(Submission)
        .filter(Submission.assignment_id == assignment_id, Submission.student_id == current_user.id)
        .order_by(Submission.attempt_number.desc(), Submission.id.desc())
        .all()
    )
    out = []
    for s in rows:
        final_score = s.teacher_score if s.teacher_score is not None else s.ai_score
        final_feedback = s.teacher_feedback if s.teacher_feedback else s.ai_feedback
        out.append(
            SubmissionMyOut(
                submission_id=s.id,
                assignment_id=assignment.id,
                assignment_title=assignment.title,
                classroom_id=assignment.classroom_id,
                classroom_name=assignment.classroom.name,
                topic=assignment.topic,
                attempt_number=s.attempt_number,
                is_latest=s.is_latest,
                file_url=s.file_url,
                text_content=s.text_content,
                ai_score=s.ai_score,
                ai_feedback=s.ai_feedback,
                ai_suggestions=s.ai_suggestions,
                teacher_score=s.teacher_score,
                teacher_feedback=s.teacher_feedback,
                final_score=final_score,
                final_feedback=final_feedback,
                submitted_at=s.created_at,
            )
        )
    return out


@router.get("/me", response_model=list[SubmissionMyOut])
def my_latest_submissions(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Submission, Assignment, Classroom)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .join(Classroom, Classroom.id == Assignment.classroom_id)
        .join(Enrollment, Enrollment.classroom_id == Classroom.id)
        .filter(
            Submission.student_id == current_user.id,
            Submission.is_latest.is_(True),
            Enrollment.student_id == current_user.id,
        )
        .order_by(Submission.created_at.desc(), Submission.id.desc())
        .all()
    )
    out = []
    for submission, assignment, classroom in rows:
        final_score = submission.teacher_score if submission.teacher_score is not None else submission.ai_score
        final_feedback = submission.teacher_feedback if submission.teacher_feedback else submission.ai_feedback
        out.append(
            SubmissionMyOut(
                submission_id=submission.id,
                assignment_id=assignment.id,
                assignment_title=assignment.title,
                classroom_id=classroom.id,
                classroom_name=classroom.name,
                topic=assignment.topic,
                attempt_number=submission.attempt_number,
                is_latest=submission.is_latest,
                file_url=submission.file_url,
                text_content=submission.text_content,
                ai_score=submission.ai_score,
                ai_feedback=submission.ai_feedback,
                ai_suggestions=submission.ai_suggestions,
                teacher_score=submission.teacher_score,
                teacher_feedback=submission.teacher_feedback,
                final_score=final_score,
                final_feedback=final_feedback,
                submitted_at=submission.created_at,
            )
        )
    return out


@router.get("/{submission_id}/preview")
def preview_submission_file(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    assignment = _assignment_or_404(db, submission.assignment_id)

    if current_user.role == "teacher":
        _ensure_teacher_owns_classroom(assignment.classroom, current_user.id)
    else:
        _ensure_student_in_classroom(db, assignment.classroom_id, current_user.id)

    if not submission.file_url:
        raise HTTPException(status_code=404, detail="No file for this submission")

    payload = get_file_preview_payload(submission.file_url)
    return payload


@router.get("/my-peer-feedback/{assignment_id}", response_model=list[PeerReviewOut])
def my_peer_feedback_for_assignment(
    assignment_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    assignment = _assignment_or_404(db, assignment_id)
    _ensure_student_in_classroom(db, assignment.classroom_id, current_user.id)

    latest_submission = (
        db.query(Submission)
        .filter(
            Submission.assignment_id == assignment_id,
            Submission.student_id == current_user.id,
            Submission.is_latest.is_(True),
        )
        .order_by(Submission.attempt_number.desc(), Submission.id.desc())
        .first()
    )
    if not latest_submission:
        return []

    reviews = (
        db.query(PeerReview)
        .filter(PeerReview.submission_id == latest_submission.id)
        .order_by(PeerReview.created_at.desc(), PeerReview.id.desc())
        .all()
    )
    return [
        PeerReviewOut(
            id=item.id,
            rating=item.rating,
            feedback=item.feedback,
            reviewer_label="Anonymous User",
            created_at=item.created_at,
        )
        for item in reviews
    ]


@router.get("/assignment/{assignment_id}/peer-status")
def assignment_peer_status(
    assignment_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    assignment = _assignment_or_404(db, assignment_id)
    _ensure_student_in_classroom(db, assignment.classroom_id, current_user.id)

    enrolled_count = (
        db.query(func.count(Enrollment.id))
        .filter(Enrollment.classroom_id == assignment.classroom_id)
        .scalar()
        or 0
    )
    submitted_count = (
        db.query(func.count(func.distinct(Submission.student_id)))
        .filter(Submission.assignment_id == assignment_id, Submission.is_latest.is_(True))
        .scalar()
        or 0
    )

    return {
        "assignment_id": assignment_id,
        "classroom_id": assignment.classroom_id,
        "enrolled_students": int(enrolled_count),
        "submitted_students": int(submitted_count),
        "peer_ready": int(submitted_count) >= 2,
    }
