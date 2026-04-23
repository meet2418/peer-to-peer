from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import create_access_token, hash_password, verify_password
from database import get_db
from models import User
from schemas import Token, UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    role = payload.role.lower().strip()
    if role not in {"teacher", "student"}:
        raise HTTPException(status_code=400, detail="Role must be teacher or student")

    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id), "role": user.role, "name": user.name})
    return Token(access_token=token, role=user.role, name=user.name)
