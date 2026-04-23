from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from database import Base, engine
from migrations import migrate_database
from routes.analytics import router as analytics_router
from routes.assignments import router as assignments_router
from routes.auth import router as auth_router
from routes.classrooms import router as classrooms_router
from routes.modules import router as modules_router
from routes.submissions import router as submissions_router

Base.metadata.create_all(bind=engine)
migrate_database(engine)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):517\d$|https?://192\.168\.\d+\.\d+:517\d$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(auth_router)
app.include_router(classrooms_router)
app.include_router(assignments_router)
app.include_router(modules_router)
app.include_router(submissions_router)
app.include_router(analytics_router)


@app.get("/")
def health():
    return {"message": "Classroom AI backend is running"}
