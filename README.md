# CivicPulse 🏛️
### *Real-time Civic Issue Reporting & Resolution Platform — built for Indian municipalities*

> **"Your City. Your Voice. Real Accountability."**
>
> *Making civic complaints impossible to ignore.*

---

## 🎯 Project Overview

**CivicPulse** is a full-stack civic-tech platform that transforms ignored civic complaints into measurable, accountable action. Citizens report issues (potholes, garbage, drainage, etc.); a Gemini-powered AI engine auto-triages and routes them; officials work the queue; supervisors monitor SLA breaches; and *every citizen* can audit the city's performance live — without logging in.

Three roles, one mission:
- **Citizens** report and track
- **Officials** act and resolve
- **Supervisors** oversee and escalate

A **public transparency dashboard** makes everything visible — no login required.

---

## 🚨 Problem Statement

Every day, citizens across India spot dangerous potholes, overflowing drains, broken streetlights, and report them into *black holes of paperwork*.

1. The complaint goes to one department
2. That department forwards it to another
3. The trail vanishes
4. The pothole stays
5. Accountability evaporates

There's **no transparency**, **no SLA**, **no audit trail**. Citizens give up; cities decay.

**CivicPulse makes that disappearance impossible.**

---

## 💡 Solution Approach

| Pain Point | CivicPulse Solution |
|---|---|
| Complaints get lost | Every issue gets a tracking ID, status, and public audit trail |
| Wrong department routing | Gemini AI auto-suggests the correct department |
| No SLA accountability | 48h / 72h / 7d auto-escalation with visible breach flags |
| Citizens are powerless | Upvoting, comments, live status updates |
| Officials drown in inbox | Role-based queue with priority sorting |
| No public oversight | Open transparency dashboard with no-auth access |
| Filing complaints is friction-heavy | Voice complaint via Retell AI orb (Nova) |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────┐         ┌─────────────────────────┐         ┌──────────────────┐
│  React 19 SPA           │         │  FastAPI (async)        │         │  MongoDB Atlas   │
│  Tailwind + shadcn      │ HTTPS   │  JWT auth · Pydantic    │  motor  │  - profiles      │
│  Leaflet · Recharts     │ ◄──────►│  Pyjwt · bcrypt         │ ◄─────► │  - issues        │
│  Framer Motion          │         │  emergentintegrations   │         │  - comments      │
│  Sonner toasts          │         │  AI categorizer         │         │  - notifications │
└────────┬────────────────┘         └────────┬────────────────┘         │  - activity_logs │
         │                                   │                          └──────────────────┘
         │                                   │
         │                                   ▼
         │                          ┌─────────────────────────┐
         │                          │  Google Gemini 3 Flash  │
         │                          │  (via emergentintegr.)  │
         │                          └─────────────────────────┘
         ▼
┌─────────────────────────┐
│  Retell AI Voice Orb    │  (embedded iframe — voice complaint input)
│  "Nova" — bottom-right  │
└─────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Layer | Choice |
|---|---|
| Framework | **React 19** (Create React App + craco) |
| Styling | **TailwindCSS 3.4** + custom dark glassmorphism theme |
| Components | **shadcn/ui** (Radix primitives) |
| Animation | **Framer Motion 12** |
| Maps | **Leaflet 1.9 + react-leaflet 5** with CartoDB Dark Matter tiles |
| Charts | **Recharts 3.6** |
| State / Auth | React Context + localStorage JWT |
| HTTP | **axios** with JWT interceptor |
| Toasts | **sonner** |
| Routing | **react-router-dom 7** |
| Icons | **lucide-react** (no emoji icons) |
| Fonts | Outfit (headings), Manrope (body), JetBrains Mono (data) |

### Backend
| Layer | Choice |
|---|---|
| Framework | **FastAPI 0.110** (async) |
| ASGI | Uvicorn (managed by supervisord) |
| DB Driver | **motor 3.3** (async MongoDB) |
| Auth | **pyjwt + bcrypt** (HS256, 7-day expiry) |
| Validation | **pydantic v2** |
| LLM | **emergentintegrations** (Emergent Universal LLM library) |
| CORS | starlette CORSMiddleware |

### AI & External Services
- **Google Gemini 3 Flash Preview** — categorization + summarization
- **Retell AI Orb** — embedded voice agent ("Nova")
- **EMERGENT_LLM_KEY** — universal LLM key (covers OpenAI / Anthropic / Gemini)

### Data Store
- **MongoDB Atlas** (currently your `mizba` cluster, database `civicpulse`)

---

## ⚡ Setup Instructions

### Prerequisites
- Node 18+, **Yarn** (NOT npm), Python 3.10+, MongoDB (Atlas or local)

### 1. Backend
```bash
cd /app/backend
pip install -r requirements.txt
```

Create `/app/backend/.env`:
```bash
MONGO_URL="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?appName=..."
DB_NAME="civicpulse"
CORS_ORIGINS="*"
EMERGENT_LLM_KEY=sk-emergent-xxxxxxxxxxxxx
JWT_SECRET=civicpulse-secret-rotate-this
```

Run:
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

On first startup, `seed_if_empty()` populates:
- 7 demo accounts (3 citizens / 3 officials / 1 supervisor)
- 20 realistic Indian civic issues across Bengaluru / Mumbai / Delhi / Chennai / Hyderabad / Pune

### 2. Frontend
```bash
cd /app/frontend
yarn install
```

Create `/app/frontend/.env`:
```bash
REACT_APP_BACKEND_URL=https://your-backend-host.com
WDS_SOCKET_PORT=443
```

Run:
```bash
yarn start
```
→ http://localhost:3000

### 3. Emergent Pod (current setup)
Both services are managed by supervisord. Hot reload is on.
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl status
```

---

## 🚀 Deployment Instructions

### Frontend → Vercel Demo link :https://civic-pulse-orpin.vercel.app/
```bash
# Connect repo on vercel.com
# Build: yarn build
# Output: build/
# Env: REACT_APP_BACKEND_URL=<your-backend-host>
```

### Backend → Render / Railway / Fly.io
- Dockerfile (or use Render's native Python build)
- Start: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Env: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `EMERGENT_LLM_KEY`, `CORS_ORIGINS=https://<vercel-domain>`
- Render link:https://civicpulse-backend-gux7.onrender.com/

### MongoDB Atlas
1. Create cluster (free tier OK)
2. Database Access → create user
3. Network Access → allow `0.0.0.0/0` (or specific egress IP)
4. Copy SRV connection string → backend `MONGO_URL`

---

## 📸 Screenshot Placeholders

| Section | Path |
|---|---|
| Landing Hero | `docs/screens/01-landing.png` |
| Public Transparency Dashboard | `docs/screens/02-transparency.png` |
| Citizen Report Issue (AI auto-categorize) | `docs/screens/03-report.png` |
| Citizen My Issues Timeline | `docs/screens/04-my-issues.png` |
| Issue Detail w/ Comments | `docs/screens/05-issue-detail.png` |
| Official Dashboard Queue | `docs/screens/06-official.png` |
| Supervisor Command Center | `docs/screens/07-supervisor.png` |
| Live City Map | `docs/screens/08-map.png` |
| Retell Voice Orb (Nova) | `docs/screens/09-nova-orb.png` |

---

## 🎬 Demo Walkthrough (3 min)

| Time | Action |
|---|---|
| 0:00 | Open `/` (Landing) → highlight live counters, problem statement |
| 0:20 | Click "See Live Transparency" → `/transparency` (no login) — show charts, heatmap, recent feed |
| 0:50 | Login as **citizen** `aarav@civicpulse.in / password123` → Dashboard |
| 1:10 | Click "Report New Issue" → type description: *"Massive pothole causing accidents on MG Road"* — pause 1.5s — **AI auto-categorizes** (Pothole, High, Public Works) |
| 1:30 | Click map to pin location → Submit → instant tracking ID + activity log |
| 1:50 | Logout → login as **supervisor** `anjali.supervisor@civicpulse.in` → Command Center |
| 2:10 | Show **red escalation banner**: "14 issues require immediate escalation" |
| 2:20 | Show heatmap, official performance bars, ward breakdown |
| 2:40 | Click Retell orb → voice agent Nova opens for verbal complaint |
| 3:00 | Close: *"Every complaint, mapped. Every breach, public. Every official, accountable."* |

---

## 🔌 API Overview

All endpoints prefixed with `/api`. Auth via `Authorization: Bearer <jwt>`.

### Auth
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | – | Register (citizen/official/supervisor) |
| POST | `/auth/login` | – | Returns JWT + user |
| GET | `/auth/me` | ✅ | Current profile |

### Issues
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/issues` | ✅ | Create new issue |
| GET | `/issues?mine&assigned&status_filter&category` | ✅ | Filtered list |
| GET | `/issues/public` | – | Public sanitized list (no PII) |
| GET | `/issues/{id}` | ✅ | Issue + comments + activity |
| PATCH | `/issues/{id}` | ✅ official/supervisor | Update status / priority / assignee |
| POST | `/issues/{id}/comments` | ✅ | Add comment |
| POST | `/issues/{id}/upvote` | ✅ | +1 vote |

### AI
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/ai/categorize` | – | `{description}` → `{category, priority, suggested_department, ai_summary}` |

### Notifications
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/notifications` | ✅ | User notifications |
| POST | `/notifications/read-all` | ✅ | Mark as read |

### Analytics
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/analytics/public` | – | Counts + breakdowns + 7-day trend |
| GET | `/analytics/supervisor` | ✅ supervisor | Above + official performance |
| GET | `/officials` | ✅ official/supervisor | Directory |

---

## ⚡ Real-time Features

> **Honest disclosure:** CivicPulse uses **polling-based realtime**, NOT WebSockets. This was a deliberate hackathon decision (less server state, simpler deploy). Behavior is indistinguishable for the user.

| Surface | Poll Interval |
|---|---|
| Notification bell | 10 seconds |
| Public transparency dashboard | 12 seconds |
| Supervisor command center analytics | 15 seconds |
| Issue detail (on refresh) | manual |

Upgrade path to true WebSockets is documented in `HACKATHON_PREPARATION.md`.

---

## 🧠 AI Features

### 1. AI Categorization (Gemini 3 Flash)

When a citizen describes an issue, the **backend** (not the LLM directly) is called:
```
POST /api/ai/categorize
Body: { "description": "Massive pothole on MG Road…" }

Response:
{
  "category": "pothole",
  "priority": "critical",
  "suggested_department": "Public Works Department",
  "ai_summary": "Dangerous pothole near MG Road signal causing two-wheeler accidents."
}
```

**On the frontend**, this is triggered automatically **1.5 seconds after typing stops** in the description box (debounced via `useEffect` + `setTimeout`). The result auto-populates the category and priority fields with a visible "AI ANALYSIS" panel.

### 2. AI Summary
Every issue stored has an `ai_summary` field — used on the public transparency dashboard so citizens see a clean one-line description without exposing PII.

### 3. Robust JSON Parsing
Gemini occasionally wraps output in code fences. We sanitize:
```python
text = re.sub(r"^```(?:json)?", "", text).strip()
text = re.sub(r"```$", "", text).strip()
match = re.search(r"\{.*\}", text, re.S)
```
With a deterministic fallback so AI failure never blocks a citizen complaint.

---

## 🎙️ Voice Assistant Explanation

### Nova — the Retell AI Voice Orb

A floating glowing orb sits **bottom-right** on every authenticated page. When clicked, it opens a modal with an **embedded iframe** to the Retell AI agent URL:

```
https://agent.retellai.com/orb/agent_10f1a66c8a90ed960ec28d902b?token=...
```

Retell handles:
- Microphone access (browser native)
- Speech-to-Text (Retell's hosted STT)
- LLM conversation
- Text-to-Speech response

Our code **doesn't process the audio** — we delegate entirely to Retell, who streams the conversation in their iframe. The orb has a pulsing animation (Framer Motion + CSS keyframes) and emerald/cyan radial-gradient glow matching the design system.

> **Multilingual:** Retell supports multiple languages out-of-the-box at the agent config level. Our orb iframe passes the configured agent ID, so language support is configured in the Retell dashboard, not in our code.

---

## 🛣️ Future Scope

| Phase | Feature |
|---|---|
| **P1 (next sprint)** | True WebSocket realtime · Object storage for images (Emergent Object Storage / S3) · Email/SMS push for SLA breaches · Hamburger nav on mobile |
| **P2** | Density heatmap layer · Auto-escalation cron job · Resolution-proof image upload by officials · Share-issue links (WhatsApp / Twitter) · Hindi/Tamil/Marathi UI |
| **P3** | ML duplicate detection (vector embeddings) · Citizen reputation badges · Department-specific analytics · Anonymous reporting · Integration with Indian municipal APIs (eMSeva / 311) |

---

## 👥 Team Contribution

| Name | Role | Contribution |
|---|---|---|
| _Mizba_ | Full-stack | Backend FastAPI + Mongo schema + JWT auth |
| _Thara_ | Frontend | React + Tailwind + Leaflet + Recharts dashboards |
| _Mizba_ | AI | Gemini integration + prompt engineering |
| _Thara_ | Design | Glassmorphism design system + landing page |
| _Mizba_ | Voice | Retell orb integration + Nova persona |

---

## 📂 Supplemental Docs

- [`HACKATHON_PREPARATION.md`](./HACKATHON_PREPARATION.md) — judge-ready deep-dive + Q&A
- [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) — diagrams + data flow
- [`PITCH_SCRIPT.md`](./PITCH_SCRIPT.md) — 3-min judge pitch

---

## 📜 License

MIT — built for the 2026 hackathon.

## 🙏 Credits

- **Emergent Platform** — pod environment + universal LLM key
- **Google** — Gemini 3 Flash
- **Retell AI** — voice agent (Nova)
- **CARTO** — Dark Matter map tiles
- **shadcn** — gorgeous component library
