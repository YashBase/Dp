"""Core utilities: DB connection, auth helpers, seed data."""
from __future__ import annotations
import os
import uuid
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_ALG = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
bearer_scheme = HTTPBearer(auto_error=False)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(creds.credentials)
    user_id = payload.get("sub")
    role = payload.get("role")
    if not user_id or not role:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    coll = {"admin": "admins", "teacher": "teachers", "student": "students"}.get(role, "students")
    user = await db[coll].find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["role"] = role
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    # Teachers also get admin-level access for the routes flagged below (CRUD on Q/exams/PDF).
    if user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_admin_only(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_student(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    return user


def clean_doc(doc: dict) -> dict:
    """Strip mongo _id and password_hash from a document."""
    if not doc:
        return doc
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


async def seed_initial_data() -> None:
    """Create default admin, demo student, default institute settings."""
    # Default institute settings
    existing = await db.institute_settings.find_one({"id": "default"})
    if not existing:
        await db.institute_settings.insert_one({
            "id": "default",
            "name": "Gyansai Maths IIT Center",
            "tagline": "Where Numbers Meet Destiny",
            "logo_url": "",
            "favicon_url": "",
            "address": "Plot 14, Education Lane, Pune, Maharashtra 411001",
            "contact_number": "+91 98765 43210",
            "email": "info@gyansai.com",
            "website": "https://gyansai.com",
            "upi_id": "gyansai@upi",
            "bank_account": "1234567890",
            "bank_ifsc": "HDFC0001234",
            "bank_name": "HDFC Bank",
            "social": {"youtube": "", "instagram": "", "twitter": "", "facebook": ""},
            "theme_primary": "#002FA7",
            "seo_title": "Gyansai Maths IIT Center — JEE/NEET/MHT-CET Test Portal",
            "seo_description": "Online examination & learning platform for JEE Main, JEE Advanced, NEET and MHT-CET aspirants.",
            "ga_id": "",
            "updated_at": iso(now_utc()),
        })

    # Default admin
    admin = await db.admins.find_one({"email": "admin@gyansai.com"})
    if not admin:
        await db.admins.insert_one({
            "id": new_id(),
            "name": "Super Admin",
            "email": "admin@gyansai.com",
            "password_hash": hash_password("admin123"),
            "two_fa_enabled": False,
            "created_at": iso(now_utc()),
        })

    # Demo student
    student = await db.students.find_one({"username": "demo"})
    if not student:
        await db.students.insert_one({
            "id": new_id(),
            "name": "Demo Student",
            "username": "demo",
            "password_hash": hash_password("demo123"),
            "email": "demo@gyansai.com",
            "mobile": "+91 90000 00000",
            "enrollment_no": "GS2026001",
            "photo_url": "",
            "status": "active",
            "course_ids": [],
            "exam_ids": [],
            "created_at": iso(now_utc()),
        })
