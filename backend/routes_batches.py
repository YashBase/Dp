"""Batch management routes — Batch A/B/C per class."""
from fastapi import APIRouter, Depends, HTTPException
from core import db, require_admin, new_id, now_utc, iso
from models import BatchIn

router = APIRouter(prefix="/batches", tags=["batches"])


@router.get("")
async def list_batches(_admin=Depends(require_admin)):
    batches = await db.batches.find({}, {"_id": 0}).sort("class_level", 1).to_list(500)
    # Decorate with student counts
    for b in batches:
        b["student_count"] = await db.students.count_documents({"batch_id": b["id"]})
    return batches


@router.post("")
async def create_batch(data: BatchIn, _admin=Depends(require_admin)):
    doc = data.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = iso(now_utc())
    await db.batches.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{batch_id}")
async def update_batch(batch_id: str, data: BatchIn, _admin=Depends(require_admin)):
    res = await db.batches.update_one({"id": batch_id}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Batch not found")
    return await db.batches.find_one({"id": batch_id}, {"_id": 0})


@router.delete("/{batch_id}")
async def delete_batch(batch_id: str, _admin=Depends(require_admin)):
    await db.batches.delete_one({"id": batch_id})
    # Unassign students
    await db.students.update_many({"batch_id": batch_id}, {"$set": {"batch_id": ""}})
    # Remove from exam batch_ids
    await db.exams.update_many({"batch_ids": batch_id}, {"$pull": {"batch_ids": batch_id}})
    return {"ok": True}
