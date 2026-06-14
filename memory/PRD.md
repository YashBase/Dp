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
- **OCR:** OpenAI Vision (`gpt-4o`) via `emergentintegrations` with EMERGENT_LLM_KEY.
- **Frontend:** React 19, react-router v7, recharts, shadcn UI, tailwind. Design = "Swiss / brutalist" with International Klein Blue.
- **Storage of snapshots:** size-only (full image NOT stored to keep MongoDB small — production should push to S3).

## What's Implemented (2026-02-14)
- ✅ Branded landing page + login (admin + student tabs)
- ✅ JWT auth with bcrypt; seed admin (`admin@gyansai.com` / `admin123`) & demo student (`demo` / `demo123`)
- ✅ Editable institute settings (branding, contact, payments, SEO, social)
- ✅ Admin dashboard with 6 KPIs, revenue/student-growth/exam-performance charts, recent activity, live attempt monitor
- ✅ Student CRUD + bulk xlsx import + status toggle + assign courses/exams
- ✅ Question Bank: CRUD, filters (subject/chapter/topic/difficulty), 7 question types (MCQ single/multi, T/F, fill, numerical, short, long)
- ✅ Photo/PDF question import via OpenAI Vision OCR with preview & bulk save
- ✅ Exam builder: basics + question picker + rules (randomize, negative, tab-switches, webcam)
- ✅ Exam clone, publish/unpublish, per-exam analytics & leaderboard
- ✅ Student Exam Portal: timer, question palette, mark-for-review, prev/next, auto-save
- ✅ Proctoring: webcam preview + 60s snapshots, tab-switch logging, fullscreen-exit detect, copy/right-click block, auto-submit on limit
- ✅ Results: rank, accuracy, subject breakdown, leaderboard, answer key & solutions
- ✅ Parent result link (`/r/:attemptId`, no auth)
- ✅ Certificate PDF with QR code (`/api/public/certificate/:attemptId`)
- ✅ Course catalog + chapter videos (YouTube embed)
- ✅ Test Series storefront with coupon (`GYAN10` = 10% off) — MOCKED payments
- ✅ Student profile editing

## MOCKED / Deferred
- ⚠️ **Payments** — Razorpay integration is mocked. Successful "payment" auto-grants access.
- ⚠️ **Notifications** — Email/SMS/WhatsApp not implemented.
- ⚠️ **Proctor snapshots** — uploaded but image bytes are dropped (only size logged). Wire S3 in production.
- ⚠️ **Video hosting** — uses YouTube embed URLs instead of Cloudflare Stream.
- ⚠️ **2FA OTP, Mobile/Email OTP login, Force password change, Device tracking** — not implemented.
- ⚠️ **Mathpix / Tesseract** — only OpenAI Vision OCR is wired.

## P1 Backlog
- Razorpay live checkout
- SendGrid/Twilio/WhatsApp notifications
- S3 storage for snapshots & student photos
- 2FA OTP for admin
- Manual evaluation flow for subjective questions
- Live exam scheduling (start/end date enforcement)
- Subject-wise marking schemes & section-wise exams
- Course assignments & quizzes
- Dark mode toggle in UI

## P2 Backlog
- ER diagram & seed migration tooling
- Audit logs UI
- Rate limiting / CSRF middleware

## Next Action Items
1. Plug Razorpay (UPI/cards) using provided test key.
2. Wire SendGrid for exam reminders & result emails.
3. Push proctor snapshots to S3 with admin review UI.
4. Add live scheduling (start/end) for exams.
