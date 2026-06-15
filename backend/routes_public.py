"""Public routes (no auth): institute branding, certificate PDF, public catalogs."""
import base64
from io import BytesIO
import qrcode
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from core import db

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/institute")
async def public_institute():
    s = await db.institute_settings.find_one({"id": "default"}, {"_id": 0, "bank_account": 0, "bank_ifsc": 0})
    return s or {}


@router.get("/courses")
async def public_courses():
    """Course catalog for landing page — only published & metadata."""
    courses = await db.courses.find(
        {"is_published": True},
        {"_id": 0, "chapters": 0},
    ).limit(12).to_list(12)
    return courses


@router.get("/test-series")
async def public_test_series():
    return await db.test_series.find({"is_published": True}, {"_id": 0}).limit(12).to_list(12)


# ---------- Parent-accessible result + recording ----------
async def public_result_full(attempt_id: str):
    a = await db.attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not a or a.get("status") != "submitted":
        raise HTTPException(status_code=404, detail="Result not available")
    safe = {
        "id": a["id"],
        "exam_name": a["exam_name"],
        "student_name": a["student_name"],
        "score": a.get("score"),
        "max_score": a.get("max_score"),
        "correct": a.get("correct"),
        "wrong": a.get("wrong"),
        "skipped": a.get("skipped"),
        "subject_stats": a.get("subject_stats"),
        "submitted_at": a.get("submitted_at"),
        "violations_count": len(a.get("violations") or []),
        "tab_switches": a.get("tab_switches", 0),
        "violations": [{"type": v.get("type"), "at": v.get("at")} for v in (a.get("violations") or [])],
        "snapshots_count": await db.proctor_snapshots.count_documents({"attempt_id": attempt_id}),
    }
    siblings = await db.attempts.count_documents(
        {"exam_id": a["exam_id"], "status": "submitted", "score": {"$gt": a.get("score") or 0}}
    )
    safe["rank"] = siblings + 1
    safe["total_participants"] = await db.attempts.count_documents({"exam_id": a["exam_id"], "status": "submitted"})
    return safe


async def public_recording_full(attempt_id: str):
    a = await db.attempts.find_one(
        {"id": attempt_id}, {"_id": 0, "id": 1, "status": 1, "student_name": 1, "exam_name": 1},
    )
    if not a or a.get("status") != "submitted":
        raise HTTPException(status_code=404, detail="Recording not available")
    snaps = await db.proctor_snapshots.find(
        {"attempt_id": attempt_id}, {"_id": 0},
    ).sort("at", 1).to_list(5000)
    return {
        "attempt_id": attempt_id,
        "student_name": a.get("student_name"),
        "exam_name": a.get("exam_name"),
        "snapshots": snaps,
    }


@router.get("/result/{attempt_id}")
async def public_result(attempt_id: str):
    """Parent-friendly result page (no auth). Includes integrity summary, no answer key."""
    return await public_result_full(attempt_id)


@router.get("/recording/{attempt_id}")
async def public_recording(attempt_id: str):
    """Parent-friendly proctoring recording (no auth) — snapshots with images."""
    return await public_recording_full(attempt_id)


@router.get("/recording-chunks/{attempt_id}")
async def public_recording_chunks(attempt_id: str):
    """Parent-accessible list of video+audio recording chunks for a submitted attempt."""
    a = await db.attempts.find_one({"id": attempt_id}, {"_id": 0, "id": 1, "status": 1})
    if not a or a.get("status") != "submitted":
        raise HTTPException(status_code=404, detail="Recording not available")
    rows = await db.proctor_recordings.find(
        {"attempt_id": attempt_id}, {"_id": 0, "data_base64": 0},
    ).sort("at", 1).to_list(5000)
    return rows


@router.get("/recording-chunk/{attempt_id}/{chunk_id}")
async def public_recording_chunk(attempt_id: str, chunk_id: str):
    """Stream a single video+audio chunk for parent playback."""
    a = await db.attempts.find_one({"id": attempt_id}, {"_id": 0, "id": 1, "status": 1})
    if not a or a.get("status") != "submitted":
        raise HTTPException(status_code=404, detail="Recording not available")
    chunk = await db.proctor_recordings.find_one({"id": chunk_id, "attempt_id": attempt_id}, {"_id": 0})
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    raw = base64.b64decode(chunk.get("data_base64") or "")
    return StreamingResponse(
        BytesIO(raw),
        media_type=chunk.get("mime_type", "video/webm"),
        headers={"Content-Disposition": f"inline; filename=chunk-{chunk.get('chunk_index')}.webm"},
    )


@router.get("/certificate/{attempt_id}")
async def certificate_pdf(attempt_id: str):
    a = await db.attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not a or a.get("status") != "submitted":
        raise HTTPException(status_code=404, detail="Result not available")
    settings = await db.institute_settings.find_one({"id": "default"}, {"_id": 0}) or {}

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(A4))
    width, height = landscape(A4)

    # Background border
    c.setStrokeColor(HexColor("#002FA7"))
    c.setLineWidth(4)
    c.rect(20, 20, width - 40, height - 40)
    c.setLineWidth(1)
    c.rect(35, 35, width - 70, height - 70)

    # Heading
    c.setFillColor(HexColor("#0A0A0A"))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2, height - 90, settings.get("name", "Gyansai Maths IIT Center"))
    c.setFont("Helvetica", 12)
    c.drawCentredString(width / 2, height - 110, settings.get("tagline", ""))

    c.setFont("Helvetica-Bold", 36)
    c.setFillColor(HexColor("#002FA7"))
    c.drawCentredString(width / 2, height - 170, "Certificate of Achievement")

    c.setFillColor(HexColor("#0A0A0A"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 210, "This is to certify that")

    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(width / 2, height - 250, a.get("student_name", "Student"))

    c.setFont("Helvetica", 13)
    txt = f"has successfully completed the assessment \"{a.get('exam_name')}\" scoring {a.get('score')} / {a.get('max_score')}"
    c.drawCentredString(width / 2, height - 285, txt)

    rank = a.get("rank") or ""
    if rank:
        c.drawCentredString(width / 2, height - 305, f"with rank {rank}.")

    # QR code (verification link)
    qr = qrcode.make(f"/public/result/{attempt_id}")
    qr_buf = BytesIO()
    qr.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    c.drawImage(ImageReader(qr_buf), width - 160, 60, width=100, height=100)
    c.setFont("Helvetica", 9)
    c.drawString(width - 165, 50, "Scan to verify")

    c.setFont("Helvetica", 10)
    c.drawString(60, 80, f"Issued: {(a.get('submitted_at') or '')[:10]}")
    c.drawString(60, 65, f"Certificate ID: {attempt_id}")

    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=certificate-{attempt_id}.pdf"
    })
