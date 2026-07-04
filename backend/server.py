"""Gyansai Maths IIT Center — main FastAPI app."""
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import logging
import re

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


app = FastAPI(title="Gyansai Maths IIT Center API", lifespan=lifespan)

CORS_ORIGIN_REGEX = r"https://([a-z0-9-]+\.)*vercel\.app|http://localhost(:\d+)?"


@app.middleware("http")
async def cors_preflight_handler(request: Request, call_next):
    origin = request.headers.get("origin")
    is_preflight = request.method == "OPTIONS" and "access-control-request-method" in request.headers

    if origin and re.match(CORS_ORIGIN_REGEX, origin):
        if is_preflight:
            response = Response(status_code=204)
        else:
            response = await call_next(request)
        response.headers["access-control-allow-origin"] = origin
        response.headers["access-control-allow-credentials"] = "true"
        response.headers["vary"] = "Origin"
        if is_preflight:
            response.headers["access-control-allow-methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["access-control-allow-headers"] = request.headers.get(
                "access-control-request-headers",
                "authorization, content-type",
            )
            response.headers["access-control-max-age"] = "86400"
        return response

    return await call_next(request)

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

cors_origins = [origin.strip() for origin in os.environ.get(
    "CORS_ORIGINS",
    "https://*.vercel.app,http://localhost:3000,http://localhost:3001",
).split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

@app.exception_handler(Exception)
async def handle_unexpected_exception(request: Request, exc: Exception):
    logging.exception("Unhandled exception for %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please check server logs."},
    )
