"""Core utilities: local SQLite-backed data layer, auth helpers, seed data."""
from __future__ import annotations
import asyncio
import json
import logging
import os
import re
import sqlite3
import uuid
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_ALG = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
AWS_S3_BUCKET = os.environ.get("AWS_S3_BUCKET", "")
AWS_S3_REGION = os.environ.get("AWS_S3_REGION", "")
AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL", "")
AWS_S3_UPLOAD_PREFIX = os.environ.get("AWS_S3_UPLOAD_PREFIX", "question-images/")
AWS_S3_PUBLIC_READ = os.environ.get("AWS_S3_PUBLIC_READ", "false").lower() in ("1", "true", "yes")

logger = logging.getLogger(__name__)

DB_PATH = Path(os.environ.get("SQLITE_DB_PATH", str(ROOT_DIR / "gyansai.sqlite3")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


class UpdateResult:
    def __init__(self, matched_count: int = 0, modified_count: int = 0, upserted_id: Optional[str] = None):
        self.matched_count = matched_count
        self.modified_count = modified_count
        self.upserted_id = upserted_id


class SQLiteCursor:
    def __init__(self, collection: "SQLiteCollection", query: Optional[dict] = None, projection: Optional[dict] = None):
        self.collection = collection
        self.query = query or {}
        self.projection = projection or {}
        self.sort_field: Optional[str] = None
        self.sort_desc = False
        self.limit_value: Optional[int] = None

    def sort(self, field: str, direction: int = 1):
        self.sort_field = field
        self.sort_desc = direction == -1
        return self

    def limit(self, value: int):
        self.limit_value = value
        return self

    async def to_list(self, limit: Optional[int] = None):
        docs = await self.collection._find_many(self.query, self.projection)
        if self.sort_field:
            docs.sort(key=lambda item: str(item.get(self.sort_field) or ""), reverse=self.sort_desc)
        if self.limit_value is not None:
            docs = docs[: self.limit_value]
        elif limit is not None:
            docs = docs[:limit]
        return docs


class SQLiteCollection:
    def __init__(self, database: "SQLiteDatabase", name: str):
        self.database = database
        self.name = name
        self._lock = asyncio.Lock()
        self._conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("CREATE TABLE IF NOT EXISTS collection_docs (collection_name TEXT NOT NULL, doc_id TEXT NOT NULL, doc_json TEXT NOT NULL, PRIMARY KEY(collection_name, doc_id))")
        self._conn.commit()

    async def _run(self, fn, *args, **kwargs):
        async with self._lock:
            return await asyncio.to_thread(fn, *args, **kwargs)

    def _ensure_table(self):
        self._conn.execute("CREATE TABLE IF NOT EXISTS collection_docs (collection_name TEXT NOT NULL, doc_id TEXT NOT NULL, doc_json TEXT NOT NULL, PRIMARY KEY(collection_name, doc_id))")
        self._conn.commit()

    def _fetch_docs(self):
        self._ensure_table()
        rows = self._conn.execute("SELECT doc_json FROM collection_docs WHERE collection_name = ?", (self.name,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    async def _find_many(self, query: Optional[dict] = None, projection: Optional[dict] = None):
        docs = await self._run(self._fetch_docs)
        if query:
            docs = [doc for doc in docs if self._matches(doc, query)]
        if projection:
            docs = [self._project(doc, projection) for doc in docs]
        return docs

    def _project(self, doc: dict, projection: dict) -> dict:
        if not projection:
            return doc
        if any(value in (1, True) for value in projection.values()):
            projected = {}
            for key, include in projection.items():
                if key == "_id":
                    continue
                if include in (0, False):
                    continue
                if key in doc:
                    projected[key] = doc[key]
            return projected
        excluded = {key for key, include in projection.items() if include in (0, False)}
        projected = {key: value for key, value in doc.items() if key != "_id" and key not in excluded}
        return projected

    def _matches(self, doc: dict, query: dict) -> bool:
        if not query:
            return True
        if not isinstance(query, dict):
            return True
        for key, value in query.items():
            if key == "$or":
                return any(self._matches(doc, part) for part in value)
            if key == "$and":
                return all(self._matches(doc, part) for part in value)
            if key == "$nor":
                return not any(self._matches(doc, part) for part in value)
            if key == "$regex":
                continue
            if isinstance(value, dict) and any(k.startswith("$") for k in value.keys()):
                if "$regex" in value:
                    pattern = value["$regex"]
                    flags = value.get("$options", "")
                    if flags and "i" in flags:
                        regex = re.compile(pattern, re.IGNORECASE)
                    else:
                        regex = re.compile(pattern)
                    if not regex.search(str(doc.get(key, ""))):
                        return False
                elif "$in" in value:
                    if doc.get(key) not in value["$in"]:
                        return False
                elif "$nin" in value:
                    if doc.get(key) in value["$nin"]:
                        return False
                elif "$exists" in value:
                    if bool(value["$exists"]) != (key in doc):
                        return False
                elif "$gt" in value and not (doc.get(key) is not None and doc.get(key) > value["$gt"]):
                    return False
                elif "$gte" in value and not (doc.get(key) is not None and doc.get(key) >= value["$gte"]):
                    return False
                elif "$lt" in value and not (doc.get(key) is not None and doc.get(key) < value["$lt"]):
                    return False
                elif "$lte" in value and not (doc.get(key) is not None and doc.get(key) <= value["$lte"]):
                    return False
                else:
                    return False
                continue
            if key in doc:
                if isinstance(value, dict):
                    if doc[key] != value:
                        return False
                elif doc[key] != value:
                    return False
            else:
                return False
        return True

    async def find_one(self, query: Optional[dict] = None, projection: Optional[dict] = None):
        docs = await self._find_many(query, projection)
        return docs[0] if docs else None

    def find(self, query: Optional[dict] = None, projection: Optional[dict] = None) -> SQLiteCursor:
        return SQLiteCursor(self, query, projection)

    async def insert_one(self, doc: dict):
        doc = dict(doc)
        if "id" not in doc:
            doc["id"] = str(uuid.uuid4())
        payload = json.dumps(doc)
        await self._run(self._insert_doc, doc["id"], payload)
        return doc

    def _insert_doc(self, doc_id: str, payload: str):
        self._ensure_table()
        self._conn.execute("INSERT OR REPLACE INTO collection_docs (collection_name, doc_id, doc_json) VALUES (?, ?, ?)", (self.name, doc_id, payload))
        self._conn.commit()

    async def insert_many(self, docs: list[dict]):
        for doc in docs:
            await self.insert_one(doc)
        return None

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        doc = await self.find_one(query)
        if doc is None:
            if not upsert:
                return UpdateResult(0, 0)
            doc = {}
            if query and isinstance(query, dict):
                for key, value in query.items():
                    if not key.startswith("$"):
                        doc[key] = value
            doc["id"] = str(uuid.uuid4())
        else:
            doc = dict(doc)
        if "$set" in update:
            for key, value in update["$set"].items():
                doc[key] = value
        if "$addToSet" in update:
            for key, value in update["$addToSet"].items():
                current = doc.get(key)
                if not isinstance(current, list):
                    current = [] if current is None else [current]
                if value not in current:
                    current.append(value)
                doc[key] = current
        if "$pull" in update:
            for key, value in update["$pull"].items():
                current = doc.get(key)
                if isinstance(current, list):
                    doc[key] = [item for item in current if item != value]
        if "$unset" in update:
            for key in update["$unset"]:
                doc.pop(key, None)
        if not doc.get("id"):
            doc["id"] = str(uuid.uuid4())
        await self._run(self._replace_doc, doc)
        return UpdateResult(1, 1, doc.get("id"))

    def _replace_doc(self, doc: dict):
        self._ensure_table()
        self._conn.execute("INSERT OR REPLACE INTO collection_docs (collection_name, doc_id, doc_json) VALUES (?, ?, ?)", (self.name, doc.get("id"), json.dumps(doc)))
        self._conn.commit()

    async def update_many(self, query: dict, update: dict):
        docs = await self._find_many(query)
        for doc in docs:
            updated = dict(doc)
            if "$set" in update:
                for key, value in update["$set"].items():
                    updated[key] = value
            if "$addToSet" in update:
                for key, value in update["$addToSet"].items():
                    current = updated.get(key)
                    if not isinstance(current, list):
                        current = [] if current is None else [current]
                    if value not in current:
                        current.append(value)
                    updated[key] = current
            if "$pull" in update:
                for key, value in update["$pull"].items():
                    current = updated.get(key)
                    if isinstance(current, list):
                        updated[key] = [item for item in current if item != value]
            await self._run(self._replace_doc, updated)
        return UpdateResult(len(docs), len(docs))

    async def delete_one(self, query: dict):
        doc = await self.find_one(query)
        if not doc:
            return type("DeleteResult", (), {"deleted_count": 0})()
        await self._run(self._delete_doc, doc.get("id"))
        return type("DeleteResult", (), {"deleted_count": 1})()

    def _delete_doc(self, doc_id: str):
        self._ensure_table()
        self._conn.execute("DELETE FROM collection_docs WHERE collection_name = ? AND doc_id = ?", (self.name, doc_id))
        self._conn.commit()

    async def delete_many(self, query: dict):
        docs = await self._find_many(query)
        for doc in docs:
            await self._run(self._delete_doc, doc.get("id"))
        return type("DeleteResult", (), {"deleted_count": len(docs)})()

    async def count_documents(self, query: Optional[dict] = None):
        docs = await self._find_many(query)
        return len(docs)

    async def distinct(self, field: str, query: Optional[dict] = None):
        docs = await self._find_many(query)
        return [doc.get(field) for doc in docs if field in doc and doc.get(field) is not None]

    async def aggregate(self, pipeline: list[dict]):
        docs = await self._find_many({})
        for stage in pipeline:
            if "$match" in stage:
                docs = [doc for doc in docs if self._matches(doc, stage["$match"])]
            elif "$group" in stage:
                group_spec = stage["$group"]
                grouped = {}
                for doc in docs:
                    key = doc.get(group_spec.get("_id", ""), "") if isinstance(group_spec.get("_id"), str) and group_spec.get("_id", "").startswith("$") else group_spec.get("_id")
                    if isinstance(key, str) and key.startswith("$"):
                        key = doc.get(key[1:], "")
                    grouped.setdefault(key, [])
                    grouped[key].append(doc)
                return [{"_id": k, "count": len(v)} for k, v in grouped.items()]
        return docs


class SQLiteDatabase:
    def __init__(self, path: Optional[Path] = None):
        self.path = path or DB_PATH
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._collections: dict[str, SQLiteCollection] = {}

    def get_collection(self, name: str) -> SQLiteCollection:
        if name not in self._collections:
            self._collections[name] = SQLiteCollection(self, name)
        return self._collections[name]

    def __getattr__(self, name: str) -> SQLiteCollection:
        return self.get_collection(name)

    def __getitem__(self, name: str) -> SQLiteCollection:
        return self.get_collection(name)

    def close(self):
        for collection in self._collections.values():
            collection._conn.close()
        self._collections.clear()


client = None
try:
    db = SQLiteDatabase(DB_PATH)
except Exception as exc:
    logger.warning("SQLite initialization failed: %s", exc)
    db = None

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
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
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
    """Create default admin, demo student, and institute settings in SQLite."""
    if db is None:
        logger.warning("Skipping initial seed because SQLite is unavailable")
        return

    try:
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
    except Exception as exc:
        logger.warning("Initial seed skipped because SQLite is unavailable: %s", exc)
