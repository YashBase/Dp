"""Backend pytest suite for Gyansai Maths IIT Center API.

Covers: auth, dashboard, institute settings, student CRUD, question bank + meta + bulk-save,
exam CRUD + clone + publish, student attempt flow (start/save/violation/submit),
result + public result + certificate PDF, test series checkout, OCR via Emergent LLM key.
"""
import base64
import io
import os
import time
import pytest
import requests
from PIL import Image, ImageDraw, ImageFont

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://iit-test-portal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@gyansai.com"
ADMIN_PASS = "admin123"
DEMO_USER = "demo"
DEMO_PASS = "demo123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def student_token():
    r = requests.post(f"{API}/auth/student/login", json={"username": DEMO_USER, "password": DEMO_PASS}, timeout=30)
    assert r.status_code == 200, f"student login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def student_headers(student_token):
    return {"Authorization": f"Bearer {student_token}"}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login_success(self):
        r = requests.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        assert r.status_code == 200
        body = r.json()
        assert body["role"] == "admin"
        assert isinstance(body["token"], str) and len(body["token"]) > 10
        assert body["user"]["email"] == ADMIN_EMAIL

    def test_student_login_success(self):
        r = requests.post(f"{API}/auth/student/login", json={"username": DEMO_USER, "password": DEMO_PASS})
        assert r.status_code == 200
        body = r.json()
        assert body["role"] == "student"
        assert body["user"]["username"] == DEMO_USER

    def test_student_login_wrong_password(self):
        r = requests.post(f"{API}/auth/student/login", json={"username": DEMO_USER, "password": "wrong"})
        assert r.status_code == 401

    def test_me_endpoint(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json().get("role") == "admin"


# ---------- Dashboard ----------
class TestDashboard:
    def test_admin_dashboard(self, admin_headers):
        r = requests.get(f"{API}/admin/dashboard", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for k in ["kpis", "revenue_chart", "student_growth", "exam_performance", "recent_activities", "live_attempts"]:
            assert k in data, f"missing {k}"
        assert "total_students" in data["kpis"]


# ---------- Institute Settings ----------
class TestInstituteSettings:
    def test_get_settings_public_admin(self, admin_headers):
        r = requests.get(f"{API}/admin/settings", headers=admin_headers)
        assert r.status_code == 200

    def test_update_settings_persists(self, admin_headers):
        new_name = "Gyansai Maths IIT Center"
        new_tag = f"TEST tagline {int(time.time())}"
        r = requests.put(f"{API}/admin/settings",
                         headers=admin_headers,
                         json={"name": new_name, "tagline": new_tag})
        assert r.status_code == 200, r.text
        assert r.json()["tagline"] == new_tag
        # verify persistence
        g = requests.get(f"{API}/admin/settings", headers=admin_headers).json()
        assert g["tagline"] == new_tag
        assert g["name"] == new_name


# ---------- Students CRUD ----------
class TestStudents:
    def test_create_duplicate_update_delete(self, admin_headers):
        uname = f"TEST_stu_{int(time.time())}"
        # create
        r = requests.post(f"{API}/admin/students", headers=admin_headers,
                          json={"name": "TEST Student", "username": uname, "password": "pass123"})
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        assert r.json()["username"] == uname

        # duplicate
        r2 = requests.post(f"{API}/admin/students", headers=admin_headers,
                           json={"name": "Dup", "username": uname})
        assert r2.status_code == 400

        # update
        ru = requests.put(f"{API}/admin/students/{sid}", headers=admin_headers,
                          json={"name": "TEST Updated"})
        assert ru.status_code == 200
        assert ru.json()["name"] == "TEST Updated"

        # list contains updated
        rl = requests.get(f"{API}/admin/students", headers=admin_headers, params={"q": uname})
        assert rl.status_code == 200
        assert any(s["id"] == sid for s in rl.json())

        # delete
        rd = requests.delete(f"{API}/admin/students/{sid}", headers=admin_headers)
        assert rd.status_code == 200
        # confirm gone
        rl2 = requests.get(f"{API}/admin/students", headers=admin_headers, params={"q": uname})
        assert all(s["id"] != sid for s in rl2.json())


# ---------- Question Bank ----------
class TestQuestions:
    def test_meta(self, admin_headers):
        r = requests.get(f"{API}/questions/meta", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["subjects", "chapters", "topics", "total"]:
            assert k in d

    def test_crud_and_filter(self, admin_headers):
        payload = {
            "title": "TEST Q what is 2+2?",
            "subject": "Mathematics",
            "chapter": "Arithmetic",
            "topic": "Addition",
            "difficulty": "easy",
            "type": "mcq_single",
            "options": [{"key": "A", "text": "3"}, {"key": "B", "text": "4"}],
            "correct_answer": "B",
            "explanation": "2+2=4",
        }
        r = requests.post(f"{API}/questions", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        qid = r.json()["id"]

        # filter
        rl = requests.get(f"{API}/questions", headers=admin_headers, params={"subject": "Mathematics", "q": "TEST Q"})
        assert rl.status_code == 200
        assert any(q["id"] == qid for q in rl.json())

        # update
        ru = requests.put(f"{API}/questions/{qid}", headers=admin_headers, json={**payload, "title": "TEST Q updated"})
        assert ru.status_code == 200
        assert ru.json()["title"] == "TEST Q updated"

        # delete
        rd = requests.delete(f"{API}/questions/{qid}", headers=admin_headers)
        assert rd.status_code == 200

    def test_bulk_save(self, admin_headers):
        items = [
            {"title": "TEST bulk q1", "subject": "Physics", "options": [{"key": "A", "text": "x"}], "correct_answer": "A"},
            {"title": "TEST bulk q2", "subject": "Chemistry", "options": [{"key": "A", "text": "y"}], "correct_answer": "A"},
        ]
        r = requests.post(f"{API}/questions/bulk-save", headers=admin_headers, json={"questions": items})
        assert r.status_code == 200
        assert r.json()["saved"] == 2


# ---------- Exams ----------
@pytest.fixture(scope="session")
def seeded_exam_and_questions(admin_headers):
    """Find the seeded JEE Main exam (which has question_ids)."""
    r = requests.get(f"{API}/exams", headers=admin_headers)
    assert r.status_code == 200
    exams = r.json()
    target = next((e for e in exams if "JEE" in e.get("name", "")), None)
    assert target, "Seeded exam not found"
    # ensure published
    requests.put(f"{API}/exams/{target['id']}", headers=admin_headers, json={**{k: v for k, v in target.items() if k in [
        "name", "description", "type", "duration_minutes", "start_at", "end_at", "passing_marks",
        "instructions", "randomize", "negative_marking", "question_ids", "allowed_tab_switches",
        "enable_webcam", "price"
    ]}, "is_published": True})
    return target


class TestExamCRUD:
    def test_exam_list(self, admin_headers):
        r = requests.get(f"{API}/exams", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_exam_create_update_clone_delete(self, admin_headers):
        payload = {
            "name": "TEST Exam CRUD",
            "description": "test",
            "duration_minutes": 30,
            "question_ids": [],
            "is_published": False,
        }
        r = requests.post(f"{API}/exams", headers=admin_headers, json=payload)
        assert r.status_code == 200
        eid = r.json()["id"]

        # update / publish
        upd = {**payload, "is_published": True, "name": "TEST Exam Updated"}
        ru = requests.put(f"{API}/exams/{eid}", headers=admin_headers, json=upd)
        assert ru.status_code == 200
        assert ru.json()["is_published"] is True

        # clone
        rc = requests.post(f"{API}/exams/{eid}/clone", headers=admin_headers)
        assert rc.status_code == 200
        cid = rc.json()["id"]
        assert cid != eid
        assert "(Copy)" in rc.json()["name"]

        # delete both
        assert requests.delete(f"{API}/exams/{eid}", headers=admin_headers).status_code == 200
        assert requests.delete(f"{API}/exams/{cid}", headers=admin_headers).status_code == 200


# ---------- Student Attempt Flow (requires fresh student to avoid one-shot lock) ----------
@pytest.fixture(scope="session")
def fresh_student_token(admin_headers, seeded_exam_and_questions):
    """Create fresh student with exam assigned, then log in to get token."""
    uname = f"TEST_attempt_{int(time.time())}"
    pw = "pass1234"
    r = requests.post(f"{API}/admin/students", headers=admin_headers,
                      json={"name": "TEST Attempt", "username": uname, "password": pw})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    # assign the exam
    eid = seeded_exam_and_questions["id"]
    ra = requests.post(f"{API}/admin/students/{sid}/assign", headers=admin_headers, json={"exam_ids": [eid]})
    assert ra.status_code == 200
    # login
    rl = requests.post(f"{API}/auth/student/login", json={"username": uname, "password": pw})
    assert rl.status_code == 200
    return {"token": rl.json()["token"], "id": sid, "username": uname, "exam_id": eid}


class TestAttemptFlow:
    def test_start_save_violation_submit_result(self, fresh_student_token, seeded_exam_and_questions):
        eid = seeded_exam_and_questions["id"]
        headers = {"Authorization": f"Bearer {fresh_student_token['token']}"}

        # start
        r = requests.post(f"{API}/exams/start", headers=headers, json={"exam_id": eid})
        assert r.status_code == 200, r.text
        attempt = r.json()
        aid = attempt["id"]
        qs = attempt["questions"]
        assert len(qs) > 0
        # questions must NOT include correct_answer/explanation
        for q in qs:
            assert "correct_answer" not in q
            assert "explanation" not in q

        # save first question (answer A — may be right or wrong)
        first_q = qs[0]
        rsave = requests.post(f"{API}/exams/save", headers=headers,
                              json={"attempt_id": aid, "question_id": first_q["id"], "answer": "A", "status": "answered"})
        assert rsave.status_code == 200

        # save a second one if available
        if len(qs) > 1:
            requests.post(f"{API}/exams/save", headers=headers,
                          json={"attempt_id": aid, "question_id": qs[1]["id"], "answer": "B", "status": "answered"})

        # violation: tab_switch (allowed=3 by default, should not auto-submit)
        rv = requests.post(f"{API}/exams/violation", headers=headers,
                           json={"attempt_id": aid, "violation_type": "tab_switch"})
        assert rv.status_code == 200
        body = rv.json()
        assert body["tab_switches"] >= 1
        # Likely auto_submit False unless allowed=1
        # submit
        rs = requests.post(f"{API}/exams/submit", headers=headers, json={"attempt_id": aid})
        assert rs.status_code == 200, rs.text
        result = rs.json()
        assert result["status"] == "submitted"
        for k in ["score", "correct", "wrong", "skipped", "subject_stats", "per_question"]:
            assert k in result, f"missing {k}"
        # per_question should expose correct_answer & explanation after submit
        assert "correct_answer" in result["per_question"][0]

        # result endpoint
        rr = requests.get(f"{API}/exams/result/{aid}", headers=headers)
        assert rr.status_code == 200
        rj = rr.json()
        assert "rank" in rj and "leaderboard" in rj and "accuracy" in rj

        # public result
        pr = requests.get(f"{API}/exams/public/result/{aid}")
        assert pr.status_code == 200
        pjson = pr.json()
        assert "score" in pjson
        # should NOT expose per_question or answers
        assert "per_question" not in pjson
        assert "answers" not in pjson

        # certificate PDF
        cert = requests.get(f"{API}/public/certificate/{aid}")
        assert cert.status_code == 200
        assert "application/pdf" in cert.headers.get("content-type", "")
        assert cert.content[:4] == b"%PDF"

        # store attempt_id for next tests
        TestAttemptFlow.attempt_id = aid


# ---------- Test Series Checkout (mocked) ----------
class TestCheckout:
    def test_checkout_grants_exam_access(self, admin_headers):
        # find a test series
        rs = requests.get(f"{API}/admin/test-series", headers=admin_headers)
        assert rs.status_code == 200
        series_list = rs.json()
        if not series_list:
            pytest.skip("No test series seeded")
        ts = series_list[0]

        # create a fresh student and login
        uname = f"TEST_checkout_{int(time.time())}"
        pw = "pass1234"
        rc = requests.post(f"{API}/admin/students", headers=admin_headers,
                           json={"name": "TEST Checkout", "username": uname, "password": pw})
        assert rc.status_code == 200
        sid = rc.json()["id"]
        rl = requests.post(f"{API}/auth/student/login", json={"username": uname, "password": pw})
        token = rl.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # checkout
        rco = requests.post(f"{API}/student/checkout", headers=headers,
                            json={"item_type": "test_series", "item_id": ts["id"], "coupon": "GYAN10"})
        assert rco.status_code == 200, rco.text
        body = rco.json()
        assert body["mocked"] is True
        assert body["payment"]["status"] == "success"

        # verify access
        prof = requests.get(f"{API}/student/profile", headers=headers).json()
        for eid in ts.get("exam_ids", []):
            assert eid in (prof.get("exam_ids") or []), f"exam {eid} not granted"

        # cleanup
        requests.delete(f"{API}/admin/students/{sid}", headers=admin_headers)


# ---------- OCR ----------
def _make_question_image_b64() -> str:
    """Render a clear printed math question image and return base64 PNG."""
    img = Image.new("RGB", (900, 350), "white")
    d = ImageDraw.Draw(img)
    try:
        font_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except Exception:
        font_big = ImageFont.load_default()
        font_sm = ImageFont.load_default()
    d.text((30, 20), "Q1. What is the value of 2 + 3 * 4 ?", fill="black", font=font_big)
    d.text((60, 90), "(A) 20", fill="black", font=font_sm)
    d.text((60, 130), "(B) 14", fill="black", font=font_sm)
    d.text((60, 170), "(C) 24", fill="black", font=font_sm)
    d.text((60, 210), "(D) 11", fill="black", font=font_sm)
    # add some shapes for visual variety
    d.rectangle([20, 10, 880, 260], outline="black", width=2)
    d.line([(30, 270), (870, 270)], fill="black", width=1)
    d.text((30, 285), "Subject: Mathematics  |  Topic: Order of operations", fill="black", font=font_sm)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


class TestOCR:
    def test_ocr_extracts_questions(self, admin_headers):
        b64 = _make_question_image_b64()
        r = requests.post(f"{API}/questions/ocr", headers=admin_headers,
                          json={"image_base64": b64, "mime_type": "image/png"}, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "questions" in data
        assert isinstance(data["questions"], list)
        # The LLM should extract at least 1 question from the clear printed image
        assert len(data["questions"]) >= 1, f"OCR returned no questions: {data}"
        q = data["questions"][0]
        assert "title" in q
        assert q.get("type")
        assert q.get("subject")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
