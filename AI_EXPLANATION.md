# CivicPulse — AI Explanation
### *Why our AI is more than "just API calling"*

---

## TL;DR for Judges

CivicPulse uses **Google Gemini 3 Flash** in **two distinct AI workflows** that are deeply woven into the civic accountability pipeline:

1. **Zero-shot complaint classification + structured triage** — turns free-text citizen descriptions into routable, prioritized work-items
2. **Resolution authenticity verification** — detects when officials falsely mark issues "resolved" by reasoning over the complaint vs. the resolution note

Both workflows ship with deterministic fallbacks, robust JSON sanitization, and direct integration into the database / routing engine. The innovation is **not the API call — it is the workflow intelligence around it**.

---

## 1. AI Workflow #1 — Zero-Shot Civic Triage

### What it does
When a citizen describes an issue in plain language (any language Gemini supports — Hindi, Tamil, English, mixed), the system produces:
- A constrained **category** (one of 9 enums)
- A **priority** (low/medium/high/critical)
- A **suggested department** (Public Works / Water Board / Sanitation / etc.)
- A 140-character **AI summary** used on the public transparency dashboard

### Why "Zero-Shot"
We did not fine-tune Gemini. We do not maintain a labeled training set. We instead use **zero-shot classification via prompt engineering** — meaning the model sees the schema once (in the system message) and classifies novel inputs without examples.

### The Prompt (excerpt)
```
You are CivicPulse AI, an expert at classifying civic complaints in Indian cities.
Given a citizen's complaint description, classify it and respond with ONLY valid JSON.

Schema:
{
  "category":             one of [pothole, garbage, water_leakage, streetlight,
                                  drainage, sewage, illegal_construction,
                                  fallen_tree, other],
  "priority":             one of [low, medium, high, critical],
  "suggested_department": short department name,
  "ai_summary":           one-line summary under 140 chars
}
```

### What Happens After the AI Call
This is the part judges often miss. The LLM output **flows directly into the routing engine**:

```
LLM classifies → category=fallen_tree, priority=critical
        │
        ▼
auto_assign_official(category="fallen_tree", ward=user.ward)
        │
        ▼
Picks Officer Meera (only one with "fallen_tree" in assigned_categories)
       AND who currently has the lowest active workload
        │
        ▼
Issue stored with assigned_official_id + assigned_department
        │
        ▼
push_notification("Officer Meera", "🚨 NEW ISSUE ASSIGNED: ...")
```

That's a **complete LLM-driven government workflow** in one round trip. Not "API calling" — **workflow intelligence**.

---

## 2. AI Workflow #2 — Fake Resolution Detection (Novel)

### Problem We Solved
Civic complaints in India have a structural integrity problem: officials can mark an issue "resolved" with a one-word note ("done", "fixed", "ok") to hit SLA metrics without doing the work. Citizens have no recourse and supervisors have no visibility.

### Our Solution
When an official marks an issue as `resolved`, we **require** a resolution note (min 10 chars) and **send it back to Gemini** along with the original complaint:

```
You are a civic resolution auditor. Given an ORIGINAL complaint
and an OFFICIAL RESOLUTION NOTE, judge whether the resolution note
plausibly addresses the original complaint.

Respond with ONLY valid JSON.
Schema: { confidence: float in [0,1],
          suspicious: boolean,
          reasoning: short string }

Mark suspicious=true when the note is generic ('done', 'fixed', 'ok'),
unrelated, or vague.
```

### Result Flow
- `confidence < 0.5` OR `suspicious=true` → status becomes `suspicious_resolution`
- All supervisors get an alert notification
- The supervisor dashboard's **"POTENTIAL FAKE RESOLUTIONS"** panel surfaces the issue with the AI reasoning visible to everyone

### Why This Matters
This is **applied LLM reasoning for governance integrity** — a use case that goes beyond pattern matching. We're using the LLM as an **independent auditor**.

### Example Real Output (from our system)
```
Original complaint: "Park lights not working — Entire park is dark at night,
                     anti-social activities reported."
Resolution note:    "done"

→ AI verdict:
  confidence:  0.15
  suspicious:  true
  reasoning:   "Resolution note 'done' is generic and does not describe
                action taken."
```

---

## 3. Why Gemini 3 Flash (and not Gemini Pro, GPT-4, Claude)?

| Criterion | Choice |
|---|---|
| **Latency** | Flash returns in ~1s. Pro takes 4-7s. Critical for the 1.5s-debounced auto-trigger UX |
| **Cost** | Flash is ~10× cheaper than Pro at similar classification accuracy for short prompts |
| **Multilingual** | Gemini natively handles Indian languages (Hindi, Tamil, Bengali, Marathi, etc.) without us doing language detection |
| **JSON mode** | Reliable structured-output following with the right system prompt |
| **Availability** | Through Emergent's universal LLM key — zero account-setup friction |

We deliberately avoided OpenAI to keep the entire stack on a single auth surface.

---

## 4. The Engineering Around the API Call

This is the section that beats "they just called an API" criticism.

### 4.1 Robust JSON Extraction
Gemini sometimes wraps output in code fences or adds prose. We sanitize:
```python
text = re.sub(r"^```(?:json)?", "", text).strip()
text = re.sub(r"```$", "", text).strip()
match = re.search(r"\{.*\}", text, re.S)   # greedy-match JSON
data = json.loads(match.group(0))
```

### 4.2 Deterministic Fallback
If Gemini fails / times out / returns invalid JSON:
```python
return { "category": "other",
         "priority": "medium",
         "suggested_department": "General Administration",
         "ai_summary": description[:140] }
```
**AI failure NEVER blocks a citizen complaint.** Civic infrastructure cannot depend on a third-party API.

### 4.3 Request Cancellation (Frontend)
The frontend uses an `AbortController` to cancel in-flight Gemini requests when the user keeps typing:
```javascript
const controller = new AbortController();
const t = setTimeout(() => runAI(description, controller.signal), 1500);
return () => { clearTimeout(t); controller.abort(); };
```
This prevents race conditions, redundant API calls (cost!), and stale results overwriting fresh user input.

### 4.4 Schema Validation
The model returns strings, but we constrain to **closed enums** (8 categories, 4 priorities). A hallucinated value like `"alien_invasion"` gets coerced to the fallback `"other"`.

### 4.5 Workload-Aware Assignment (Backend)
The category from the LLM doesn't just sit in a JSON field — it triggers:
```python
candidates = profiles where role="official" AND assigned_categories ∋ category
best_official = argmin(active_load) of candidates, preferring same ward
```
This is **LLM output driving a real-time scheduling algorithm**.

---

## 5. NLP Pipeline Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                  USER ENTERS COMPLAINT                          │
│  "Massive pothole on MG Road causing accidents"                 │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
              [DEBOUNCE 1.5s · AbortController active]
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              GEMINI 3 FLASH (zero-shot classification)          │
│  System prompt + user complaint → structured JSON output        │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
                  [JSON sanitize + validate]
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              CIVICPULSE ROUTING ENGINE                          │
│  match category → eligible officials → workload-balanced pick   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              MONGODB WRITE + NOTIFICATIONS                      │
│  issue saved · assignment history · push to official+supervisor │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Why This is More Than API Calling

| Generic "API caller" | CivicPulse |
|---|---|
| Sends text, gets text | Sends text, gets **structured workflow trigger** |
| One call, one result | Two distinct workflows: triage + verification |
| Trusts the LLM blindly | Validates enums, sanitizes JSON, deterministic fallback |
| Output sits in a field | Output drives **workload-balanced auto-assignment** |
| No abort logic | AbortController prevents wasted calls / race conditions |
| Single-purpose | Same model used for classification AND auditing |

The **innovation is in the workflow integration**:
- LLM output triggers MongoDB writes
- LLM output picks the human assignee
- LLM output gets sent right back to the LLM (verification reuses the original complaint)
- LLM output drives the supervisor's audit-trail dashboard

---

## 7. Future AI Roadmap (defensible answers)

If asked "what's next?":

| Phase | AI Enhancement |
|---|---|
| **P1** | Cache common short descriptions (TF-IDF nearest-neighbour on past classified issues) — saves 80% of Gemini calls |
| **P2** | Vector embeddings (sentence-transformers) for duplicate detection — "5 other people reported this pothole this week" |
| **P3** | Custom fine-tune of Gemini Flash on a labeled dataset of municipal complaints — improves Indian-language nuance |
| **P4** | Image classification on uploaded photos — verify the photo matches the category (pothole image vs garbage image) |
| **P5** | Conversational refinement: if the citizen's complaint is vague, ask one clarifying question via Nova (Retell agent) before classification |

We have not built P1–P5 — but the **architecture supports them additively**, without rewrites.
