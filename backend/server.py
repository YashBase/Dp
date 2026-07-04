"""Gyansai Maths IIT Center — main FastAPI app."""

from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from core import seed_initial_data, client
from routes_auth import router as auth_router
from routes_admin import router as admin_router
from routes_questions import router as questions_router
from routes_exams import router as exams_router
from routes_student import router as student_router
from routes_public import router as public_router
from routes_batches import router as batches_router
from routes_teachers import router as teachers_router
from routes_attendance import router as attendance_router
from routes_study import router as study_router
from routes_notifications import router as notifications_router
from routes_signup import router as signup_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_initial_data()
    yield

    if client is not None:
        client.close()


app = FastAPI(
    title="Gyansai Maths IIT Center API",
    lifespan=lifespan,
)

# -----------------------------
# CORS
# -----------------------------

origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "https://dp-rho-two.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# API Router
# -----------------------------

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {
        "app": "Gyansai Maths IIT Center",
        "status": "ok",
    }


@api_router.get("/health")
async def health():
    return {
        "ok": True
    }


api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(questions_router)
api_router.include_router(exams_router)
api_router.include_router(student_router)
api_router.include_router(public_router)
api_router.include_router(batches_router)
api_router.include_router(teachers_router)
api_router.include_router(attendance_router)
api_router.include_router(study_router)
api_router.include_router(notifications_router)
api_router.include_router(signup_router)

app.include_router(api_router)

# -----------------------------
# Logging
# -----------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


@app.exception_handler(Exception)
async def handle_unexpected_exception(request: Request, exc: Exception):
    logging.exception(
        "Unhandled exception for %s %s",
        request.method,
        request.url,
    )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error. Please check server logs."
        },
    )