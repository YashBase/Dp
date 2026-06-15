"""Pydantic models for API requests/responses."""
from __future__ import annotations
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr


# ---------- Auth ----------
class AdminLoginIn(BaseModel):
    email: EmailStr
    password: str


class StudentLoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    token: str
    user: Dict[str, Any]
    role: str


# ---------- Institute Settings ----------
class InstituteSettingsIn(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None
    social: Optional[Dict[str, str]] = None
    theme_primary: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    ga_id: Optional[str] = None


# ---------- Students ----------
class StudentIn(BaseModel):
    name: str
    username: str
    password: Optional[str] = "student123"
    email: Optional[str] = ""
    mobile: Optional[str] = ""
    enrollment_no: Optional[str] = ""
    photo_url: Optional[str] = ""
    class_level: Optional[str] = ""  # "", "11th", "12th"


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    enrollment_no: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[str] = None  # active | suspended
    password: Optional[str] = None
    class_level: Optional[str] = None


# ---------- Questions ----------
class QuestionOption(BaseModel):
    key: str  # A, B, C, D
    text: str


class QuestionIn(BaseModel):
    title: str
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    subject: str
    chapter: Optional[str] = ""
    topic: Optional[str] = ""
    difficulty: str = "medium"  # easy | medium | hard
    tags: List[str] = Field(default_factory=list)
    type: str = "mcq_single"  # mcq_single, mcq_multi, true_false, fill_blank, numerical, short, long, file
    options: List[QuestionOption] = Field(default_factory=list)
    correct_answer: Any = None  # string, list, number depending on type
    explanation: Optional[str] = ""
    marks: float = 4.0
    negative_marks: float = 1.0


# ---------- Exams ----------
class ExamIn(BaseModel):
    name: str
    description: Optional[str] = ""
    type: str = "mock"  # mock | full | chapter | weekly
    exam_tag: Optional[str] = ""  # folder/category — e.g. JEE Mains, JEE Advanced, MHT-CET, NEET
    class_level: Optional[str] = ""  # "", "11th", "12th"
    duration_minutes: int = 60
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    passing_marks: float = 0
    instructions: Optional[str] = ""
    randomize: bool = False
    negative_marking: bool = True
    question_ids: List[str] = Field(default_factory=list)
    assigned_student_ids: List[str] = Field(default_factory=list)
    allowed_tab_switches: int = 3
    enable_webcam: bool = True
    is_published: bool = False
    price: float = 0.0  # 0 = free


# ---------- Exam Attempts ----------
class StartAttemptIn(BaseModel):
    exam_id: str


class SaveAnswerIn(BaseModel):
    attempt_id: str
    question_id: str
    answer: Any
    status: str = "answered"  # answered | review | not_answered


class SubmitAttemptIn(BaseModel):
    attempt_id: str


class TabSwitchLogIn(BaseModel):
    attempt_id: str
    violation_type: str = "tab_switch"  # tab_switch | fullscreen_exit | copy | paste | right_click


class SnapshotIn(BaseModel):
    attempt_id: str
    image_base64: str
    violation: Optional[str] = None  # "multi_face" | "no_face" | "looking_away" | None


# ---------- Courses ----------
class CourseChapter(BaseModel):
    id: Optional[str] = None
    title: str
    videos: List[Dict[str, str]] = Field(default_factory=list)  # {title, url}
    notes: List[Dict[str, str]] = Field(default_factory=list)
    assignments: List[Dict[str, str]] = Field(default_factory=list)


class CourseIn(BaseModel):
    name: str
    description: Optional[str] = ""
    cover_url: Optional[str] = ""
    price: float = 0
    subject: Optional[str] = ""
    chapters: List[CourseChapter] = Field(default_factory=list)
    is_published: bool = False


# ---------- Test Series ----------
class TestSeriesIn(BaseModel):
    name: str
    description: Optional[str] = ""
    cover_url: Optional[str] = ""
    price: float = 0
    exam_ids: List[str] = Field(default_factory=list)
    is_published: bool = True


# ---------- Payments ----------
class CheckoutIn(BaseModel):
    item_type: str  # course | test_series | exam
    item_id: str
    coupon: Optional[str] = None


class PaymentRequestIn(BaseModel):
    item_type: str  # course | test_series | exam
    item_id: str
    utr: Optional[str] = ""
    coupon: Optional[str] = None
    payer_name: Optional[str] = None
    note: Optional[str] = None


class PaymentDecisionIn(BaseModel):
    reason: Optional[str] = ""


# ---------- Proctor Recording ----------
class RecordingChunkIn(BaseModel):
    attempt_id: str
    data_base64: str
    mime_type: str = "video/webm"
    duration_ms: int = 0
    chunk_index: int = 0


# ---------- OCR ----------
class OcrRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"
