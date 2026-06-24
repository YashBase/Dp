"""Gyansai Maths IIT Center — main FastAPI app."""
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
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
    client.close()


app = FastAPI(title="Gyansai Maths IIT Center API", lifespan=lifespan)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"app": "Gyansai Maths IIT Center", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"ok": True}


# Mount feature routers under /api
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
