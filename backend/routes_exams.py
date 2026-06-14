"""Exam routes: admin CRUD, student start/save/submit, proctoring & results."""
import random
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException
from core import db, require_admin, require_student, get_current_user, new_id, now_utc, iso
from models import (
    ExamIn, StartAttemptIn, SaveAnswerIn, SubmitAttemptIn,
    TabSwitchLogIn, SnapshotIn,
)

router = APIRouter(prefix="/exams", tags=["exams"])


# ---------- Helpers ----------
def _strip(q: dict, include_answer: bool = False) -> dict:
    q.pop("_id", None)
    if not include_answer:
        q.pop("correct_answer", None)
        q.pop("explanation", None)
    return q


def _is_correct(question: dict, answer: Any) -> bool:
    qtype = question.get("type", "mcq_single")
    correct = question.get("correct_answer")
    if answer is None or answer == "" or correct is None:
        return False
    if qtype == "mcq_multi":
        if not isinstance(answer, list) or not isinstance(correct, list):
            return False
        return sorted(answer) == sorted(correct)
    if qtype == "numerical":
        try:
            return abs(float(answer) - float(correct)) < 1e-3
        except Exception:
            return str(answer).strip() == str(correct).strip()
    return str(answer).strip().lower() == str(correct).strip().lower()


# ---------- Admin: Exam CRUD ----------
@router.get("")
async def list_exams(user=Depends(get_current_user)):
    if user["role"] == "admin":
        exams = await db.exams.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        # Student sees only published / assigned exams
        student = await db.students.find_one({"id": user["id"]}, {"_id": 0})
        assigned_ids = (student or {}).get("exam_ids") or []
        exams = await db.exams.find({"$or": [
            {"is_published": True, "price": 0},
            {"id": {"$in": assigned_ids}},
        ]}, {"_id": 0, "question_ids": 0}).sort("created_at", -1).to_list(1000)
        # Mark which exams the student already attempted/submitted
        for e in exams:
            attempt = await db.attempts.find_one(
                {"exam_id": e["id"], "student_id": user["id"], "status": "submitted"}, {"_id": 0}
            )
            e["attempted"] = bool(attempt)
            e["last_score"] = attempt["score"] if attempt else None
    return exams


@router.get("/{exam_id}")
async def get_exam(exam_id: str, _admin=Depends(require_admin)):
    e = await db.exams.find_one({"id": exam_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Exam not found")
    return e


@router.post("")
async def create_exam(data: ExamIn, _admin=Depends(require_admin)):
    doc = data.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = iso(now_utc())
    await db.exams.insert_one(doc)
    doc.pop("_id", None)
    await db.activities.insert_one({
        "id": new_id(),
        "type": "exam_created",
        "text": f"Exam '{doc['name']}' created",
        "created_at": iso(now_utc()),
    })
    return doc


@router.put("/{exam_id}")
async def update_exam(exam_id: str, data: ExamIn, _admin=Depends(require_admin)):
    res = await db.exams.update_one({"id": exam_id}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Exam not found")
    return await db.exams.find_one({"id": exam_id}, {"_id": 0})


@router.delete("/{exam_id}")
async def delete_exam(exam_id: str, _admin=Depends(require_admin)):
    await db.exams.delete_one({"id": exam_id})
    return {"ok": True}


@router.post("/{exam_id}/clone")
async def clone_exam(exam_id: str, _admin=Depends(require_admin)):
    e = await db.exams.find_one({"id": exam_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Exam not found")
    e["id"] = new_id()
    e["name"] = e["name"] + " (Copy)"
    e["created_at"] = iso(now_utc())
    e["is_published"] = False
    await db.exams.insert_one(e)
    e.pop("_id", None)
    return e


# ---------- Student: Attempt flow ----------
@router.post("/start")
async def start_attempt(data: StartAttemptIn, student=Depends(require_student)):
    exam = await db.exams.find_one({"id": data.exam_id}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if not exam.get("is_published"):
        raise HTTPException(status_code=403, detail="Exam not available")

    # Check existing in-progress attempt
    existing = await db.attempts.find_one({
        "exam_id": data.exam_id, "student_id": student["id"], "status": "in_progress"
    }, {"_id": 0})
    if existing:
        return existing

    # Already submitted? Don't allow re-attempt (one-shot for simplicity).
    submitted = await db.attempts.find_one({
        "exam_id": data.exam_id, "student_id": student["id"], "status": "submitted"
    }, {"_id": 0})
    if submitted:
        raise HTTPException(status_code=400, detail="You have already attempted this exam.")

    # Fetch questions
    q_ids = exam.get("question_ids") or []
    questions = await db.questions.find({"id": {"$in": q_ids}}, {"_id": 0}).to_list(1000)
    # Preserve order
    qmap = {q["id"]: q for q in questions}
    ordered = [qmap[i] for i in q_ids if i in qmap]
    if exam.get("randomize"):
        random.shuffle(ordered)

    attempt = {
        "id": new_id(),
        "exam_id": data.exam_id,
        "exam_name": exam["name"],
        "student_id": student["id"],
        "student_name": student.get("name"),
        "started_at": iso(now_utc()),
        "duration_minutes": exam.get("duration_minutes", 60),
        "allowed_tab_switches": exam.get("allowed_tab_switches", 3),
        "tab_switches": 0,
        "violations": [],
        "answers": {},  # qid -> {answer, status}
        "questions": [_strip(dict(q)) for q in ordered],
        "status": "in_progress",
        "score": None,
        "max_score": sum(q.get("marks", 0) for q in ordered),
    }
    await db.attempts.insert_one(attempt)
    attempt.pop("_id", None)
    await db.activities.insert_one({
        "id": new_id(),
        "type": "exam_started",
        "text": f"{student.get('name')} started '{exam['name']}'",
        "created_at": iso(now_utc()),
    })
    return attempt


@router.get("/attempt/{attempt_id}")
async def get_attempt(attempt_id: str, student=Depends(require_student)):
    a = await db.attempts.find_one({"id": attempt_id, "student_id": student["id"]}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return a


@router.post("/save")
async def save_answer(data: SaveAnswerIn, student=Depends(require_student)):
    a = await db.attempts.find_one({"id": data.attempt_id, "student_id": student["id"]}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if a["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Attempt already submitted")
    await db.attempts.update_one(
        {"id": data.attempt_id},
        {"$set": {f"answers.{data.question_id}": {"answer": data.answer, "status": data.status}}},
    )
    return {"ok": True}


@router.post("/violation")
async def log_violation(data: TabSwitchLogIn, student=Depends(require_student)):
    a = await db.attempts.find_one({"id": data.attempt_id, "student_id": student["id"]}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if a["status"] != "in_progress":
        return {"ok": True, "auto_submit": False}
    violation = {
        "id": new_id(),
        "type": data.violation_type,
        "at": iso(now_utc()),
    }
    new_switches = a.get("tab_switches", 0) + (1 if data.violation_type == "tab_switch" else 0)
    allowed = a.get("allowed_tab_switches", 3)
    update = {"$push": {"violations": violation}}
    auto_submit = False
    if data.violation_type == "tab_switch":
        update["$set"] = {"tab_switches": new_switches}
        if new_switches >= allowed:
            auto_submit = True
    await db.attempts.update_one({"id": data.attempt_id}, update)
    if auto_submit:
        await _do_submit(data.attempt_id, reason="tab_switch_limit_exceeded")
    return {"ok": True, "auto_submit": auto_submit, "tab_switches": new_switches, "allowed": allowed}


@router.post("/snapshot")
async def store_snapshot(data: SnapshotIn, student=Depends(require_student)):
    a = await db.attempts.find_one({"id": data.attempt_id, "student_id": student["id"]}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attempt not found")
    snap = {
        "id": new_id(),
        "attempt_id": data.attempt_id,
        "student_id": student["id"],
        "at": iso(now_utc()),
        "violation": data.violation,
        # We do NOT store the full image to keep DB small — store size only
        "size_bytes": len(data.image_base64),
    }
    await db.proctor_snapshots.insert_one(snap)
    if data.violation:
        await db.attempts.update_one(
            {"id": data.attempt_id},
            {"$push": {"violations": {"id": new_id(), "type": data.violation, "at": iso(now_utc())}}},
        )
    snap.pop("_id", None)
    return snap


async def _do_submit(attempt_id: str, reason: Optional[str] = None) -> dict:
    a = await db.attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if a["status"] == "submitted":
        return a

    exam = await db.exams.find_one({"id": a["exam_id"]}, {"_id": 0})
    negative = (exam or {}).get("negative_marking", True)
    # Need actual questions with answers
    qids = [q["id"] for q in a["questions"]]
    full = await db.questions.find({"id": {"$in": qids}}, {"_id": 0}).to_list(1000)
    full_map = {q["id"]: q for q in full}

    answers = a.get("answers", {})
    score = 0.0
    correct = 0
    wrong = 0
    skipped = 0
    subject_stats: dict = {}
    per_q = []
    for q in a["questions"]:
        qid = q["id"]
        info = full_map.get(qid, {})
        ans = (answers.get(qid) or {}).get("answer")
        marks = q.get("marks", 4)
        neg = q.get("negative_marks", 1) if negative else 0
        result = "skipped"
        if ans is None or ans == "" or ans == []:
            skipped += 1
            mark_got = 0
        elif _is_correct(info, ans):
            correct += 1
            mark_got = marks
            result = "correct"
        else:
            wrong += 1
            mark_got = -neg
            result = "wrong"
        score += mark_got
        subj = q.get("subject") or "General"
        s = subject_stats.setdefault(subj, {"correct": 0, "wrong": 0, "skipped": 0, "score": 0})
        s[result] = s.get(result, 0) + 1
        s["score"] += mark_got
        per_q.append({"qid": qid, "result": result, "marks": mark_got, "correct_answer": info.get("correct_answer"), "given": ans, "explanation": info.get("explanation", "")})

    update = {
        "status": "submitted",
        "submitted_at": iso(now_utc()),
        "score": round(score, 2),
        "correct": correct,
        "wrong": wrong,
        "skipped": skipped,
        "subject_stats": subject_stats,
        "per_question": per_q,
        "submit_reason": reason or "manual",
    }
    await db.attempts.update_one({"id": attempt_id}, {"$set": update})
    await db.activities.insert_one({
        "id": new_id(),
        "type": "exam_submitted",
        "text": f"{a.get('student_name')} submitted '{a.get('exam_name')}' — {update['score']}/{a.get('max_score')}",
        "created_at": iso(now_utc()),
    })
    return await db.attempts.find_one({"id": attempt_id}, {"_id": 0})


@router.post("/submit")
async def submit_attempt(data: SubmitAttemptIn, student=Depends(require_student)):
    a = await db.attempts.find_one({"id": data.attempt_id, "student_id": student["id"]}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return await _do_submit(data.attempt_id, reason="manual")


# ---------- Results & Rank ----------
@router.get("/result/{attempt_id}")
async def get_result(attempt_id: str, user=Depends(get_current_user)):
    a = await db.attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if user["role"] == "student" and a["student_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if a["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Attempt not submitted yet")

    # Compute rank
    siblings = await db.attempts.find(
        {"exam_id": a["exam_id"], "status": "submitted"}, {"_id": 0, "student_id": 1, "score": 1, "student_name": 1}
    ).sort("score", -1).to_list(5000)
    rank = next((i + 1 for i, s in enumerate(siblings) if s["student_id"] == a["student_id"]), None)
    total = len(siblings)
    a["rank"] = rank
    a["total_participants"] = total
    a["leaderboard"] = siblings[:10]
    # Accuracy
    attempted = a.get("correct", 0) + a.get("wrong", 0)
    a["accuracy"] = round((a.get("correct", 0) / attempted) * 100, 2) if attempted else 0
    return a


@router.get("/public/result/{attempt_id}")
async def public_result(attempt_id: str):
    """Parent-friendly link — no auth, but no answer key shown."""
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
    }
    # Rank
    siblings = await db.attempts.count_documents({"exam_id": a["exam_id"], "status": "submitted", "score": {"$gt": a.get("score") or 0}})
    safe["rank"] = siblings + 1
    safe["total_participants"] = await db.attempts.count_documents({"exam_id": a["exam_id"], "status": "submitted"})
    return safe


@router.get("/{exam_id}/leaderboard")
async def leaderboard(exam_id: str, _admin=Depends(require_admin)):
    rows = await db.attempts.find(
        {"exam_id": exam_id, "status": "submitted"},
        {"_id": 0, "student_id": 1, "student_name": 1, "score": 1, "correct": 1, "wrong": 1, "skipped": 1, "submitted_at": 1},
    ).sort("score", -1).to_list(5000)
    return rows


@router.get("/{exam_id}/analytics")
async def exam_analytics(exam_id: str, _admin=Depends(require_admin)):
    rows = await db.attempts.find({"exam_id": exam_id, "status": "submitted"}, {"_id": 0}).to_list(5000)
    if not rows:
        return {"count": 0, "highest": 0, "lowest": 0, "avg": 0, "pass_pct": 0, "subject_avg": {}}
    scores = [r.get("score") or 0 for r in rows]
    exam = await db.exams.find_one({"id": exam_id}, {"_id": 0}) or {}
    pass_marks = exam.get("passing_marks", 0)
    passed = sum(1 for s in scores if s >= pass_marks)
    subj_acc: dict = {}
    for r in rows:
        for subj, st in (r.get("subject_stats") or {}).items():
            d = subj_acc.setdefault(subj, {"score": 0, "n": 0})
            d["score"] += st.get("score", 0)
            d["n"] += 1
    subj_avg = {k: round(v["score"] / max(v["n"], 1), 2) for k, v in subj_acc.items()}
    return {
        "count": len(rows),
        "highest": max(scores),
        "lowest": min(scores),
        "avg": round(sum(scores) / len(scores), 2),
        "pass_pct": round(passed * 100 / len(rows), 2),
        "subject_avg": subj_avg,
    }
