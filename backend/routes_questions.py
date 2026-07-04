"""Question bank routes — CRUD, filters, OCR upload via OpenAI Vision."""
import base64
import json
import logging
import re
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from core import (
    db,
    require_admin,
    new_id,
    now_utc,
    iso,
    EMERGENT_LLM_KEY,
    AWS_S3_BUCKET,
    AWS_S3_REGION,
    AWS_S3_ENDPOINT_URL,
    AWS_S3_UPLOAD_PREFIX,
    AWS_S3_PUBLIC_READ,
)
from models import QuestionIn, OcrRequest, QuickAssignExamIn, FolderExamIn


logger = logging.getLogger(__name__)
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
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload must be an object")
    items = payload.get("questions")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="questions must be an array")

    ids = []
    inserted_ids = []
    try:
        for raw_question in items:
            if not isinstance(raw_question, dict):
                raise HTTPException(status_code=400, detail="Each question must be an object")
            question = QuestionIn.model_validate(raw_question).model_dump()
            question["id"] = new_id()
            question["created_at"] = iso(now_utc())
            question.setdefault("subject", "General")
            question.setdefault("difficulty", "medium")
            question.setdefault("type", "mcq_single")
            question.setdefault("marks", 4.0)
            question.setdefault("negative_marks", 1.0)
            await db.questions.insert_one(question)
            ids.append(question["id"])
            inserted_ids.append(question["id"])
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to bulk save questions")
        if inserted_ids:
            try:
                await db.questions.delete_many({"id": {"$in": inserted_ids}})
            except Exception:
                logger.exception("Failed to rollback inserted questions after bulk save failure")
        raise HTTPException(status_code=500, detail="Failed to save questions")

    return {"saved": len(ids), "ids": ids}


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


def _s3_safe_filename(filename: str) -> str:
    filename = (filename or "").split("/")[-1].split("\\")[-1]
    name, dot, ext = filename.rpartition(".")
    name = re.sub(r"[^a-zA-Z0-9_-]+", "_", name or "file")
    ext = re.sub(r"[^a-zA-Z0-9]+", "", ext)
    return f"{name}.{ext}" if ext else name


def _s3_object_url(key: str) -> str:
    if AWS_S3_ENDPOINT_URL:
        return f"{AWS_S3_ENDPOINT_URL.rstrip('/')}/{key}"
    if AWS_S3_REGION:
        return f"https://{AWS_S3_BUCKET}.s3.{AWS_S3_REGION}.amazonaws.com/{key}"
    return f"https://{AWS_S3_BUCKET}.s3.amazonaws.com/{key}"


@router.post("/upload-image")
async def upload_question_image(file: UploadFile = File(...), _admin=Depends(require_admin)):
    """Upload a question image to S3 if configured; otherwise return a data URL."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    if not AWS_S3_BUCKET:
        # Fallback if S3 is not configured: return a data URL so image can still be attached.
        data_url = f"data:{file.content_type};base64,{base64.b64encode(content).decode('utf-8')}"
        return {"image_url": data_url}

    key = f"{AWS_S3_UPLOAD_PREFIX.rstrip('/')}/{new_id()}-{_s3_safe_filename(file.filename)}"
    try:
        import boto3

        s3 = boto3.client(
            "s3",
            region_name=AWS_S3_REGION or None,
            endpoint_url=AWS_S3_ENDPOINT_URL or None,
        )
        put_args = {
            "Bucket": AWS_S3_BUCKET,
            "Key": key,
            "Body": content,
            "ContentType": file.content_type or "application/octet-stream",
        }
        if AWS_S3_PUBLIC_READ:
            put_args["ACL"] = "public-read"
        s3.put_object(**put_args)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"S3 upload failed: {e}")

    return {"image_url": _s3_object_url(key)}


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
async def ocr_upload(
    file: Any = File(None),
    files: Any = File(None),
    settings: str = Form(None),
    _admin=Depends(require_admin),
):
    """Multipart helper: accept one or more image/PDF uploads and run OCR.
    For PDFs, each page is rasterized to PNG and OCR-extracted in sequence."""
    uploads = file or files or []
    if not uploads:
        raise HTTPException(status_code=400, detail="No file uploaded")

    ocr_settings = {}
    if settings:
        try:
            ocr_settings = json.loads(settings)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Malformed OCR settings JSON")

    pages_processed = 0
    total_pages_count = 0
    all_qs: list = []

    async def process_upload(upload_file: UploadFile):
        content = await upload_file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        if len(content) > 16 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 16MB)")

        mime = (upload_file.content_type or "").lower()
        fname = (upload_file.filename or "").lower()
        if not fname:
            raise HTTPException(status_code=400, detail="Uploaded file must have a filename")

        is_pdf = "pdf" in mime or fname.endswith(".pdf")
        if not is_pdf:
            if not mime.startswith("image/"):
                raise HTTPException(status_code=400, detail="Unsupported file type")
            b64 = base64.b64encode(content).decode("utf-8")
            return await ocr_extract(OcrRequest(image_base64=b64, mime_type=mime or "image/jpeg"))

        try:
            import fitz  # PyMuPDF
        except Exception as e:
            logger.exception("PDF support unavailable")
            raise HTTPException(status_code=500, detail=f"PDF support unavailable: {e}")

        try:
            pdf = fitz.open(stream=content, filetype="pdf")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid PDF: {e}")

        pages = pdf.page_count
        max_pages = min(pages, 15)
        pdf_qs: list = []
        for i in range(max_pages):
            page = pdf.load_page(i)
            pix = page.get_pixmap(dpi=180)
            img_bytes = pix.tobytes("png")
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            try:
                res = await ocr_extract(OcrRequest(image_base64=b64, mime_type="image/png"))
                for q in res.get("questions", []):
                    q.setdefault("source_page", i + 1)
                pdf_qs.extend(res.get("questions", []))
            except HTTPException as exc:
                logger.warning("OCR extraction failed for PDF page %s of %s: %s", i + 1, fname, exc.detail)
                continue
        pdf.close()
        return {"questions": pdf_qs, "pages_processed": max_pages, "total_pages": pages}

    try:
        for upload_file in uploads:
            result = await process_upload(upload_file)
            if not result:
                continue
            all_qs.extend(result.get("questions", []))
            pages_processed += result.get("pages_processed", 0)
            total_pages_count += result.get("total_pages", 0)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error during OCR upload")
        raise HTTPException(status_code=500, detail="Unexpected OCR upload failure")

    return {"questions": all_qs, "pages_processed": pages_processed, "total_pages": total_pages_count}


@router.post("/ocr/import")
async def ocr_import(
    file: list[UploadFile] = File(None),
    files: list[UploadFile] = File(None),
    settings: str = Form(None),
    _admin=Depends(require_admin),
):
    return await ocr_upload(file=file, files=files, settings=settings, _admin=_admin)



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


# ---------- Exam-Folder Manager ----------
@router.get("/folders")
async def list_folders(_admin=Depends(require_admin)):
    """List every distinct question test_folder and merge in the linked exam (if any).
    Returns: [{folder_name, question_count, exam_id?, exam_name?, class_level?, exam_tag?,
               assigned_count?, is_published?, duration_minutes?}]"""
    folder_names = [f for f in await db.questions.distinct("test_folder") if f]
    # Also include folders from exams that have test_folder_source but no remaining questions
    exam_folder_sources = [
        f for f in await db.exams.distinct("test_folder_source") if f and f not in folder_names
    ]
    folder_names = sorted(set([*folder_names, *exam_folder_sources]))

    out = []
    for fname in folder_names:
        qcount = await db.questions.count_documents({"test_folder": fname})
        exam = await db.exams.find_one(
            {"test_folder_source": fname}, {"_id": 0}, sort=[("created_at", -1)]
        )
        row = {"folder_name": fname, "question_count": qcount}
        if exam:
            row.update({
                "exam_id": exam["id"],
                "exam_name": exam.get("name"),
                "class_level": exam.get("class_level", ""),
                "exam_tag": exam.get("exam_tag", ""),
                "duration_minutes": exam.get("duration_minutes"),
                "assigned_count": len(exam.get("assigned_student_ids") or []),
                "is_published": bool(exam.get("is_published")),
            })
        out.append(row)
    return out


@router.post("/folder-exam")
async def upsert_folder_exam(payload: FolderExamIn, _admin=Depends(require_admin)):
    """Create or update the exam associated with a question-bank folder.
    Steps:
      1. (optional) Tag each picked question with test_folder=folder_name.
      2. Resolve target students (manual list + optional auto-by-class).
      3. Upsert the exam (insert if exam_id is None/empty, else update).
      4. Push the exam id into each target student's exam_ids array.
    """
    fname = (payload.folder_name or "").strip()
    if not fname:
        raise HTTPException(status_code=400, detail="folder_name is required")
    if not (payload.exam_name or "").strip():
        raise HTTPException(status_code=400, detail="exam_name is required")

    # 1. Tag picked questions with this folder so they appear under it
    if payload.tag_questions_to_folder and payload.question_ids:
        await db.questions.update_many(
            {"id": {"$in": payload.question_ids}},
            {"$set": {"test_folder": fname}},
        )

    # 2. Resolve target students (manual + auto by class)
    target_ids = set(payload.assigned_student_ids or [])
    if payload.auto_assign_class_students and payload.class_level:
        class_match = await db.students.distinct("id", {
            "class_level": payload.class_level,
            "status": {"$ne": "suspended"},
        })
        target_ids.update(class_match)
    target_list = list(target_ids)

    # 3. Upsert exam
    exam_doc_base = {
        "name": payload.exam_name.strip(),
        "description": f"Exam folder: {fname} ({len(payload.question_ids)} questions)",
        "type": "mock",
        "exam_tag": payload.exam_tag or "",
        "class_level": payload.class_level or "",
        "duration_minutes": payload.duration_minutes,
        "passing_marks": payload.passing_marks,
        "instructions": payload.instructions or "Read each question carefully.",
        "randomize": payload.randomize,
        "negative_marking": payload.negative_marking,
        "question_ids": payload.question_ids,
        "assigned_student_ids": target_list,
        "allowed_tab_switches": payload.allowed_tab_switches,
        "enable_webcam": payload.enable_webcam,
        "is_published": payload.is_published,
        "price": 0.0,
        "test_folder_source": fname,
    }

    if payload.exam_id:
        # Update existing
        res = await db.exams.update_one({"id": payload.exam_id}, {"$set": exam_doc_base})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Exam not found")
        exam = await db.exams.find_one({"id": payload.exam_id}, {"_id": 0})
        # Remove exam_id from students no longer in assignment list
        await db.students.update_many(
            {"exam_ids": payload.exam_id, "id": {"$nin": target_list}},
            {"$pull": {"exam_ids": payload.exam_id}},
        )
        action = "updated"
    else:
        exam_doc_base["id"] = new_id()
        exam_doc_base["created_at"] = iso(now_utc())
        await db.exams.insert_one(exam_doc_base)
        exam = exam_doc_base
        exam.pop("_id", None)
        action = "created"

    # 4. Push exam id into each target student's exam_ids
    if target_list:
        await db.students.update_many(
            {"id": {"$in": target_list}},
            {"$addToSet": {"exam_ids": exam["id"]}},
        )

    # 5. Activity log
    await db.activities.insert_one({
        "id": new_id(),
        "type": f"folder_exam_{action}",
        "text": f"Exam folder '{fname}' {action} → '{exam['name']}' · {len(payload.question_ids)} questions · {len(target_list)} students",
        "created_at": iso(now_utc()),
    })

    return {
        "exam": exam,
        "questions_count": len(payload.question_ids),
        "assigned_count": len(target_list),
        "action": action,
    }


@router.delete("/folders/{folder_name}")
async def delete_folder(folder_name: str, _admin=Depends(require_admin)):
    """Remove the test_folder tag from all questions in this folder AND delete the linked exam if any.
    Questions themselves are preserved (only the folder grouping is dropped)."""
    fname = folder_name.strip()
    if not fname:
        raise HTTPException(status_code=400, detail="folder_name is required")
    # Drop folder tag from questions
    await db.questions.update_many({"test_folder": fname}, {"$set": {"test_folder": ""}})
    # Delete linked exam(s)
    exams = await db.exams.find({"test_folder_source": fname}, {"_id": 0, "id": 1}).to_list(50)
    exam_ids = [e["id"] for e in exams]
    if exam_ids:
        await db.exams.delete_many({"id": {"$in": exam_ids}})
        # Pull exam ids from any students that had them
        await db.students.update_many(
            {"exam_ids": {"$in": exam_ids}},
            {"$pull": {"exam_ids": {"$in": exam_ids}}},
        )
    return {"ok": True, "exams_deleted": len(exam_ids)}

