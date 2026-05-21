# CivicPulse — System Architecture
### *Diagrams, data flow, and component relationships*

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER LAYER                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐    │
│  │   Citizen    │    │   Official   │    │      Supervisor          │    │
│  │   Browser    │    │   Browser    │    │       Browser            │    │
│  └──────┬───────┘    └──────┬───────┘    └────────────┬─────────────┘    │
└─────────┼────────────────────┼────────────────────────┼──────────────────┘
          │                    │                        │
          ▼                    ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER (Vercel / CDN)                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              React 19 SPA (CRA + craco)                             │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │
│  │  │ Landing  │ │ Citizen  │ │ Official │ │Supervisor│ │ Public   │  │ │
│  │  │ Hero     │ │Dashboard │ │ Queue    │ │ Command  │ │Transp.   │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │ │
│  │  Tailwind · shadcn · Framer · Leaflet · Recharts · sonner          │ │
│  │  ─────────────────────────────────────────────────────────────────  │ │
│  │  AuthContext (JWT in localStorage) · axios w/ interceptor          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │ HTTPS (axios)
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER (Render / k8s)                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                FastAPI (Python 3.10, async)                          │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐  │ │
│  │  │ /auth   │ │ /issues │ │  /ai    │ │ /notif  │ │ /analytics   │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └──────────────┘  │ │
│  │  ── JWT auth (pyjwt) · bcrypt · pydantic v2 · CORS middleware ──   │ │
│  │  ── compute_sla() · seed_if_empty() · log_activity() ──            │ │
│  └────────────────────────┬───────────────────────────┬───────────────┘ │
└───────────────────────────┼───────────────────────────┼─────────────────┘
                            │ motor (async)             │ emergentintegrations
                            ▼                           ▼
┌──────────────────────────────────────┐  ┌────────────────────────────────┐
│        DATA LAYER (Atlas)             │  │      EXTERNAL AI LAYER         │
│  ┌────────────────────────────────┐  │  │                                 │
│  │  MongoDB Atlas — civicpulse    │  │  │  Google Gemini 3 Flash         │
│  │  ── profiles                    │  │  │  (via Emergent Universal Key)  │
│  │  ── issues                      │  │  │                                 │
│  │  ── issue_comments              │  │  │  Retell AI Voice Agent (iframe)│
│  │  ── notifications               │  │  │  "Nova" — bottom-right orb     │
│  │  ── activity_logs               │  │  │                                 │
│  └────────────────────────────────┘  │  └────────────────────────────────┘
└──────────────────────────────────────┘
```

---

## 2. Frontend Flow

```
User opens /
   │
   ▼
React app boots → AuthContext checks localStorage for cp_token
   │
   ├─ Token present? ──► GET /api/auth/me → set user state
   │
   ▼
react-router-dom renders matching route
   │
   ├─ "/" → <Landing />            (public)
   ├─ "/transparency" → <Transparency />  (public)
   ├─ "/login" → <Login />
   ├─ "/signup" → <Signup />
   │
   └─ "/app/*" → <ProtectedRoute>
                    └─ <AppLayout>                  (sidebar + header)
                        ├─ NotificationBell (polls /api/notifications every 10s)
                        ├─ Page content
                        │   ├─ Citizen: <CitizenDashboard /> | <ReportIssue /> | <MyIssues />
                        │   ├─ Official: <OfficialDashboard /> | <IssueDetail />
                        │   └─ Supervisor: <SupervisorDashboard /> | <AllIssues /> | <Officials />
                        └─ <RetellOrb />            (floating bottom-right)
```

---

## 3. Backend Flow

```
HTTP Request
   │
   ▼
CORSMiddleware → check allowed origins
   │
   ▼
FastAPI router → match /api/<resource>/<id>
   │
   ▼
Dependency injection: HTTPBearer → get_current_user (decode JWT, load profile)
   │
   ▼
RBAC: require_roles("official", "supervisor") if applicable
   │
   ▼
Endpoint handler
   │
   ├─ Reads:  await db.<collection>.find({...}, {"_id": 0}).to_list(N)
   │           → for issue lists: compute_sla(issue) on each result
   │           → for analytics:   aggregation pipeline ($group, $cond, etc.)
   │
   ├─ Writes: insert/update Mongo  →  log_activity() → push_notification()
   │
   └─ Returns: pydantic model serialized to JSON
```

---

## 4. Database Interactions

### Issue Creation Flow
```
POST /api/issues  (body: title, description, lat, lng, address, category, ...)
   │
   ▼
1. await ai_categorize(description)    ─────►  Gemini → ai_summary
   │
   ▼
2. issue_doc = { id: uuid, status: "submitted", ai_summary: ..., ...,
                 created_at: now_iso(), reporter_id: user.id }
   │
   ▼
3. await db.issues.insert_one(issue_doc)
   │
   ▼
4. await log_activity(issue_id, "Issue reported", user.id)
   │
   ▼
5. await push_notification(user.id, "Issue submitted", "Your report '...' is in our system.")
   │
   ▼
6. for each supervisor:  push_notification(sup.id, "New issue reported", ...)
   │
   ▼
7. Return issue_doc (with _id stripped)
```

### Status Update Flow
```
PATCH /api/issues/{id}  (body: status, priority?, assigned_official_id?)
   │
   ▼
1. RBAC: require_roles("official", "supervisor")
   │
   ▼
2. fetch existing issue
   │
   ▼
3. Build $set updates: status, updated_at, resolved_at (if resolved), assigned_*
   │
   ▼
4. await db.issues.update_one({"id": issue_id}, {"$set": updates})
   │
   ▼
5. await log_activity(issue_id, "Status changed to in_progress", actor.id)
   │
   ▼
6. await push_notification(issue.reporter_id, ...)
6'. if assignment changed: push_notification(new_assignee.id, ...)
   │
   ▼
7. Return updated issue with fresh compute_sla()
```

---

## 5. "Real-time" Event Flow (Polling Model)

```
Client                                Server                      Database
  │                                     │                            │
  │  GET /api/notifications (every 10s) │                            │
  │ ───────────────────────────────────►│                            │
  │                                     │  find({user_id: me})        │
  │                                     │ ──────────────────────────►│
  │                                     │ ◄──────────────────────────│
  │                                     │   [notif, notif, ...]      │
  │ ◄─────────────────────────────────  │                            │
  │   updates bell badge                │                            │
  │                                     │                            │

────── User clicks bell ──────
  │  POST /api/notifications/read-all   │                            │
  │ ───────────────────────────────────►│                            │
  │                                     │  update_many({read:False}, │
  │                                     │              {$set:{read:True}})
  │                                     │ ──────────────────────────►│
  │ ◄─────────────────────────────────  │                            │

────── (Background) Supervisor dashboard polls every 15s ──────
  │  GET /api/analytics/supervisor      │                            │
  │ ───────────────────────────────────►│                            │
  │                                     │  aggregate(...)             │
  │                                     │ ──────────────────────────►│
  │                                     │ ◄──────────────────────────│
  │ ◄─────────────────────────────────  │                            │
  │   re-renders charts/banner          │                            │
```

---

## 6. AI Processing Pipeline

```
User typing in description box (ReportIssue.jsx)
   │
   │  onChange → setState
   │
   ▼
useEffect [form.description, aiLoading, runAI]
   │
   │  setTimeout(1500ms)         ◄── debounce
   │
   ▼
runAI(description)
   │
   ▼
POST /api/ai/categorize  { description }
   │
   ▼
Backend: ai_categorize()
   │
   ├─ if len(desc) < 5: return fallback
   │
   ▼
LlmChat(api_key=EMERGENT_LLM_KEY)
  .with_model("gemini", "gemini-3-flash-preview")
  .send_message(UserMessage(text=...))
   │
   ▼
Gemini returns string (sometimes wrapped in code fences)
   │
   ▼
Sanitize:
  text = re.sub(r"^```(?:json)?", "", text)
  text = re.sub(r"```$", "", text)
  match = re.search(r"\{.*\}", text, re.S)
   │
   ▼
json.loads(match.group(0))
   │
   ▼
Validate: category in enum? priority in enum?
   │
   ├─ Valid    → return { category, priority, suggested_department, ai_summary }
   ├─ Invalid  → return fallback
   └─ Exception → log + return fallback
   │
   ▼
Frontend receives JSON
   │
   ▼
setAiResult(data)  +  setForm({ category, priority })
   │
   ▼
Renders <AIAnalysisPanel> with ai_summary + suggested_department
```

---

## 7. Issue Lifecycle State Machine

```
                                  ┌────────────────┐
                                  │   SUBMITTED    │  ◄── Citizen creates issue
                                  └────────┬───────┘
                                           │
                              Official sees in queue
                                           │
                                           ▼
                                  ┌────────────────┐
                                  │  ACKNOWLEDGED  │  ◄── Official confirms receipt
                                  └────────┬───────┘
                                           │
                                  Field work begins
                                           │
                                           ▼
                                  ┌────────────────┐
                                  │  IN_PROGRESS   │
                                  └────────┬───────┘
                                           │
                                  Issue addressed
                                           │
                                           ▼
                                  ┌────────────────┐
                                  │    RESOLVED    │  ◄── resolved_at timestamp set
                                  └────────┬───────┘
                                           │
                                 Citizen confirms (or 7d auto-close)
                                           │
                                           ▼
                                  ┌────────────────┐
                                  │     CLOSED     │
                                  └────────────────┘

  Parallel: SLA escalation runs ON EVERY READ (not via cron):
    age > 48h  → escalated badge
    age > 72h  → supervisor alert banner
    age > 7d   → critical public flag

  Parallel: Activity log entry created on every transition
  Parallel: Notification pushed to reporter (and assignee if changed)
```

---

## 8. Modular Architecture (Code Layout)

```
/app/backend/
├── server.py                       # All routes (would be split in prod)
│   ├── Models (pydantic)
│   ├── Helpers (hash_password, make_token, compute_sla, push_notification)
│   ├── Auth routes (signup/login/me)
│   ├── Issue routes (CRUD)
│   ├── AI route (/ai/categorize)
│   ├── Notification routes
│   ├── Analytics routes
│   ├── Seed function (seed_if_empty)
│   └── Startup hook
├── requirements.txt
└── .env                            # Mongo URL, JWT secret, Emergent LLM key

/app/frontend/src/
├── App.js                          # Router + AuthProvider + Toaster
├── lib/
│   └── api.js                      # axios instance + constants (categories, status colors)
├── contexts/
│   └── AuthContext.js              # login/signup/logout + user state
├── components/
│   ├── AppLayout.jsx               # Sidebar shell for authenticated pages
│   ├── ProtectedRoute.jsx
│   ├── MapView.jsx                 # Reusable Leaflet wrapper
│   ├── NotificationBell.jsx        # Polled bell with popover
│   ├── RetellOrb.jsx               # Floating Nova voice orb
│   ├── StatusBadge.jsx
│   └── ui/*                        # shadcn primitives
└── pages/
    ├── Landing.jsx                 # Public hero + features + live feed
    ├── Login.jsx · Signup.jsx
    ├── Transparency.jsx            # Public dashboard (no auth)
    ├── CitizenDashboard.jsx
    ├── ReportIssue.jsx             # AI auto-categorize form
    ├── MyIssues.jsx
    ├── IssueDetail.jsx
    ├── OfficialDashboard.jsx
    ├── SupervisorDashboard.jsx     # Command Center
    ├── CityMap.jsx
    ├── AllIssues.jsx
    └── Officials.jsx
```

---

## 9. API Communication Pattern

```
┌──────────────┐    All requests prefixed /api    ┌──────────────┐
│              │ ──────────────────────────────►  │              │
│   Frontend   │                                  │   Backend    │
│              │ ◄──────────────────────────────  │              │
└──────────────┘   JSON responses, no _id leaks   └──────────────┘

Authentication:
  Login → JWT (HS256, exp=7d, payload={sub: user_id, role}) → stored in localStorage
  Every request: axios interceptor adds Authorization: Bearer <jwt>

Public vs Authed:
  Public  : /api/auth/signup, /api/auth/login, /api/issues/public,
            /api/analytics/public, /api/ai/categorize, /api/
  Authed  : everything else
  RBAC    : require_roles("official", "supervisor") on PATCH /issues, /officials,
            /analytics/supervisor
```

---

## 10. Role-Based Access Control

```
                          ┌────────────────────┐
                          │     ANY USER       │  (no auth)
                          ├────────────────────┤
                          │ GET /issues/public │
                          │ GET /analytics/public│
                          │ POST /ai/categorize │
                          └────────────────────┘

         ┌──────────────────────┴──────────────────────┐
         ▼                      ▼                      ▼
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│    CITIZEN     │    │    OFFICIAL    │    │   SUPERVISOR   │
├────────────────┤    ├────────────────┤    ├────────────────┤
│ POST /issues   │    │ + PATCH /issues│    │ + everything   │
│ GET /issues    │    │   (status, prio)│   │ + /analytics/  │
│   ?mine=true   │    │ GET /officials  │   │   supervisor   │
│ POST /comments │    │ GET /issues     │   │ + PATCH /issues│
│ POST /upvote   │    │   ?assigned=true│   │   (assignment) │
│ GET /notif.    │    │                 │   │                │
└────────────────┘    └────────────────┘    └────────────────┘
```

---

## 11. Cloud Deployment Strategy

```
                          ┌────────────────────┐
                          │      Internet       │
                          └─────────┬──────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │                                   │
                  ▼                                   ▼
        ┌──────────────────┐                ┌──────────────────┐
        │   Vercel CDN     │                │   Render         │
        │ (frontend SPA)   │                │  (FastAPI host)  │
        │  - Edge cache    │                │  - Auto-scale    │
        │  - HTTPS         │                │  - HTTPS         │
        └──────────────────┘                └─────────┬────────┘
                                                      │
                                            ┌─────────┴─────────┐
                                            ▼                   ▼
                                  ┌────────────────┐  ┌────────────────┐
                                  │ MongoDB Atlas  │  │ Gemini API     │
                                  │  (M0/M10)      │  │ (Google Cloud) │
                                  └────────────────┘  └────────────────┘

  Critical envs:
    Vercel  : REACT_APP_BACKEND_URL = https://civicpulse-api.onrender.com
    Render  : MONGO_URL, DB_NAME, JWT_SECRET, EMERGENT_LLM_KEY,
              CORS_ORIGINS = https://civicpulse.vercel.app
    Atlas   : Network Access allowlist = Render egress IP
```

---

## 12. Data Flow — A Citizen Reporting a Pothole

```
1. Citizen opens /app/report (authenticated)
        │
        ▼
2. Types: "Massive pothole on MG Road causing accidents daily"
        │       (waits 1.5s — debounce fires)
        ▼
3. POST /api/ai/categorize  →  Gemini  →  { category: "pothole",
                                            priority: "critical",
                                            suggested_department: "PWD",
                                            ai_summary: "Dangerous pothole..." }
        │
        ▼
4. UI auto-fills category=Pothole, priority=Critical, shows AI Analysis panel
        │
        ▼
5. Citizen clicks map → lat/lng set; types address
        │
        ▼
6. Submit  →  POST /api/issues  with the full payload
        │
        ▼
7. Backend:
   a. Calls ai_categorize() again to get ai_summary (idempotent)
   b. Inserts issues doc with status=submitted
   c. log_activity(issue_id, "Issue reported")
   d. push_notification(reporter, "Issue submitted")
   e. For each supervisor: push_notification(sup, "New issue reported")
        │
        ▼
8. Returns issue object → frontend navigates to /app/issues/{id}
        │
        ▼
9. Supervisor's NotificationBell polls every 10s → sees "+1 unread"
        │
        ▼
10. Supervisor's dashboard polls every 15s → escalation banner count updates
        │
        ▼
11. Issue appears on /transparency dashboard (next 12s poll) — public sees it
```

---

## 13. Visual Hierarchy of Components

```
App
└── AuthProvider
    └── BrowserRouter
        ├── /                                    Landing (public)
        ├── /login                               Login
        ├── /signup                              Signup
        ├── /transparency                        Transparency  + RetellOrb
        │
        └── /app  (ProtectedRoute)
            └── AppLayout
                ├── Sidebar (role-based nav)
                ├── Header
                │   └── NotificationBell  (polls /notifications)
                ├── Outlet (current page)
                │   ├── CitizenDashboard | OfficialDashboard | SupervisorDashboard
                │   ├── ReportIssue (with MapView in picker mode)
                │   ├── MyIssues | AllIssues
                │   ├── IssueDetail (with MapView + comments + activity)
                │   ├── CityMap (with MapView in display mode)
                │   └── Officials
                └── RetellOrb (Nova)
```

---

## 14. Why This Architecture Works for a Hackathon

1. **Single backend file** (`server.py`) — judges can audit the entire API in one window
2. **No infrastructure beyond Mongo + an LLM key** — deploys in 10 minutes
3. **Stateless backend** — restart-safe, horizontally scalable
4. **Polling-based realtime** — sidesteps WebSocket complexity without sacrificing UX
5. **Robust AI fallback** — never blocks user flow even if Gemini is down
6. **PII-stripped public endpoint** — open transparency without doxxing
7. **Role-based redirect** — single `/app` route that dispatches by role
8. **Auto-seed on first start** — judges always see populated demo
