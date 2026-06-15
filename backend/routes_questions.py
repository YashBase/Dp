"""Question bank routes — CRUD, filters, OCR upload via OpenAI Vision."""
import base64
import json
import re
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from core import db, require_admin, new_id, now_utc, iso, EMERGENT_LLM_KEY
from models import QuestionIn, OcrRequest, QuickAssignExamIn

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("")
async def list_questions(
    _admin=Depends(require_admin),
    subject: Optional[str] = None,
    chapter: Optional[str] = None,
    topic: Optional[str] = None,
    test_folder: Optional[str] = None,
    difficulty: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 500,
):
    flt = {}
    if subject:
        flt["subject"] = subject
    if chapter:
        flt["chapter"] = chapter
    if topic:
        flt["topic"] = topic
    if test_folder:
        flt["test_folder"] = test_folder
    if difficulty:
        flt["difficulty"] = difficulty
    if q:
        flt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    return await db.questions.find(flt, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)


@router.get("/meta")
async def question_meta(_admin=Depends(require_admin)):
    """Distinct subjects/chapters/topics/folders for filters."""
    subjects = await db.questions.distinct("subject")
    chapters = await db.questions.distinct("chapter")
    topics = await db.questions.distinct("topic")
    test_folders = await db.questions.distinct("test_folder")
    total = await db.questions.count_documents({})
    return {
        "subjects": subjects,
        "chapters": chapters,
        "topics": topics,
        "test_folders": [f for f in test_folders if f],
        "total": total,
    }


@router.post("")
async def create_question(data: QuestionIn, _admin=Depends(require_admin)):
    doc = data.model_dump()
    doc["options"] = [o for o in doc.get("options") or []]
    doc["id"] = new_id()
    doc["created_at"] = iso(now_utc())
    await db.questions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{qid}")
async def update_question(qid: str, data: QuestionIn, _admin=Depends(require_admin)):
    update = data.model_dump()
    res = await db.questions.update_one({"id": qid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    return await db.questions.find_one({"id": qid}, {"_id": 0})


@router.delete("/{qid}")
async def delete_question(qid: str, _admin=Depends(require_admin)):
    res = await db.questions.delete_one({"id": qid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"ok": True}


@router.post("/bulk-save")
async def bulk_save_questions(payload: dict, _admin=Depends(require_admin)):
    items = payload.get("questions") or []
    saved = 0
    for q in items:
        q["id"] = new_id()
        q["created_at"] = iso(now_utc())
        q.setdefault("subject", "General")
        q.setdefault("difficulty", "medium")
        q.setdefault("type", "mcq_single")
        q.setdefault("marks", 4.0)
        q.setdefault("negative_marks", 1.0)
        await db.questions.insert_one(q)
        saved += 1
    return {"saved": saved}


# ---------- OCR via OpenAI Vision (Emergent LLM Key) ----------
OCR_SYSTEM = (
    "You are an expert OCR system specialized in extracting math, physics, chemistry and biology "
    "exam questions from photos and PDFs of JEE / NEET / MHT-CET papers. "
    "Extract structured questions only. If multiple questions are present, return all of them. "
    "Detect mathematical equations and render them in LaTeX inside $...$ delimiters when possible. "
    "Respond with STRICT JSON only — no markdown, no commentary."
)

OCR_USER_PROMPT = (
    "Extract every question you can see in this image. "
    "For each question return JSON with this exact schema:\n"
    "{\n"
    '  "questions": [\n'
    "    {\n"
    '      "title": "<question text>",\n'
    '      "description": "<additional context if any>",\n'
    '      "type": "mcq_single" | "mcq_multi" | "numerical" | "true_false" | "short",\n'
    '      "subject": "Mathematics" | "Physics" | "Chemistry" | "Biology" | "General",\n'
    '      "options": [{"key": "A", "text": "..."}, {"key": "B", "text": "..."}],\n'
    '      "correct_answer": "A" | ["A","C"] | "<numeric>" | "<text>",\n'
    '      "explanation": "<solution / reasoning if visible, else empty>",\n'
    '      "difficulty": "easy" | "medium" | "hard",\n'
    '      "marks": 4,\n'
    '      "negative_marks": 1\n'
    "    }\n"
    "  ]\n"
    "}\n"
    "Return ONLY valid JSON. If no question is visible, return {\"questions\": []}."
)


def _parse_ocr_json(text: str) -> dict:
    text = text.strip()
    # Strip code fences if any
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except Exception:
        # Try to extract first JSON object
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return {"questions": []}


@router.post("/ocr")
async def ocr_extract(payload: OcrRequest, _admin=Depends(require_admin)):
    """Extract questions from a base64-encoded image using OpenAI Vision."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR module not available: {e}")

    # Strip potential data URL prefix
    b64 = payload.image_base64
    if "," in b64 and b64.lstrip().lower().startswith("data:"):
        b64 = b64.split(",", 1)[1]

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ocr-{new_id()}",
        system_message=OCR_SYSTEM,
    ).with_model("openai", "gpt-4o")

    image = ImageContent(image_base64=b64)
    try:
        reply = await chat.send_message(UserMessage(text=OCR_USER_PROMPT, file_contents=[image]))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OCR failed: {e}")

    parsed = _parse_ocr_json(reply or "")
    qs = parsed.get("questions") or []
    # Normalize
    for q in qs:
        q.setdefault("type", "mcq_single")
        q.setdefault("subject", "General")
        q.setdefault("difficulty", "medium")
        q.setdefault("marks", 4.0)
        q.setdefault("negative_marks", 1.0)
        q.setdefault("options", [])
        q.setdefault("explanation", "")
    return {"questions": qs}


@router.post("/ocr/upload")
async def ocr_upload(file: UploadFile = File(...), _admin=Depends(require_admin)):
    """Multipart helper: accept image OR PDF upload and run OCR.
    For PDFs, each page is rasterized to PNG and OCR-extracted in sequence."""
    content = await file.read()
    if len(content) > 16 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 16MB)")

    mime = (file.content_type or "").lower()
    fname = (file.filename or "").lower()
    is_pdf = "pdf" in mime or fname.endswith(".pdf")

    if not is_pdf:
        b64 = base64.b64encode(content).decode("utf-8")
        return await ocr_extract(OcrRequest(image_base64=b64, mime_type=mime or "image/jpeg"))

    # PDF path — render each page to PNG (max 15 pages to keep cost sane)
    try:
        import fitz  # PyMuPDF
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF support unavailable: {e}")

    try:
        pdf = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {e}")

    total_pages_count = pdf.page_count
    max_pages = min(total_pages_count, 15)
    all_qs: list = []
    for i in range(max_pages):
        page = pdf.load_page(i)
        pix = page.get_pixmap(dpi=180)
        img_bytes = pix.tobytes("png")
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        try:
            res = await ocr_extract(OcrRequest(image_base64=b64, mime_type="image/png"))
            for q in res.get("questions", []):
                q.setdefault("source_page", i + 1)
            all_qs.extend(res.get("questions", []))
        except HTTPException:
            # Skip failed page but continue with the rest
            continue
    pdf.close()
    return {"questions": all_qs, "pages_processed": max_pages, "total_pages": total_pages_count}



# ---------- Quick-Assign Exam from Question Folder ----------
@router.post("/quick-assign-exam")
async def quick_assign_exam(payload: QuickAssignExamIn, _admin=Depends(require_admin)):
    """One-shot wizard: pick a question test_folder + class + tag → creates an exam
    with all questions in that folder and (optionally) auto-assigns it to every
    student whose class_level matches."""
    if not payload.test_folder.strip():
        raise HTTPException(status_code=400, detail="test_folder is required")
    if not payload.exam_name.strip():
        raise HTTPException(status_code=400, detail="exam_name is required")

    # 1. Pull all questions in that folder
    qids = await db.questions.distinct("id", {"test_folder": payload.test_folder.strip()})
    if not qids:
        raise HTTPException(status_code=404, detail=f"No questions found in folder '{payload.test_folder}'")

    # 2. Determine target students
    student_ids: List[str] = list(payload.assigned_student_ids or [])
    if payload.auto_assign_class_students and payload.class_level:
        class_match = await db.students.distinct("id", {
            "class_level": payload.class_level,
            "status": {"$ne": "suspended"},
        })
        student_ids = list({*student_ids, *class_match})

    # 3. Create exam
    exam = {
        "id": new_id(),
        "name": payload.exam_name.strip(),
        "description": f"Auto-generated from question folder '{payload.test_folder}' ({len(qids)} questions)",
        "type": "mock",
        "exam_tag": payload.exam_tag or "",
        "class_level": payload.class_level or "",
        "duration_minutes": payload.duration_minutes,
        "start_at": None,
        "end_at": None,
        "passing_marks": payload.passing_marks,
        "instructions": payload.instructions or "Read each question carefully.",
        "randomize": payload.randomize,
        "negative_marking": payload.negative_marking,
        "question_ids": qids,
        "assigned_student_ids": student_ids,
        "allowed_tab_switches": payload.allowed_tab_switches,
        "enable_webcam": payload.enable_webcam,
        "is_published": payload.is_published,
        "price": 0.0,
        "test_folder_source": payload.test_folder.strip(),
        "created_at": iso(now_utc()),
    }
    await db.exams.insert_one(exam)
    exam.pop("_id", None)

    # 4. Sync into students' exam_ids so they see it in their portal
    if student_ids:
        await db.students.update_many(
            {"id": {"$in": student_ids}},
            {"$addToSet": {"exam_ids": exam["id"]}},
        )

    # 5. Activity log
    await db.activities.insert_one({
        "id": new_id(),
        "type": "exam_quick_assigned",
        "text": f"Exam '{exam['name']}' auto-created from folder '{payload.test_folder}' → {len(student_ids)} student(s) of {payload.class_level or 'all classes'}",
        "created_at": iso(now_utc()),
    })

    return {
        "exam": exam,
        "questions_count": len(qids),
        "assigned_count": len(student_ids),
    }
