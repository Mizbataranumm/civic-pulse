# CivicPulse 🏛️

> **Real-time Civic Issue Reporting & Resolution Platform — built for Indian municipalities**
>
> *"Your City. Your Voice. Real Accountability."*

CivicPulse turns ignored civic complaints into measurable, accountable action. Citizens report issues (potholes, garbage, drainage, etc.) — AI categorizes & routes them — officials work the queue — supervisors track SLA breaches — and *every citizen* can audit the city's performance in real time, with no login required.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧠 **AI-Triaged Reports** | Gemini 3 Flash auto-detects category, priority, department & generates a one-line summary from raw text |
| 🗺️ **Live City Map** | Leaflet + CartoDB Dark Matter tiles, colour-coded pins by status |
| 📊 **Public Transparency Dashboard** | No-login analytics: 7-day trend, category mix, ward perf, SLA breaches |
| ⏱️ **SLA Escalation Engine** | Auto-flags issues at 48h / 72h / 7d thresholds |
| 🔔 **Real-time Notifications** | In-app bell with unread badges (polling-based, 10s) |
| 🎙️ **Voice Reporting (Nova)** | Floating Retell AI orb — citizens can speak their complaint |
| 🛡️ **3 Role-based Dashboards** | Citizen · Official · Supervisor with strict route guards |
| 🌗 **Futuristic Dark UI** | Glassmorphism + cyan/emerald accents + Outfit / Manrope / JetBrains Mono |

---

## 🏗️ Architecture

```
┌──────────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│  React 19 + Tailwind │ ──────▶ │  FastAPI (Python)    │ ──────▶ │   MongoDB       │
│  shadcn/ui · Framer  │ HTTPS   │  JWT auth · Pydantic │  motor  │   (issues,       │
│  Leaflet · Recharts  │         │  emergentintegrations│         │    users, etc.) │
└──────────┬───────────┘         └─────────┬────────────┘         └─────────────────┘
           │                               │
           │                               ▼
           │                    ┌──────────────────────┐
           │                    │  Gemini 3 Flash API  │ (AI categorization)
           │                    └──────────────────────┘
           ▼
┌──────────────────────┐
│  Retell AI Orb       │ (embedded iframe, voice input)
└──────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
- **React 19** (Create React App + craco)
- **TailwindCSS 3.4** with custom dark theme & glassmorphism utilities
- **shadcn/ui** components (Radix primitives)
- **Framer Motion** for entrance & orb animations
- **Leaflet 1.9 + react-leaflet 5** (maps)
- **Recharts 3.6** (analytics)
- **Sonner** (toasts)
- **react-router-dom 7** for SPA routing
- **axios** with JWT interceptor
- **Lucide-react** icons (no emoji)

### Backend
- **FastAPI 0.110** (async)
- **Motor 3.3** (async MongoDB driver)
- **pyjwt + bcrypt** for auth
- **pydantic v2** for validation
- **emergentintegrations** (Emergent's LLM library)

### AI / Integrations
- **Gemini 3 Flash Preview** via `emergentintegrations.llm.chat` → categorization & summarization
- **Retell AI Orb** → embedded voice agent (iframe)
- **EMERGENT_LLM_KEY** → universal key for Gemini access (no quota worries)

### Infra
- **MongoDB** — primary store (issues, profiles, comments, notifications, activity logs)
- **Kubernetes pod** managed by supervisord (frontend on 3000, backend on 8001)

---

## 🧪 Unique Techniques & Design Decisions

### 1. **AI Classification with Robust JSON Extraction**
Gemini's output isn't always strict JSON — sometimes it wraps in code fences, sometimes adds prose. We solve this with:
```python
# /app/backend/server.py – ai_categorize()
text = re.sub(r"^```(?:json)?", "", text).strip()
text = re.sub(r"```$", "", text).strip()
match = re.search(r"\{.*\}", text, re.S)  # greedy match the JSON object
if match: data = json.loads(match.group(0))
```
With a deterministic fallback to `{category: "other", priority: "medium"}` if the LLM is unavailable, AI failure never breaks issue submission.

### 2. **On-the-fly SLA Computation (Stateless)**
Instead of running a cron job, SLA status is computed *on every read*:
```python
def compute_sla(issue):
    hours = (now - created).total_seconds() / 3600
    if hours > 168: return "critical"      # 7 days → public flag
    if hours > 72:  return "supervisor_alert"
    if hours > 48:  return "escalated"
    return "ok"
```
Trade-off: O(n) per request — fine up to ~10k open issues; precompute later if scale grows.

### 3. **Public Transparency Endpoint with PII Stripping**
`GET /api/issues/public` deliberately omits `reporter_id`, `reporter_name`, `assigned_official_id` — only ward + category + AI summary + location are exposed. So full transparency *without* doxxing citizens.

### 4. **Front-end Debounced AI Trigger**
On the report form, the AI runs automatically after **1.5s of inactivity** in the description box — no button click needed. Memoized with `useCallback` to avoid stale closures.

### 5. **Polling-Based "Realtime"**
Notification bell polls every 10s, transparency every 12s, supervisor analytics every 15s. Avoids the WebSocket complexity in a hackathon timeline while still feeling live.

### 6. **Design System Anchored to Reduce AI-Slop**
We avoided the typical purple/violet gradients-on-white look. Instead:
- Deep obsidian (`#09090b`) background
- Sharp emerald (`#10b981`) and cyan (`#06b6d4`) accents
- Three distinct fonts (Outfit headings, Manrope body, JetBrains Mono for data)
- Glassmorphism with `backdrop-blur-xl bg-black/60`

### 7. **Test-Driven Validation**
36 backend tests covering auth, AI, issues, comments, notifications, analytics, RBAC. Real Gemini calls in tests (not mocked) — verifies the AI actually returns valid categories.

---

## 🗂️ Data Storage — Where Everything Lives

All data lives in **MongoDB** (currently the local in-pod MongoDB at `mongodb://localhost:27017`, database `test_database`). To switch to **your own MongoDB**, edit `/app/backend/.env`:

```bash
MONGO_URL="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/"
DB_NAME="civicpulse"           # any name you want
```
Then restart: `sudo supervisorctl restart backend`. On first start, the seeder will populate 20 demo issues + 7 demo accounts into your DB.

### Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `profiles` | All users | `id, email, password_hash, role (citizen/official/supervisor), full_name, ward, created_at` |
| `issues` | Civic complaints | `id, title, description, category, priority, status, latitude, longitude, address, image_url (base64), reporter_id, assigned_official_id, ai_summary, upvotes, ward, created_at, updated_at, resolved_at` |
| `issue_comments` | Discussion threads | `id, issue_id, user_id, user_name, user_role, comment, created_at` |
| `notifications` | In-app alerts | `id, user_id, title, message, read, created_at` |
| `activity_logs` | Issue audit trail | `id, issue_id, action, actor_id, created_at` |

All `_id` fields are **excluded from API responses** (Pydantic + Mongo `{_id: 0}` projection). UUIDs are used as primary keys (`id`).

---

## 🔑 Environment Variables

### Backend (`/app/backend/.env`)
```bash
MONGO_URL="mongodb://localhost:27017"          # ← swap for your Mongo URL
DB_NAME="test_database"                        # ← any DB name
CORS_ORIGINS="*"
EMERGENT_LLM_KEY=sk-emergent-xxxxxxxxxxxxxxxxx # universal LLM key (Gemini)
JWT_SECRET=civicpulse-secret-2026-hackathon    # rotate before prod
```

### Frontend (`/app/frontend/.env`)
```bash
REACT_APP_BACKEND_URL=https://<your-preview>.preview.emergentagent.com
```

---

## 🚀 Running Locally

### Prerequisites
- Node 18+, Yarn (NOT npm), Python 3.10+, MongoDB

### Backend
```bash
cd /app/backend
pip install -r requirements.txt
# Set MONGO_URL, DB_NAME, EMERGENT_LLM_KEY, JWT_SECRET in .env
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd /app/frontend
yarn install
yarn start    # http://localhost:3000
```

In the Emergent pod, both are managed by supervisor:
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

---

## 🧪 Demo Credentials (auto-seeded on first run)

| Role | Email | Password |
|---|---|---|
| Citizen | `aarav@civicpulse.in` | `password123` |
| Citizen | `priya@civicpulse.in` | `password123` |
| Citizen | `rohan@civicpulse.in` | `password123` |
| Official | `ramesh.official@civicpulse.in` | `password123` |
| Official | `sneha.official@civicpulse.in` | `password123` |
| Official | `vikas.official@civicpulse.in` | `password123` |
| Supervisor | `anjali.supervisor@civicpulse.in` | `password123` |

---

## 📡 API Reference (selected)

All endpoints are prefixed with `/api`. Auth-required endpoints expect `Authorization: Bearer <jwt>`.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | – | Create account (role: citizen/official/supervisor) |
| POST | `/auth/login` | – | Returns JWT + user |
| GET | `/auth/me` | ✅ | Current user profile |
| POST | `/ai/categorize` | – | Send `{description}` → returns `{category, priority, suggested_department, ai_summary}` |
| POST | `/issues` | ✅ | Create issue |
| GET | `/issues?mine=true&assigned=true&status_filter=...&category=...` | ✅ | List with filters |
| GET | `/issues/public` | – | Public sanitized list (transparency dashboard) |
| GET | `/issues/{id}` | ✅ | Issue + comments + activity |
| PATCH | `/issues/{id}` | ✅ (official/supervisor) | Update status / priority / assigned_official_id |
| POST | `/issues/{id}/comments` | ✅ | Add comment |
| POST | `/issues/{id}/upvote` | ✅ | +1 upvote |
| GET | `/notifications` | ✅ | List user notifications |
| POST | `/notifications/read-all` | ✅ | Mark all as read |
| GET | `/analytics/public` | – | Stats + breakdowns + 7-day trend |
| GET | `/analytics/supervisor` | ✅ (supervisor) | Above + official performance |
| GET | `/officials` | ✅ (official/supervisor) | Directory |

---

## 🧬 Project Structure

```
/app
├── backend/
│   ├── server.py              # All FastAPI routes + auth + AI + seed
│   ├── requirements.txt
│   ├── .env                   # MONGO_URL, JWT_SECRET, EMERGENT_LLM_KEY
│   └── tests/
│       └── test_civicpulse_api.py   # 36 pytest cases
├── frontend/
│   ├── src/
│   │   ├── App.js             # Router + role-based redirect
│   │   ├── index.css          # Theme + fonts + Leaflet overrides
│   │   ├── lib/api.js         # axios + JWT interceptor + constants
│   │   ├── contexts/AuthContext.js
│   │   ├── components/
│   │   │   ├── AppLayout.jsx       # Sidebar shell
│   │   │   ├── MapView.jsx         # Leaflet wrapper
│   │   │   ├── NotificationBell.jsx
│   │   │   ├── RetellOrb.jsx       # Floating Nova voice orb
│   │   │   ├── StatusBadge.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   └── pages/
│   │       ├── Landing.jsx
│   │       ├── Login.jsx · Signup.jsx
│   │       ├── Transparency.jsx     # public dashboard
│   │       ├── CitizenDashboard.jsx
│   │       ├── OfficialDashboard.jsx
│   │       ├── SupervisorDashboard.jsx  # Command Center
│   │       ├── ReportIssue.jsx     # AI auto-categorize form
│   │       ├── MyIssues.jsx
│   │       ├── IssueDetail.jsx
│   │       ├── AllIssues.jsx
│   │       ├── Officials.jsx
│   │       └── CityMap.jsx
│   ├── package.json
│   └── .env
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

---

## 🧠 AI Model Details

- **Model:** `gemini-3-flash-preview` (Google)
- **Provider library:** `emergentintegrations.llm.chat`
- **Auth:** `EMERGENT_LLM_KEY` (Emergent's universal LLM key, supports OpenAI / Anthropic / Gemini)
- **System prompt:** Instructs Gemini to return strict JSON with `category`, `priority`, `suggested_department`, `ai_summary`. Categories are constrained to a closed enum.
- **Robustness:** Code-fence stripping + greedy JSON regex + deterministic fallback.

We do **NOT use any other ML model** — no custom training, no fine-tuning, no vector DBs. The cleverness is in the prompt design + JSON extraction + the SLA escalation algorithm.

---

## 🧪 Testing

```bash
cd /app/backend
REACT_APP_BACKEND_URL=https://your-host pytest tests/test_civicpulse_api.py -v
```
Current status: **36/36 backend tests pass** · **21/22 frontend Playwright flows pass** (1 fixed: orb z-index).

---

## 🚧 Production Hardening Checklist (Pre-Deploy)

- [ ] Move JWT from `localStorage` → `httpOnly` Set-Cookie + CSRF token
- [ ] Rotate `JWT_SECRET`
- [ ] Add rate-limit + auth gate to `/api/ai/categorize` (currently public — abuse risk on Gemini quota)
- [ ] Replace base64 image storage with object storage (S3 / Emergent Object Storage)
- [ ] Add WebSocket layer for realtime (replace 10–15s polling)
- [ ] Auto-escalation cron (currently SLA computed on read)
- [ ] Tight CORS origins (currently `*`)
- [ ] MongoDB Atlas IP allowlist

---

## 📜 License

Built for the 2026 hackathon — MIT.

---

## 🙏 Credits

- **Emergent Platform** for the universal LLM key & pod environment
- **CARTO** for the beautiful Dark Matter map tiles
- **Retell AI** for the voice agent (Nova)
- **shadcn** for the gorgeous component library
