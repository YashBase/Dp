"""Exam routes: admin CRUD, student start/save/submit, proctoring & results."""
import random
from typing import Optional, List, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from core import db, require_admin, require_student, get_current_user, new_id, now_utc, iso
from models import (
    ExamIn, StartAttemptIn, SaveAnswerIn, SubmitAttemptIn,
    TabSwitchLogIn, SnapshotIn,
)

router = APIRouter(prefix="/exams", tags=["exams"])


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


SUBJECTIVE_TYPES = {"short", "long", "file"}


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

    # Schedule enforcement
    now = datetime.now(timezone.utc)
    start_dt = _parse_iso(exam.get("start_at"))
    end_dt = _parse_iso(exam.get("end_at"))
    if start_dt and now < start_dt:
        raise HTTPException(status_code=403, detail=f"Exam opens at {exam['start_at']}")
    if end_dt and now > end_dt:
        raise HTTPException(status_code=403, detail="Exam window has closed")

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
    pending = 0
    subject_stats: dict = {}
    per_q = []
    for q in a["questions"]:
        qid = q["id"]
        info = full_map.get(qid, {})
        ans = (answers.get(qid) or {}).get("answer")
        marks = q.get("marks", 4)
        neg = q.get("negative_marks", 1) if negative else 0
        qtype = q.get("type", "mcq_single")
        result = "skipped"
        mark_got = 0
        if ans is None or ans == "" or ans == []:
            skipped += 1
        elif qtype in SUBJECTIVE_TYPES:
            # Manual evaluation needed — score withheld until admin reviews
            result = "pending_review"
            pending += 1
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
        s = subject_stats.setdefault(subj, {"correct": 0, "wrong": 0, "skipped": 0, "pending_review": 0, "score": 0})
        s[result] = s.get(result, 0) + 1
        s["score"] += mark_got
        per_q.append({
            "qid": qid, "result": result, "marks": mark_got,
            "max_marks": marks,
            "type": qtype,
            "correct_answer": info.get("correct_answer"),
            "given": ans,
            "explanation": info.get("explanation", ""),
            "comment": None,
        })

    update = {
        "status": "submitted",
        "submitted_at": iso(now_utc()),
        "score": round(score, 2),
        "correct": correct,
        "wrong": wrong,
        "skipped": skipped,
        "pending_review": pending,
        "has_pending_review": pending > 0,
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



# ---------- Manual Evaluation (subjective answers) ----------
@router.get("/evaluation/pending")
async def list_pending_evaluations(_admin=Depends(require_admin)):
    """List attempts that have subjective answers awaiting manual review."""
    rows = await db.attempts.find(
        {"status": "submitted", "has_pending_review": True},
        {"_id": 0, "id": 1, "exam_id": 1, "exam_name": 1, "student_id": 1, "student_name": 1,
         "submitted_at": 1, "score": 1, "max_score": 1, "pending_review": 1},
    ).sort("submitted_at", -1).to_list(2000)
    return rows


@router.get("/evaluation/{attempt_id}")
async def get_evaluation(attempt_id: str, _admin=Depends(require_admin)):
    """Return only the subjective questions/answers for review."""
    a = await db.attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attempt not found")
    qmap = {q["id"]: q for q in (a.get("questions") or [])}
    answers = a.get("answers") or {}
    full = await db.questions.find({"id": {"$in": list(qmap.keys())}}, {"_id": 0}).to_list(1000)
    full_map = {q["id"]: q for q in full}
    items = []
    for pq in a.get("per_question") or []:
        qtype = pq.get("type") or qmap.get(pq["qid"], {}).get("type")
        if qtype not in SUBJECTIVE_TYPES:
            continue
        info = full_map.get(pq["qid"], {})
        items.append({
            "qid": pq["qid"],
            "type": qtype,
            "title": info.get("title") or qmap.get(pq["qid"], {}).get("title"),
            "subject": info.get("subject"),
            "max_marks": pq.get("max_marks") or info.get("marks", 0),
            "given": (answers.get(pq["qid"]) or {}).get("answer"),
            "current_marks": pq.get("marks", 0),
            "comment": pq.get("comment"),
            "result": pq.get("result"),
            "model_answer": info.get("correct_answer"),
            "explanation": info.get("explanation", ""),
        })
    return {
        "attempt_id": a["id"],
        "exam_name": a.get("exam_name"),
        "student_name": a.get("student_name"),
        "submitted_at": a.get("submitted_at"),
        "items": items,
        "pending_count": sum(1 for i in items if i["result"] == "pending_review"),
    }


@router.post("/evaluation/{attempt_id}")
async def save_evaluation(attempt_id: str, payload: dict, _admin=Depends(require_admin)):
    """Save admin's marks/comments for subjective questions.

    body: {evaluations: [{qid, marks, comment}]}
    """
    evals = payload.get("evaluations") or []
    if not isinstance(evals, list):
        raise HTTPException(status_code=400, detail="evaluations must be a list")

    a = await db.attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Attempt not found")

    per_q = list(a.get("per_question") or [])
    eval_map = {e["qid"]: e for e in evals if "qid" in e}
    delta_score = 0.0

    for pq in per_q:
        if pq["qid"] not in eval_map:
            continue
        e = eval_map[pq["qid"]]
        new_marks = float(e.get("marks") or 0)
        max_m = float(pq.get("max_marks") or 0)
        if new_marks < 0 or new_marks > max_m:
            raise HTTPException(status_code=400, detail=f"Marks must be 0..{max_m}")
        delta_score += new_marks - float(pq.get("marks") or 0)
        pq["marks"] = new_marks
        pq["comment"] = e.get("comment") or ""
        pq["result"] = "correct" if new_marks >= max_m else ("wrong" if new_marks == 0 else "partial")

    new_total = round(float(a.get("score") or 0) + delta_score, 2)
    pending = sum(1 for pq in per_q if pq.get("result") == "pending_review")

    # Recompute subject stats fresh
    subject_stats: dict = {}
    correct = wrong = skipped = pending_count = 0
    for pq in per_q:
        # Determine subject from original question doc snapshot
        subj = "General"
        for q in a.get("questions") or []:
            if q["id"] == pq["qid"]:
                subj = q.get("subject") or "General"
                break
        s = subject_stats.setdefault(subj, {"correct": 0, "wrong": 0, "skipped": 0, "pending_review": 0, "partial": 0, "score": 0})
        r = pq.get("result", "skipped")
        s[r] = s.get(r, 0) + 1
        s["score"] = round(s.get("score", 0) + (pq.get("marks") or 0), 2)
        if r == "correct": correct += 1
        elif r == "wrong": wrong += 1
        elif r == "skipped": skipped += 1
        elif r == "pending_review": pending_count += 1

    await db.attempts.update_one(
        {"id": attempt_id},
        {"$set": {
            "per_question": per_q,
            "score": new_total,
            "has_pending_review": pending_count > 0,
            "pending_review": pending_count,
            "correct": correct,
            "wrong": wrong,
            "skipped": skipped,
            "subject_stats": subject_stats,
            "evaluated_at": iso(now_utc()),
        }},
    )
    await db.activities.insert_one({
        "id": new_id(),
        "type": "evaluation_saved",
        "text": f"Evaluation saved for '{a.get('student_name')}' — '{a.get('exam_name')}' (new score: {new_total})",
        "created_at": iso(now_utc()),
    })
    return await db.attempts.find_one({"id": attempt_id}, {"_id": 0})
