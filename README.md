# Classroom AI (Google Classroom-style Platform)

Full-stack assignment platform with role-based dashboards and AI grading using Groq.

## Features

- Teacher and student authentication with JWT
- Teacher: create/update/delete assignments
- Student: submit text/file responses
- AI grading with Groq API (score, feedback, strengths, improvements)
- Student anonymous submission feed (`Student 1`, `Student 2`, ...)
- Teacher submission view with real student identities
- Anonymous leaderboard and student progress tracking

## Tech Stack

- Backend: FastAPI, SQLAlchemy, SQLite, JWT
- Frontend: React (Vite), Tailwind CSS, Axios
- AI: Groq Chat Completions API

## Project Structure

- `backend/`
  - `main.py`
  - `models.py`
  - `database.py`
  - `routes/`
  - `services/groq_service.py`
- `frontend/`
  - `src/components/`
  - `src/pages/`
  - `src/services/api.js`

## Backend Setup

1. Go to backend:
   - `cd backend`
2. Create env file:
   - `copy .env.example .env`
3. Update `.env` with your Groq key:
   - `GROQ_API_KEY=...`
4. Install dependencies:
   - `pip install -r requirements.txt`
5. Run server:
   - `uvicorn main:app --reload --port 8000`

Backend API docs:
- [http://localhost:8000/docs](http://localhost:8000/docs)

## Frontend Setup

1. Go to frontend:
   - `cd frontend`
2. Create env file:
   - `copy .env.example .env`
3. Install dependencies:
   - `npm install`
4. Run app:
   - `npm run dev`

Frontend runs at:
- [http://localhost:5173](http://localhost:5173)

## Notes

- SQLite DB file: `backend/app.db` (auto-created at startup)
- Uploads are saved in `backend/uploads/`
- If `GROQ_API_KEY` is missing, the app uses safe placeholder grading response.

## Suggested Next Steps

- Add Docker Compose for one-command startup
- Add teacher class/course grouping and enrollment codes
- Add OCR/text extraction for PDF/DOCX content before AI evaluation
- Add tests (Pytest + React Testing Library)
