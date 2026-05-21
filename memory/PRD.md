# CivicPulse — Product Requirements Document

## Original Problem Statement
Build CivicPulse, a real-time civic issue reporting and resolution platform for Indian municipalities, focused on **accountability, transparency, and AI-powered citizen engagement**. 3 roles (citizen / official / supervisor), AI categorization, real-time maps, public transparency dashboard, SLA escalation, Retell AI voice orb. Hackathon-ready, futuristic, demo-ready.

## Architecture (Implemented)
- **Frontend:** React 19 + CRA + Tailwind + shadcn + Framer Motion + Leaflet + Recharts
- **Backend:** FastAPI (Python) + MongoDB (Motor async)
- **Auth:** JWT (bcrypt + pyjwt), 3 roles enforced
- **AI:** Gemini 3 Flash via emergentintegrations + EMERGENT_LLM_KEY
- **Voice:** Retell AI orb embedded as iframe
- **Realtime:** Polling-based (10–15s) for notifications + analytics

## User Personas
1. **Citizen** — reports issues, tracks status, upvotes others' issues, comments
2. **Official** — works the assigned queue, updates status, uploads resolution proof, comments
3. **Supervisor** — oversees all issues, assigns officials, monitors SLA breaches, escalates

## Core Requirements (Static)
- 7 statuses flow (submitted → acknowledged → in_progress → resolved → closed)
- 4 priorities (low/medium/high/critical)
- 8 categories (pothole, garbage, water_leakage, streetlight, drainage, sewage, illegal_construction, other)
- SLA escalation: 48h → escalated · 72h → supervisor alert · 7d → critical
- Public transparency dashboard (no auth)

## What's Been Implemented (2026-02)
- ✅ Full JWT auth (signup/login/me) with 3 roles
- ✅ Issue CRUD (create with AI summary, list with filters mine/assigned/status/category, get, update, comment, upvote)
- ✅ Public endpoints (`/api/issues/public`, `/api/analytics/public`) — no auth
- ✅ Supervisor analytics with official performance
- ✅ Gemini AI categorization (real Gemini calls verified — not mocked)
- ✅ Notifications system with bell + read-all
- ✅ Activity log on every status change
- ✅ Auto-seed: 7 demo accounts + 20 realistic Indian civic issues
- ✅ Landing page with hero, problem statement, features, live counters, recent feed, CTA
- ✅ Public Transparency dashboard with 5 stat cards, 4 charts, live Leaflet map
- ✅ Citizen Dashboard + Report Issue (AI auto-categorize, map picker, geolocation, image upload)
- ✅ My Issues timeline
- ✅ Official Dashboard with queue and 4 stat cards
- ✅ Supervisor Command Center with escalation banner, heatmap, charts, official performance
- ✅ Issue detail with comments, activity timeline, status updates, assignment
- ✅ City Map (Leaflet CartoDB Dark Matter tiles, colored pins)
- ✅ Notification bell with unread badge
- ✅ Retell AI orb (Nova) floating bottom-right with modal iframe
- ✅ All Issues table with search + filters
- ✅ Officials directory
- ✅ Dark theme with Outfit/Manrope/JetBrains Mono fonts, cyan/emerald accents
- ✅ Tested: Backend 36/36 · Frontend 21/22 (orb z-index fixed)

## Prioritized Backlog
### P1
- Real WebSocket realtime (replace polling)
- Image storage via object storage (currently base64 inline)
- Push/email notifications for critical SLA breaches
- Mobile-optimized sidebar (hamburger menu)

### P2
- Heatmap layer on map (density-based)
- Cron job to auto-escalate (currently SLA computed on read)
- Resolution proof image upload from official
- One-click "share issue" link
- Multilingual support (Hindi/Tamil/Marathi)

### P3
- ML duplicate detection ("similar issue exists nearby?")
- Citizen reputation/badges
- Department-specific analytics
- Anonymous reporting mode

## Test Credentials
See `/app/memory/test_credentials.md` — all accounts use `password123`.

## Next Tasks
- User to review demo flow
- Pending feedback on visual polish for hackathon presentation
