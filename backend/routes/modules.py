from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from deps import require_role
from models import Classroom, Enrollment, Module, User
from schemas import ModuleOut
from services.file_viewer import get_file_preview_payload

router = APIRouter(prefix="/modules", tags=["Modules"])

UPLOADS_DIR = Path("uploads/modules")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".gif", ".webp"}


def _classroom_or_404(db: Session, classroom_id: int) -> Classroom:
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return classroom


def _module_or_404(db: Session, module_id: int) -> Module:
    row = db.query(Module).filter(Module.id == module_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Module not found")
    return row


@router.get("", response_model=list[ModuleOut])
def list_modules(
    classroom_id: int,
    current_user: User = Depends(require_role("teacher", "student")),
    db: Session = Depends(get_db),
):
    classroom = _classroom_or_404(db, classroom_id)
    if current_user.role == "teacher":
        if classroom.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed to access this classroom")
    else:
        enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.classroom_id == classroom_id, Enrollment.student_id == current_user.id)
            .first()
        )
        if not enrolled:
            raise HTTPException(status_code=403, detail="You are not enrolled in this classroom")

    rows = (
        db.query(Module)
        .filter(Module.classroom_id == classroom_id)
        .order_by(Module.created_at.desc(), Module.id.desc())
        .all()
    )
    return [
        ModuleOut(
            id=row.id,
            classroom_id=row.classroom_id,
            name=row.name,
            file_url=row.file_url,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("/upload", response_model=ModuleOut)
def upload_module(
    classroom_id: int = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    classroom = _classroom_or_404(db, classroom_id)
    if classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to upload to this classroom")

    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    safe_name = f"{uuid4().hex}{extension}"
    file_path = UPLOADS_DIR / safe_name
    with file_path.open("wb") as out:
        out.write(file.file.read())

    row = Module(
        classroom_id=classroom_id,
        name=(file.filename or safe_name).strip(),
        file_url=f"/uploads/modules/{safe_name}",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ModuleOut(
        id=row.id,
        classroom_id=row.classroom_id,
        name=row.name,
        file_url=row.file_url,
        created_at=row.created_at,
    )


@router.get("/{module_id}/preview")
def preview_module(
    module_id: int,
    current_user: User = Depends(require_role("teacher", "student")),
    db: Session = Depends(get_db),
):
    row = _module_or_404(db, module_id)
    classroom = _classroom_or_404(db, row.classroom_id)

    if current_user.role == "teacher":
        if classroom.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed to access this module")
    else:
        enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.classroom_id == row.classroom_id, Enrollment.student_id == current_user.id)
            .first()
        )
        if not enrolled:
            raise HTTPException(status_code=403, detail="You are not enrolled in this classroom")

    return get_file_preview_payload(row.file_url)
