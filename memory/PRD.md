# Gyansai Maths IIT Center — Test Portal

## Original Problem Statement
Build a complete production-ready SaaS Online Examination & LMS for an Indian IIT-JEE/NEET/MHT-CET coaching center: institute settings, auth (admin + student), question bank with OCR photo/PDF import, exam builder, student exam portal with proctoring (webcam + tab-switch + auto-submit), results & analytics, courses, test series, payments, certificates, parent access.

**Tech adapted:** React (CRA) + FastAPI + MongoDB (Emergent platform constraint). Original spec asked for Next.js/NestJS/PostgreSQL; functionality is feature-parity.

## Users / Personas
1. **Super Admin** — institute owner. Manages branding, question bank, students, exams, courses, test series, settings.
2. **Student** — JEE/NEET/MHT-CET aspirant. Takes proctored mock exams, reviews results, enrolls in courses & test series.
3. **Parent** — receives public result link (no auth) to verify child's performance.

## Architecture
- **Backend:** FastAPI modular routers (`routes_auth`, `routes_admin`, `routes_questions`, `routes_exams`, `routes_student`, `routes_public`). JWT auth via `core.py`. All routes prefixed `/api`.
- **DB:** MongoDB collections: `admins`, `students`, `institute_settings`, `questions`, `exams`, `attempts`, `proctor_snapshots`, `payments`, `courses`, `test_series`, `activities`.
- **OCR:** OpenAI Vision (`gpt-4o`) via `emergentintegrations` with EMERGENT_LLM_KEY. PDF support via PyMuPDF (rasterizes each page to PNG before Vision call).
- **Frontend:** React 19, react-router v7, recharts, shadcn UI, tailwind. Design = "Swiss / brutalist" with International Klein Blue.

## What's Implemented
- ✅ Branded landing page + login (admin + student tabs)
- ✅ JWT auth with bcrypt; seed admin (`admin@gyansai.com` / `admin123`) & demo student (`demo` / `demo123`)
- ✅ Editable institute settings (branding, contact, payments, SEO, social)
- ✅ Admin dashboard with KPIs, charts, recent activity, live attempt monitor
- ✅ Student CRUD + bulk xlsx import + status toggle + assign courses/exams
- ✅ Question Bank: CRUD, filters, 7 question types
- ✅ **Photo/PDF question import via OpenAI Vision OCR** — supports both images & multi-page PDFs (up to 15 pages, PyMuPDF rasterization). [2026-02-14, re-verified 2026-06-15]
- ✅ Exam builder with rules + proctoring + scheduling (start/end UTC)
- ✅ **Exam Folders/Tags** — admin & student exam pages group exams by `exam_tag` field (📁 sections). [2026-06-14]
- ✅ Exam clone, publish/unpublish, per-exam analytics & leaderboard
- ✅ Student Exam Portal with pre-exam camera/mic gate, timer, palette, mark-for-review, auto-save
- ✅ Online proctoring: webcam preview + snapshot upload + video/audio chunk recording + tab-switch + fullscreen-exit + copy/right-click block + auto-submit
- ✅ Admin Results & Recording viewer (authenticated Blob URL playback) with cascade delete
- ✅ Parent public result link (`/r/:attemptId`, no auth) with recording playback
- ✅ Certificate PDF with QR code
- ✅ Course catalog with chapter videos
- ✅ Manual Course Purchase flow (UPI UTR submission → Admin approval → access grant)
- ✅ Test Series storefront with coupon
- ✅ Mobile responsiveness (drawer nav, responsive exam portal)

## MOCKED / Deferred
- ⚠️ **Live Razorpay** — only manual UTR approval implemented
- ⚠️ **Email / SMS / WhatsApp notifications** — not implemented (P1)
- ⚠️ **Proctor snapshots** — uploaded but image bytes are dropped (only size logged). Wire S3 in production.
- ⚠️ **Video hosting** — uses YouTube embed URLs instead of Cloudflare Stream
- ⚠️ **2FA OTP** — not implemented

## P1 Backlog
- Notifications system (Resend / SendGrid email + Twilio SMS) — exam reminders, result publishing, payment approved
- Live Razorpay UPI/cards checkout
- S3 storage for snapshots & student photos
- 2FA OTP for admin
- Manual evaluation flow polish for subjective questions

## P2 Backlog
- Certificate auto-generation on course completion (extend existing certificate route)
- Advanced dashboard charts (revenue, student growth, exam performance time-series)
- Dark mode toggle
- Audit logs UI
- Rate limiting / CSRF middleware

## Recent Changes (2026-06-15)
- **PDF OCR support** added — `POST /api/questions/ocr/upload` now accepts PDF; each page is rasterized via PyMuPDF and OCR'd. Frontend accept attribute updated to `image/*,application/pdf,.pdf`. Up to 15 pages processed.
- **Student exam folder grouping** added — `/app/exams` now groups exams by `exam_tag` mirroring admin view.
- Tested via `/app/test_reports/iteration_7.json` — 7/7 backend pytest + 9/9 UI scenarios pass.

## Recent Changes (2026-06-15, later)
- **Class / Section** on students & exams: 11th and 12th Standard. Admin Students dialog has class dropdown; table shows Class column. Admin Exams dialog has Class select; student-side exam cards display class badge.
- **Tag presets** on Exam dialog: quick-pick chips for JEE Mains, JEE Advanced, MHT-CET, NEET (plus free-text custom tag).
- **Assigned Students picker** on Exam dialog (new "Students" tab) — admin can target specific students; backend syncs `student.exam_ids` on save/update. Visibility logic: if `assigned_student_ids` is set, only those students see the exam in their portal (even if published).
- **Student Courses catalog fix** — `/api/student/courses` now returns ALL published courses (free + paid) with a `purchased` flag. Paid unowned courses return locked preview (chapters stripped). Course detail page shows "Unlock for ₹X" CTA → PaymentDialog → UTR submission → Admin approval → unlocked content + appears in My Purchases.
- Tested via `/app/test_reports/iteration_8.json` — 6/6 backend pytest + full E2E course purchase flow verified.

## Recent Changes (2026-06-15, evening) — Question-Bank Folders + Quick Assign Wizard
- **Test Folder on questions** — new `test_folder` field on every question. UI in Add Question → Metadata tab (`q-test-folder` with datalist), question rows show 📁 badge, toolbar has Test Folder filter (`filter-folder`).
- **Folder bulk-tag on OCR** — when saving OCR-extracted questions, admin can assign all of them to a Test Folder in one click (`ocr-folder-input`).
- **Quick-Assign Exam Wizard** — new button (`quick-assign-btn`) in Question Bank header opens "Folder → Class → Exam" dialog. Picks a folder + class (11th/12th) + tag (JEE Mains/Adv/MHT-CET/NEET) + exam name → backend `POST /api/questions/quick-assign-exam` creates an exam with ALL questions in that folder and auto-assigns it to every active student of that class. Returns `{exam, questions_count, assigned_count}`.
- Tested via `/app/test_reports/iteration_9.json` — 8/8 backend pytest + all UI selectors verified, including class-filter exclusion (11th student doesn't see a 12th-only auto-exam).

## Next Action Items
1. Notifications system (Resend email + Twilio SMS) — P1
2. Live Razorpay checkout — P1
3. Push proctor snapshot bytes to S3 with admin review UI
4. Backfill existing exam docs with `exam_tag=''` default for response consistency (cosmetic)
