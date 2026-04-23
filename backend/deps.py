from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from auth import decode_token
from database import get_db
from models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        user_id: int | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except Exception as exc:
        raise credentials_exception from exc

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise credentials_exception
    return user


def require_role(*roles: str):
    def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return role_dependency
