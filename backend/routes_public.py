"""Public routes (no auth): institute branding, certificate PDF, public catalogs."""
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
