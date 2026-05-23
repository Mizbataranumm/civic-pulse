from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Mongo
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Auth config
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')
JWT_ALGO = 'HS256'
JWT_EXP_HOURS = 24 * 7

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
RETELL_API_KEY = os.environ.get('RETELL_API_KEY')
RETELL_API_BASE = os.environ.get('RETELL_API_BASE', 'https://api.retellai.com').rstrip('/')
RETELL_FROM_NUMBER = os.environ.get('RETELL_FROM_NUMBER')
RETELL_AGENT_ID = os.environ.get('RETELL_AGENT_ID')
RETELL_AGENT_VERSION = os.environ.get('RETELL_AGENT_VERSION')
RETELL_DEFAULT_LANGUAGE = os.environ.get('RETELL_DEFAULT_LANGUAGE')
RETELL_DEFAULT_COUNTRY_CODE = os.environ.get('RETELL_DEFAULT_COUNTRY_CODE', '+91')
RETELL_ENABLE_OUTBOUND_CALLS = os.environ.get('RETELL_ENABLE_OUTBOUND_CALLS', 'false').strip().lower() == 'true'

app = FastAPI(title="CivicPulse API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ------------------- Models -------------------
Role = Literal['citizen', 'official', 'supervisor']
Category = Literal['pothole', 'garbage', 'water_leakage', 'streetlight', 'drainage', 'sewage', 'illegal_construction', 'fallen_tree', 'other']
Priority = Literal['low', 'medium', 'high', 'critical']
Status = Literal['submitted', 'acknowledged', 'in_progress', 'resolved', 'closed', 'verification_pending', 'suspicious_resolution']

# Default category → department routing map (used as fallback)
DEPARTMENT_BY_CATEGORY = {
    'pothole': 'Public Works Department',
    'garbage': 'Sanitation Department',
    'water_leakage': 'Water Board',
    'streetlight': 'Electrical Department',
    'drainage': 'Drainage & Storm Water',
    'sewage': 'Sewage Board',
    'illegal_construction': 'Town Planning',
    'fallen_tree': 'Horticulture / Tree Management',
    'other': 'General Administration',
}

VALID_CATEGORIES = [
    'pothole',
    'garbage',
    'water_leakage',
    'streetlight',
    'drainage',
    'sewage',
    'illegal_construction',
    'fallen_tree',
    'other',
]
VALID_PRIORITIES = ['low', 'medium', 'high', 'critical']
WARD_ORDER = ['Central', 'North', 'South', 'East', 'West', 'All', 'Unknown']
STATUS_ORDER = ['submitted', 'acknowledged', 'in_progress', 'verification_pending', 'suspicious_resolution', 'resolved', 'closed']

CATEGORY_ALIASES = {
    "water leakage": "water_leakage",
    "waterleakage": "water_leakage",
    "water-leakage": "water_leakage",
    "illegal construction": "illegal_construction",
    "illegalconstruction": "illegal_construction",
    "illegal-construction": "illegal_construction",
    "fallen tree": "fallen_tree",
    "fallentree": "fallen_tree",
    "fallen-tree": "fallen_tree",
    "road damage": "pothole",
    "road issue": "pothole",
    "waste": "garbage",
    "trash": "garbage",
}

CATEGORY_PATTERNS = {
    "pothole": [
        r"\bpot\s*holes?\b",
        r"\bpotholes?\b",
        r"\bpatholes?\b",
        r"\bsink\s*holes?\b",
        r"\bcraters?\b",
        r"\broad\s+(?:is\s+)?(?:broken|damaged|collapsed|caved\s*in|sunken)\b",
        r"\bbroken\s+road\b",
    ],
    "garbage": [
        r"\bgarbage\b",
        r"\btrash\b",
        r"\bwaste\b",
        r"\blitter\b",
        r"\bdumping\b",
        r"\boverflowing\s+bin\b",
        r"\buncleared\s+bin\b",
    ],
    "water_leakage": [
        r"\bwater\s+leak(?:age)?\b",
        r"\bleaking\s+pipe\b",
        r"\bpipe\s+burst\b",
        r"\bpipeline\s+leak\b",
        r"\bwater\s+seepage\b",
        r"\btap\s+leak(?:age)?\b",
    ],
    "streetlight": [
        r"\bstreet\s*lights?\b",
        r"\bstreet\s*lamps?\b",
        r"\blamp\s*post\b",
        r"\blight\s*pole\b",
        r"\bstreet\s+is\s+dark\b",
        r"\blights?\s+(?:not\s+working|not\s+functioning|broken|fused)\b",
    ],
    "drainage": [
        r"\bdrain(?:age)?\b",
        r"\bwaterlogging\b",
        r"\bflood(?:ing)?\b",
        r"\bclogged\s+drain\b",
        r"\bstorm\s+water\b",
        r"\bdrain\s+overflow\b",
    ],
    "sewage": [
        r"\bsewage\b",
        r"\bsewer\b",
        r"\bmanhole\b",
        r"\bgutter\b",
        r"\bdrain\s+smell\b",
        r"\bfoul\s+smell\b",
        r"\bstink(?:ing)?\b",
    ],
    "illegal_construction": [
        r"\billegal\s+construction\b",
        r"\bunauthori[sz]ed\s+construction\b",
        r"\bunauthori[sz]ed\s+building\b",
        r"\bencroach(?:ment)?\b",
        r"\bbuilding\s+violation\b",
    ],
    "fallen_tree": [
        r"\bfallen\s+tree\b",
        r"\buprooted\s+tree\b",
        r"\btree\s+branch\b",
        r"\bbranch\s+fell\b",
        r"\btree\s+blocked\b",
    ],
}

RESOLUTION_DOMAIN_KEYWORDS = {
    "pothole": ["pothole", "road", "asphalt", "crack", "surface", "patch", "filled", "resurfaced"],
    "garbage": ["garbage", "trash", "waste", "cleaned", "cleared", "bin", "sanitation"],
    "water_leakage": ["water", "pipe", "leak", "leakage", "burst", "valve", "pipeline"],
    "streetlight": ["streetlight", "light", "lamp", "bulb", "pole", "electrical", "wiring"],
    "drainage": ["drain", "drainage", "waterlogging", "storm", "flood", "desilted", "clog"],
    "sewage": ["sewage", "sewer", "manhole", "gutter", "smell", "blocked line"],
    "illegal_construction": ["construction", "building", "encroachment", "demolition", "notice", "violation"],
    "fallen_tree": ["tree", "branch", "uprooted", "cut", "cleared", "removed"],
}


class SignupReq(BaseModel):
    full_name: str = Field(..., min_length=2)
    email: EmailStr
    password: str
    role: Role = 'citizen'
    ward: Optional[str] = None
    phone_number: Optional[str] = None
    assigned_categories: Optional[List[Category]] = None


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class IssueCreate(BaseModel):
    title: str
    description: str
    category: Category
    priority: Priority = 'medium'
    latitude: float
    longitude: float
    address: str
    image_url: Optional[str] = None  # base64 data URL


class IssueUpdate(BaseModel):
    status: Optional[Status] = None
    priority: Optional[Priority] = None
    assigned_official_id: Optional[str] = None
    resolution_note: Optional[str] = None
    resolution_image: Optional[str] = None  # base64 — required for "resolved"


class ReassignReq(BaseModel):
    new_official_id: str
    reason: str


class CommentCreate(BaseModel):
    comment: str


class AICategorizeReq(BaseModel):
    description: str


class VoiceCallReq(BaseModel):
    language: Optional[str] = None
    message_context: Optional[str] = None
    override_agent_id: Optional[str] = None
    override_agent_version: Optional[int] = None


# ------------------- Helpers -------------------
def normalize_category(raw_category: str) -> str:
    raw = str(raw_category or "other").lower().strip()
    raw = CATEGORY_ALIASES.get(raw, raw)
    return raw if raw in VALID_CATEGORIES else "other"


def normalize_priority(raw_priority: str) -> str:
    raw = str(raw_priority or "medium").lower().strip()
    return raw if raw in VALID_PRIORITIES else "medium"


def order_index(values: List[str], value: Optional[str]) -> int:
    try:
        return values.index(value or "Unknown")
    except ValueError:
        return len(values)


def build_ai_summary(description: str) -> str:
    cleaned = re.sub(r"\s+", " ", description).strip().strip(".")
    if not cleaned:
        return ""
    cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned[:140]


def build_ai_result(description: str, category: str, priority: str, ai_summary: Optional[str] = None) -> dict:
    safe_category = normalize_category(category)
    safe_priority = normalize_priority(priority)
    summary = build_ai_summary(ai_summary or description)
    return {
        "category": safe_category,
        "priority": safe_priority,
        "suggested_department": DEPARTMENT_BY_CATEGORY.get(safe_category, "General Administration"),
        "ai_summary": summary,
    }


def heuristic_ai_categorize(description: str) -> dict:
    text = description.lower()
    scores = {category: 0 for category in VALID_CATEGORIES}

    for category, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text):
                scores[category] += 1

    category = max(scores, key=scores.get)
    if scores[category] == 0:
        category = "other"

    critical_patterns = [
        r"\baccidents?\b",
        r"\binjur(?:y|ies)\b",
        r"\bdeath\b",
        r"\bdanger(?:ous)?\b",
        r"\belectrocution\b",
        r"\bfire\b",
        r"\broad\s+blocked\b",
        r"\bcompletely\s+blocked\b",
        r"\bflood(?:ing)?\b",
        r"\boverflow(?:ing)?\b",
    ]
    high_patterns = [
        r"\bsafety\b",
        r"\brisk\b",
        r"\bhazard(?:ous)?\b",
        r"\burgent\b",
        r"\bhuge\b",
        r"\bmassive\b",
        r"\bbig\b",
        r"\bdeep\b",
        r"\bstray dogs?\b",
        r"\bdark\b",
    ]
    low_patterns = [
        r"\bminor\b",
        r"\bsmall\b",
        r"\bcosmetic\b",
        r"\bslight\b",
    ]

    if any(re.search(pattern, text) for pattern in critical_patterns):
        priority = "critical"
    elif any(re.search(pattern, text) for pattern in high_patterns):
        priority = "high"
    elif any(re.search(pattern, text) for pattern in low_patterns):
        priority = "low"
    else:
        priority = "medium"

    return build_ai_result(description, category, priority)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str, role: str) -> str:
    payload = {
        'sub': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.profiles.find_one({"id": payload['sub']}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: str):
    async def checker(user=Depends(get_current_user)):
        if user['role'] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def infer_resolution_domain(text: str) -> Optional[str]:
    lowered = (text or "").lower()
    best_domain = None
    best_score = 0
    for domain, keywords in RESOLUTION_DOMAIN_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in lowered)
        if score > best_score:
            best_domain = domain
            best_score = score
    return best_domain if best_score > 0 else None


def heuristic_resolution_verification(original_desc: str, resolution_note: str, has_image: bool) -> Optional[dict]:
    original = (original_desc or "").lower()
    note = (resolution_note or "").lower().strip()
    note_len = len(note)

    if note_len < 10:
        return {
            "confidence": 0.2,
            "suspicious": True,
            "reasoning": "Resolution note too short (under 10 chars). Likely placeholder.",
            "verification_status": "heuristic_flagged",
        }

    generic_placeholders = {
        "done", "fixed", "ok", "completed", "resolved", "work done", "issue solved", "closed"
    }
    if note in generic_placeholders:
        return {
            "confidence": 0.15,
            "suspicious": True,
            "reasoning": "Resolution note is too generic to verify the work performed.",
            "verification_status": "heuristic_flagged",
        }

    original_domain = infer_resolution_domain(original)
    note_domain = infer_resolution_domain(note)
    if original_domain and note_domain and original_domain != note_domain:
        return {
            "confidence": 0.12,
            "suspicious": True,
            "reasoning": f"Resolution note appears to address {note_domain.replace('_', ' ')} work, not the original {original_domain.replace('_', ' ')} complaint.",
            "verification_status": "heuristic_flagged",
        }

    # Weak fallback when LLM is unavailable: reward specificity, not just image presence.
    score = 0.35
    if note_len >= 30:
        score += 0.2
    if note_len >= 60:
        score += 0.1
    if has_image:
        score += 0.15
    if original_domain and note_domain == original_domain:
        score += 0.15

    suspicious = score < 0.65
    return {
        "confidence": round(min(score, 0.95), 2),
        "suspicious": suspicious,
        "reasoning": "Heuristic-only verification." if not suspicious else "Resolution note lacks enough evidence or specificity for a clean pass.",
        "verification_status": "heuristic_only",
    }


def normalize_phone_number(phone_number: Optional[str], default_country_code: str = '+91') -> Optional[str]:
    if not phone_number:
        return None

    raw = str(phone_number).strip()
    cleaned = re.sub(r"[^\d+]", "", raw)

    if cleaned.startswith('+'):
        digits = re.sub(r"\D", "", cleaned)
        return f"+{digits}" if 8 <= len(digits) <= 15 else None

    digits = re.sub(r"\D", "", cleaned)
    if len(digits) == 10:
        prefix = default_country_code if default_country_code.startswith('+') else f"+{default_country_code}"
        return f"{prefix}{digits}"
    if 11 <= len(digits) <= 15:
        return f"+{digits}"
    return None


def mask_phone_number(phone_number: Optional[str]) -> str:
    if not phone_number:
        return "unknown"
    digits = re.sub(r"\D", "", phone_number)
    if len(digits) < 4:
        return phone_number
    return f"***{digits[-4:]}"


def ensure_retell_outbound_config():
    if not RETELL_ENABLE_OUTBOUND_CALLS:
        raise HTTPException(
            status_code=503,
            detail="Outbound voice calls are disabled. Set RETELL_ENABLE_OUTBOUND_CALLS=true after configuring Retell."
        )
    if not RETELL_API_KEY or not RETELL_FROM_NUMBER:
        raise HTTPException(
            status_code=503,
            detail="Retell outbound call setup incomplete. Add RETELL_API_KEY and RETELL_FROM_NUMBER in backend env."
        )


def retell_outbound_status() -> dict:
    configured = bool(RETELL_API_KEY and RETELL_FROM_NUMBER)
    ready = RETELL_ENABLE_OUTBOUND_CALLS and configured
    if ready:
        reason = "Outbound voice calls are ready."
    elif not RETELL_ENABLE_OUTBOUND_CALLS:
        reason = "Outbound voice calls are disabled."
    else:
        reason = "Retell outbound call setup is incomplete."
    return {
        "outbound_calls_enabled": RETELL_ENABLE_OUTBOUND_CALLS,
        "outbound_calls_configured": configured,
        "outbound_calls_ready": ready,
        "reason": reason,
    }


async def create_retell_outbound_call(
    to_number: str,
    issue: dict,
    requested_by: dict,
    payload: Optional[VoiceCallReq] = None,
) -> dict:
    ensure_retell_outbound_config()

    override_agent_id = payload.override_agent_id if payload and payload.override_agent_id else RETELL_AGENT_ID
    override_agent_version = payload.override_agent_version if payload and payload.override_agent_version is not None else None
    if override_agent_version is None and RETELL_AGENT_VERSION:
        try:
            override_agent_version = int(RETELL_AGENT_VERSION)
        except ValueError:
            logger.warning("Ignoring invalid RETELL_AGENT_VERSION=%s", RETELL_AGENT_VERSION)

    request_body = {
        "from_number": RETELL_FROM_NUMBER,
        "to_number": to_number,
        "metadata": {
            "source": "civicpulse",
            "issue_id": issue["id"],
            "issue_title": issue["title"],
            "requested_by_user_id": requested_by["id"],
            "requested_by_role": requested_by["role"],
        },
        "retell_llm_dynamic_variables": {
            "citizen_name": issue.get("reporter_name", "Citizen"),
            "issue_title": issue["title"],
            "issue_category": issue["category"],
            "issue_priority": issue["priority"],
            "issue_address": issue["address"],
            "issue_summary": issue.get("ai_summary") or issue["description"][:140],
            "assigned_department": issue.get("assigned_department", ""),
            "requested_by_name": requested_by["full_name"],
            "requested_by_role": requested_by["role"],
        },
    }

    if payload and payload.message_context:
        request_body["retell_llm_dynamic_variables"]["message_context"] = payload.message_context[:500]
    if override_agent_id:
        request_body["override_agent_id"] = override_agent_id
    if override_agent_version is not None:
        request_body["override_agent_version"] = override_agent_version
    if payload and payload.language or RETELL_DEFAULT_LANGUAGE:
        request_body["agent_override"] = {
            "agent": {
                "language": (payload.language if payload and payload.language else RETELL_DEFAULT_LANGUAGE),
                "boosted_keywords": [
                    issue["title"],
                    issue["address"],
                    issue["category"],
                    issue.get("assigned_department", ""),
                ],
            }
        }

    headers = {
        "Authorization": f"Bearer {RETELL_API_KEY}",
        "Content-Type": "application/json",
    }
    url = f"{RETELL_API_BASE}/v2/create-phone-call"

    def _post():
        return requests.post(url, headers=headers, json=request_body, timeout=20)

    try:
        response = await asyncio.to_thread(_post)
    except Exception as exc:
        logger.warning("Retell outbound call request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach Retell outbound calling service.") from exc

    if response.status_code not in (200, 201):
        logger.warning("Retell outbound call rejected: status=%s body=%s", response.status_code, response.text[:500])
        detail = "Retell rejected the outbound call request."
        try:
            payload_json = response.json()
            if isinstance(payload_json, dict):
                detail = payload_json.get("message") or payload_json.get("error") or detail
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail)

    data = response.json()
    return {
        "call_id": data.get("call_id"),
        "call_status": data.get("call_status"),
        "from_number": data.get("from_number", RETELL_FROM_NUMBER),
        "to_number": data.get("to_number", to_number),
        "agent_id": data.get("agent_id", override_agent_id),
        "agent_version": data.get("agent_version", override_agent_version),
    }


async def log_activity(issue_id: str, action: str, actor_id: str):
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "issue_id": issue_id,
        "action": action,
        "actor_id": actor_id,
        "created_at": now_iso(),
    })


async def push_notification(user_id: str, title: str, message: str, issue_id: Optional[str] = None, kind: str = "info"):
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "issue_id": issue_id,
        "kind": kind,
        "read": False,
        "created_at": now_iso(),
    })


async def auto_assign_official(category: str, ward: Optional[str] = None) -> Optional[dict]:
    """
    Category-based + workload-balanced auto-assignment.
    Picks the official whose assigned_categories contains the category
    AND who currently has the fewest active (non-resolved/closed) issues.
    Falls back to ward match, then to any official with the category.
    Returns None if no matching official exists (caller should escalate to supervisor).
    """
    candidates_cursor = db.profiles.find(
        {"role": "official", "assigned_categories": category},
        {"_id": 0, "password_hash": 0}
    )
    candidates = await candidates_cursor.to_list(100)
    if not candidates:
        return None

    # Workload-balance: count active issues per candidate
    best = None
    best_load = 10**9
    for c in candidates:
        load = await db.issues.count_documents({
            "assigned_official_id": c['id'],
            "status": {"$nin": ["resolved", "closed"]}
        })
        # Prefer same ward when tied
        same_ward_bonus = -1 if ward and c.get('ward') == ward else 0
        score = load + same_ward_bonus
        if score < best_load:
            best_load = score
            best = c
    return best


def assigned_to_official_query(official: dict, active_only: bool = True) -> dict:
    matches = [{"assigned_official_id": official["id"]}]
    if official.get("full_name"):
        matches.append({"assigned_official_name": official["full_name"]})

    query = {"$or": matches}
    if active_only:
        query["status"] = {"$nin": ["resolved", "closed"]}
    return query


async def ai_verify_resolution(original_desc: str, resolution_note: str, has_image: bool) -> dict:
    """
    Lightweight AI verification using Gemini. Heuristic + LLM reasoning.
    Returns: { confidence: 0.0-1.0, suspicious: bool, reasoning: str }
    """
    heuristic_result = heuristic_resolution_verification(original_desc, resolution_note, has_image)
    if heuristic_result and heuristic_result.get("verification_status") == "heuristic_flagged":
        return heuristic_result

    if not EMERGENT_LLM_KEY:
        return heuristic_result or {
            "confidence": 0.4,
            "suspicious": True,
            "reasoning": "Verification unavailable and heuristic review was inconclusive.",
            "verification_status": "unavailable",
        }

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        system_msg = (
            "You are a civic resolution auditor. Given an ORIGINAL complaint and an OFFICIAL RESOLUTION NOTE, "
            "judge whether the resolution note plausibly addresses the original complaint. "
            "Respond with ONLY valid JSON, no markdown. Schema: "
            "{\"confidence\": float in [0,1], \"suspicious\": boolean, \"reasoning\": short string}. "
            "Mark suspicious=true when the note is generic ('done', 'fixed', 'ok'), unrelated, or vague."
        )
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"verify-{uuid.uuid4()}",
                       system_message=system_msg).with_model("gemini", "gemini-2.0-flash")
        prompt = (f"ORIGINAL COMPLAINT:\n{original_desc}\n\n"
                  f"OFFICIAL RESOLUTION NOTE:\n{resolution_note}\n\n"
                  f"Resolution image provided: {'yes' if has_image else 'no'}\n\n"
                  f"Return ONLY the JSON object.")
        resp = await chat.send_message(UserMessage(text=prompt))
        text = str(resp).strip()
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
        match = re.search(r"\{.*\}", text, re.S)
        if match:
            data = json.loads(match.group(0))
            result = {
                "confidence": float(data.get("confidence", 0.5)),
                "suspicious": bool(data.get("suspicious", False)),
                "reasoning": str(data.get("reasoning", ""))[:240],
                "verification_status": "llm_verified",
            }
            if heuristic_result and heuristic_result.get("suspicious") and not result["suspicious"]:
                return {
                    **heuristic_result,
                    "reasoning": heuristic_result["reasoning"],
                }
            return result
    except Exception as e:
        logger.warning(f"AI verify failed: {e}")
    if heuristic_result:
        return {
            **heuristic_result,
            "suspicious": True if heuristic_result["confidence"] < 0.75 else heuristic_result["suspicious"],
            "reasoning": "Verification unavailable. Manual review recommended." if not heuristic_result["suspicious"] else heuristic_result["reasoning"],
            "verification_status": "unavailable",
        }
    return {
        "confidence": 0.25,
        "suspicious": True,
        "reasoning": "Verification unavailable. Manual review recommended.",
        "verification_status": "unavailable",
    }


def compute_sla(issue: dict) -> dict:
    """Compute SLA status based on created_at."""
    try:
        created = datetime.fromisoformat(issue['created_at'])
    except Exception:
        return {"hours_open": 0, "sla_status": "ok", "overdue": False, "escalated": False}
    if issue.get('status') in ('resolved', 'closed'):
        return {"hours_open": 0, "sla_status": "resolved", "overdue": False, "escalated": False}
    now = datetime.now(timezone.utc)
    hours = (now - created).total_seconds() / 3600
    if hours > 168:
        return {"hours_open": round(hours, 1), "sla_status": "critical", "overdue": True, "escalated": True}
    if hours > 72:
        return {"hours_open": round(hours, 1), "sla_status": "supervisor_alert", "overdue": True, "escalated": True}
    if hours > 48:
        return {"hours_open": round(hours, 1), "sla_status": "escalated", "overdue": True, "escalated": True}
    return {"hours_open": round(hours, 1), "sla_status": "ok", "overdue": False, "escalated": False}


# ------------------- Auth Routes -------------------
@api_router.post("/auth/signup")
async def signup(req: SignupReq):
    existing = await db.profiles.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "full_name": req.full_name,
        "email": req.email.lower(),
        "password_hash": hash_password(req.password),
        "role": req.role,
        "ward": req.ward or "Central",
        "phone_number": req.phone_number,
        "assigned_categories": req.assigned_categories or [],
        "created_at": now_iso(),
    }
    await db.profiles.insert_one(doc)
    token = make_token(user_id, req.role)
    return {
        "token": token,
        "user": {"id": user_id, "full_name": req.full_name, "email": req.email.lower(),
                 "role": req.role, "ward": doc['ward'], "phone_number": doc['phone_number'],
                 "assigned_categories": doc['assigned_categories']}
    }


@api_router.post("/auth/login")
async def login(req: LoginReq):
    user = await db.profiles.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = make_token(user['id'], user['role'])
    return {
        "token": token,
        "user": {"id": user['id'], "full_name": user['full_name'], "email": user['email'],
                 "role": user['role'], "ward": user.get('ward', 'Central'),
                 "phone_number": user.get('phone_number'),
                 "assigned_categories": user.get('assigned_categories', [])}
    }


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ------------------- AI Categorization -------------------
@api_router.post("/ai/categorize")
async def ai_categorize(req: AICategorizeReq):
    """Categorize an issue using Gemini via emergentintegrations."""
    fallback = heuristic_ai_categorize(req.description)
    if len(req.description.strip()) < 5:
        return build_ai_result(req.description, "other", "medium")
    if not EMERGENT_LLM_KEY:
        return fallback
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        system_msg = (
            "You are CivicPulse AI, an expert at classifying civic complaints in Indian cities. "
            "Given a citizen's complaint description, classify it and respond with ONLY a valid JSON object. "
            "No markdown, no code fences, no explanation — just the raw JSON object. "
            "You MUST use ONLY these exact values:\n"
            "category: exactly one of [pothole, garbage, water_leakage, streetlight, drainage, sewage, illegal_construction, fallen_tree, other]\n"
            "priority: exactly one of [low, medium, high, critical]\n"
            "Rules: road damage/holes → pothole; waste/trash → garbage; pipe/water → water_leakage; "
            "lamp/light → streetlight; flood/drain → drainage; smell/manhole → sewage; "
            "unauthorized building → illegal_construction; tree → fallen_tree. "
            "Priority rules: mentions accidents/injuries/flooding → critical; safety risk → high; "
            "ongoing nuisance → medium; minor/cosmetic → low. "
            "Schema: {\"category\": \"<exact value from list>\", \"priority\": \"<exact value from list>\", "
            "\"suggested_department\": \"<department name>\", \"ai_summary\": \"<one line under 140 chars>\"}"
        )
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"cat-{uuid.uuid4()}", system_message=system_msg).with_model("gemini", "gemini-2.0-flash")
        msg = UserMessage(text=f"Complaint: {req.description}\n\nReturn ONLY the raw JSON object with no markdown or code fences.")
        resp = await chat.send_message(msg)
        text = str(resp).strip()
        logger.info(f"🤖 RAW GEMINI RESPONSE: {repr(text)}")   # ← ADD THIS
        # Strip code fences if any
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
        match = re.search(r"\{.*\}", text, re.S)
        logger.info(f"🔍 AFTER STRIP, match={bool(match)}, text={repr(text[:200])}")  # ← ADD THIS

        if match:
            data = json.loads(match.group(0))
            category = normalize_category(data.get("category", "other"))
            priority = normalize_priority(data.get("priority", "medium"))

            if category == "other" and fallback["category"] != "other":
                category = fallback["category"]
            if priority == "medium" and fallback["priority"] in {"high", "critical"}:
                priority = fallback["priority"]

            return build_ai_result(
                req.description,
                category,
                priority,
                data.get("ai_summary"),
            )
    except Exception as e:
        logger.warning(f"AI categorize failed: {e}")
    return fallback


# ------------------- Issue Routes -------------------
@api_router.post("/issues")
async def create_issue(payload: IssueCreate, user=Depends(get_current_user)):
    issue_id = str(uuid.uuid4())
    # AI summary
    ai_summary = payload.description[:140]
    try:
        ai_result = await ai_categorize(AICategorizeReq(description=payload.description))
        ai_summary = ai_result.get("ai_summary", ai_summary)
    except Exception:
        pass

    # Category-based auto-assignment with workload balancing
    auto_official = await auto_assign_official(payload.category, user.get('ward'))
    assigned_department = DEPARTMENT_BY_CATEGORY.get(payload.category, 'General Administration')

    doc = {
        "id": issue_id,
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "priority": payload.priority,
        "status": "acknowledged" if auto_official else "submitted",
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "address": payload.address,
        "image_url": payload.image_url,
        "reporter_id": user['id'],
        "reporter_name": user['full_name'],
        "assigned_official_id": auto_official['id'] if auto_official else None,
        "assigned_official_name": auto_official['full_name'] if auto_official else None,
        "assigned_department": assigned_department,
        "assignment_history": [],
        "resolution_note": None,
        "resolution_image": None,
        "resolution_verification": None,
        "upvotes": 0,
        "ai_summary": ai_summary,
        "ward": user.get('ward', 'Central'),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "resolved_at": None,
    }
    await db.issues.insert_one(doc)
    await log_activity(issue_id, "Issue reported", user['id'])
    await push_notification(user['id'], "Issue submitted",
                            f"Your report '{payload.title}' is in the system" +
                            (f" — auto-routed to {auto_official['full_name']} ({assigned_department})." if auto_official else " (awaiting supervisor routing)."),
                            issue_id=issue_id, kind="submitted")

    if auto_official:
        await log_activity(issue_id, f"Auto-assigned to {auto_official['full_name']} ({assigned_department})", user['id'])
        await push_notification(
            auto_official['id'],
            "🚨 NEW ISSUE ASSIGNED",
            f"{payload.title} · {payload.category} · {payload.priority} · {payload.address}",
            issue_id=issue_id, kind="assigned"
        )
    # Notify supervisors
    async for sup in db.profiles.find({"role": "supervisor"}, {"_id": 0, "id": 1}):
        await push_notification(
            sup['id'],
            "Unassigned — needs routing" if not auto_official else "New issue auto-routed",
            f"{payload.title} — {payload.category}" + ("" if auto_official else " (NO matching official)"),
            issue_id=issue_id, kind="supervisor_alert" if not auto_official else "info"
        )

    doc.pop('_id', None)
    return doc


@api_router.get("/issues")
async def list_issues(
    status_filter: Optional[str] = None,
    category: Optional[str] = None,
    mine: Optional[bool] = False,
    assigned: Optional[bool] = False,
    user=Depends(get_current_user),
):
    query = {}
    if status_filter:
        query['status'] = status_filter
    if category:
        query['category'] = category
    if mine:
        query['reporter_id'] = user['id']
    if assigned:
        query['assigned_official_id'] = user['id']

    issues = await db.issues.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for it in issues:
        it.update(compute_sla(it))
    return issues


@api_router.get("/issues/public")
async def list_issues_public():
    """Public endpoint for transparency dashboard — no auth, returns minimal fields."""
    issues = await db.issues.find(
        {},
        {"_id": 0, "id": 1, "title": 1, "category": 1, "priority": 1, "status": 1,
         "latitude": 1, "longitude": 1, "address": 1, "ward": 1, "created_at": 1,
         "resolved_at": 1, "ai_summary": 1, "assigned_department": 1}
    ).sort("created_at", -1).to_list(1000)
    for it in issues:
        it.update(compute_sla(it))
    return issues


@api_router.get("/issues/{issue_id}")
async def get_issue(issue_id: str, user=Depends(get_current_user)):
    issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Not found")
    issue.update(compute_sla(issue))
    assigned_id = issue.get("assigned_official_id")
    if assigned_id:
        assigned_profile = await db.profiles.find_one(
            {"id": assigned_id, "role": "official"},
            {"_id": 0, "password_hash": 0, "phone_number": 0}
        )
        if not assigned_profile and issue.get("assigned_official_name"):
            assigned_profile = await db.profiles.find_one(
                {"full_name": issue["assigned_official_name"], "role": "official"},
                {"_id": 0, "password_hash": 0, "phone_number": 0}
            )
            if assigned_profile:
                issue["assigned_official_id"] = assigned_profile["id"]
                await db.issues.update_one(
                    {"id": issue_id},
                    {"$set": {
                        "assigned_official_id": assigned_profile["id"],
                        "assigned_official_name": assigned_profile["full_name"],
                    }}
                )
        issue["assigned_official_profile"] = assigned_profile
    comments = await db.issue_comments.find({"issue_id": issue_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    activity = await db.activity_logs.find({"issue_id": issue_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"issue": issue, "comments": comments, "activity": activity}


@api_router.patch("/issues/{issue_id}")
async def update_issue(issue_id: str, payload: IssueUpdate, user=Depends(require_roles('official', 'supervisor'))):
    issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Not found")

    updates = {"updated_at": now_iso()}
    action = None
    if payload.status:
        # Resolution requires note + image + AI verification
        if payload.status == 'resolved':
            if not payload.resolution_note or len(payload.resolution_note.strip()) < 10:
                raise HTTPException(status_code=400, detail="Resolution note required (min 10 chars)")
            verification = await ai_verify_resolution(
                original_desc=issue['description'],
                resolution_note=payload.resolution_note,
                has_image=bool(payload.resolution_image)
            )
            updates['resolution_note'] = payload.resolution_note
            updates['resolution_image'] = payload.resolution_image
            updates['resolution_verification'] = verification
            updates['resolved_at'] = now_iso()
            if verification['suspicious']:
                updates['status'] = 'suspicious_resolution'
                action = f"Marked RESOLVED but flagged as suspicious (confidence {verification['confidence']})"
                # Alert all supervisors
                async for sup in db.profiles.find({"role": "supervisor"}, {"_id": 0, "id": 1}):
                    await push_notification(
                        sup['id'], "⚠️ Suspicious resolution",
                        f"'{issue['title']}' marked resolved with low confidence ({verification['confidence']}). Review needed.",
                        issue_id=issue_id, kind="suspicious"
                    )
            else:
                updates['status'] = 'resolved'
                action = f"Status changed to resolved (AI confidence {verification['confidence']})"
        else:
            updates['status'] = payload.status
            action = f"Status changed to {payload.status}"
    if payload.priority:
        updates['priority'] = payload.priority
        action = (action or "") + f" | Priority set to {payload.priority}"
    if payload.assigned_official_id:
        official = await db.profiles.find_one({"id": payload.assigned_official_id}, {"_id": 0})
        if not official:
            raise HTTPException(status_code=400, detail="Official not found")
        updates['assigned_official_id'] = payload.assigned_official_id
        updates['assigned_official_name'] = official['full_name']
        action = (action or "") + f" | Assigned to {official['full_name']}"
        await push_notification(payload.assigned_official_id, "🚨 NEW ISSUE ASSIGNED",
                                f"You've been assigned: {issue['title']}",
                                issue_id=issue_id, kind="assigned")

    await db.issues.update_one({"id": issue_id}, {"$set": updates})
    if action:
        await log_activity(issue_id, action.strip(' |'), user['id'])
    # Notify reporter
    await push_notification(issue['reporter_id'], "Issue update", f"'{issue['title']}': {action}")

    new_issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    new_issue.update(compute_sla(new_issue))
    return new_issue


@api_router.post("/issues/{issue_id}/comments")
async def add_comment(issue_id: str, payload: CommentCreate, user=Depends(get_current_user)):
    issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Not found")
    c = {
        "id": str(uuid.uuid4()),
        "issue_id": issue_id,
        "user_id": user['id'],
        "user_name": user['full_name'],
        "user_role": user['role'],
        "comment": payload.comment,
        "created_at": now_iso(),
    }
    await db.issue_comments.insert_one(c)
    await log_activity(issue_id, f"Comment by {user['full_name']}", user['id'])
    # Notify reporter & assignee
    for uid in {issue['reporter_id'], issue.get('assigned_official_id')}:
        if uid and uid != user['id']:
            await push_notification(uid, "New comment", f"{user['full_name']} commented on '{issue['title']}'")
    c.pop('_id', None)
    return c


@api_router.post("/issues/{issue_id}/upvote")
async def upvote(issue_id: str, user=Depends(get_current_user)):
    """Toggle upvote — one per user. Idempotent."""
    existing = await db.issue_votes.find_one({"issue_id": issue_id, "user_id": user['id']})
    if existing:
        # Remove vote
        await db.issue_votes.delete_one({"issue_id": issue_id, "user_id": user['id']})
        await db.issues.update_one({"id": issue_id}, {"$inc": {"upvotes": -1}})
        voted = False
    else:
        await db.issue_votes.insert_one({
            "id": str(uuid.uuid4()),
            "issue_id": issue_id,
            "user_id": user['id'],
            "vote_type": "up",
            "created_at": now_iso(),
        })
        await db.issues.update_one({"id": issue_id}, {"$inc": {"upvotes": 1}})
        voted = True
    issue = await db.issues.find_one({"id": issue_id}, {"_id": 0, "upvotes": 1})
    return {"upvotes": max(0, issue.get('upvotes', 0)), "voted": voted}


@api_router.get("/issues/{issue_id}/has-voted")
async def has_voted(issue_id: str, user=Depends(get_current_user)):
    existing = await db.issue_votes.find_one({"issue_id": issue_id, "user_id": user['id']})
    return {"voted": bool(existing)}


@api_router.post("/issues/{issue_id}/reassign")
async def reassign_issue(issue_id: str, payload: ReassignReq, user=Depends(require_roles('supervisor'))):
    issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Not found")
    new_off = await db.profiles.find_one({"id": payload.new_official_id, "role": "official"}, {"_id": 0})
    if not new_off:
        raise HTTPException(status_code=400, detail="Target official not found")
    history_entry = {
        "previous_official_id": issue.get('assigned_official_id'),
        "previous_official_name": issue.get('assigned_official_name'),
        "new_official_id": new_off['id'],
        "new_official_name": new_off['full_name'],
        "reason": payload.reason,
        "reassigned_by": user['id'],
        "reassigned_by_name": user['full_name'],
        "timestamp": now_iso(),
    }
    await db.issues.update_one(
        {"id": issue_id},
        {
            "$set": {
                "assigned_official_id": new_off['id'],
                "assigned_official_name": new_off['full_name'],
                "updated_at": now_iso(),
            },
            "$push": {"assignment_history": history_entry},
        }
    )
    await log_activity(issue_id, f"Reassigned to {new_off['full_name']}: {payload.reason}", user['id'])
    # Notify all affected
    if issue.get('assigned_official_id'):
        await push_notification(issue['assigned_official_id'], "Issue reassigned away",
                                f"'{issue['title']}' transferred to {new_off['full_name']}",
                                issue_id=issue_id, kind="info")
    await push_notification(new_off['id'], "🚨 NEW ISSUE ASSIGNED",
                            f"Reassigned to you: {issue['title']} — {payload.reason}",
                            issue_id=issue_id, kind="assigned")
    await push_notification(issue['reporter_id'], "Your issue reassigned",
                            f"'{issue['title']}' is now with {new_off['full_name']}",
                            issue_id=issue_id, kind="info")
    return {"ok": True, "new_official": new_off['full_name']}


@api_router.post("/issues/{issue_id}/call-reporter")
async def call_issue_reporter(
    issue_id: str,
    payload: Optional[VoiceCallReq] = None,
    user=Depends(require_roles('official', 'supervisor'))
):
    issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Not found")

    reporter = await db.profiles.find_one({"id": issue["reporter_id"]}, {"_id": 0, "password_hash": 0})
    if not reporter:
        raise HTTPException(status_code=404, detail="Reporter not found")

    to_number = normalize_phone_number(reporter.get("phone_number"), RETELL_DEFAULT_COUNTRY_CODE)
    if not to_number:
        raise HTTPException(
            status_code=400,
            detail="Reporter does not have a valid phone number saved for outbound calling."
        )

    call = await create_retell_outbound_call(to_number=to_number, issue=issue, requested_by=user, payload=payload)

    await log_activity(issue_id, f"Nova outbound call initiated to reporter {mask_phone_number(to_number)}", user["id"])
    await push_notification(
        issue["reporter_id"],
        "Nova callback initiated",
        f"Our voice agent will call you shortly about '{issue['title']}'.",
        issue_id=issue_id,
        kind="info",
    )

    return {
        "ok": True,
        "issue_id": issue_id,
        "call_id": call.get("call_id"),
        "call_status": call.get("call_status"),
        "to_number": call.get("to_number"),
        "from_number": call.get("from_number"),
        "reporter_name": reporter.get("full_name"),
    }


@api_router.get("/voice/status")
async def voice_status(user=Depends(require_roles('official', 'supervisor'))):
    return retell_outbound_status()


# ------------------- Notifications -------------------
@api_router.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    notifs = await db.notifications.find({"user_id": user['id']}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return notifs


@api_router.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user['id'], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ------------------- Analytics -------------------
@api_router.get("/analytics/public")
async def public_analytics():
    total = await db.issues.count_documents({})
    resolved = await db.issues.count_documents({"status": {"$in": ["resolved", "closed"]}})
    in_progress = await db.issues.count_documents({"status": "in_progress"})
    pending = await db.issues.count_documents({"status": {"$in": ["submitted", "acknowledged"]}})

    # Category breakdown
    pipeline = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}]
    cat_agg = await db.issues.aggregate(pipeline).to_list(50)
    category_breakdown = [{"category": c['_id'], "count": c['count']} for c in cat_agg]
    category_breakdown.sort(key=lambda c: (order_index(VALID_CATEGORIES, c.get("category")), c.get("category") or ""))

    # Status breakdown
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    status_agg = await db.issues.aggregate(pipeline).to_list(50)
    status_breakdown = [{"status": s['_id'], "count": s['count']} for s in status_agg]
    status_breakdown.sort(key=lambda s: (order_index(STATUS_ORDER, s.get("status")), s.get("status") or ""))

    # Ward breakdown
    pipeline = [{"$group": {"_id": "$ward", "count": {"$sum": 1}}}]
    ward_agg = await db.issues.aggregate(pipeline).to_list(50)
    ward_breakdown = [{"ward": w['_id'] or 'Unknown', "count": w['count']} for w in ward_agg]
    ward_breakdown.sort(key=lambda w: (order_index(WARD_ORDER, w.get("ward")), w.get("ward") or ""))

    # Resolution time avg
    resolved_issues = await db.issues.find(
        {"status": {"$in": ["resolved", "closed"]}, "resolved_at": {"$ne": None}},
        {"_id": 0, "created_at": 1, "resolved_at": 1}
    ).to_list(500)
    avg_hours = 0
    if resolved_issues:
        diffs = []
        for r in resolved_issues:
            try:
                c = datetime.fromisoformat(r['created_at'])
                d = datetime.fromisoformat(r['resolved_at'])
                diffs.append((d - c).total_seconds() / 3600)
            except Exception:
                pass
        if diffs:
            avg_hours = round(sum(diffs) / len(diffs), 1)

    # 7-day trend
    trend = []
    now = datetime.now(timezone.utc)
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        cnt = await db.issues.count_documents({
            "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
        })
        trend.append({"date": day_start.strftime("%b %d"), "count": cnt})

    sla_breaches = 0
    all_open = await db.issues.find(
        {"status": {"$nin": ["resolved", "closed"]}},
        {"_id": 0, "created_at": 1}
    ).to_list(1000)
    for it in all_open:
        try:
            c = datetime.fromisoformat(it['created_at'])
            if (now - c).total_seconds() / 3600 > 48:
                sla_breaches += 1
        except Exception:
            pass

    return {
        "total": total,
        "resolved": resolved,
        "in_progress": in_progress,
        "pending": pending,
        "avg_resolution_hours": avg_hours,
        "sla_breaches": sla_breaches,
        "category_breakdown": category_breakdown,
        "status_breakdown": status_breakdown,
        "ward_breakdown": ward_breakdown,
        "trend_7d": trend,
    }


@api_router.get("/analytics/supervisor")
async def supervisor_analytics(user=Depends(require_roles('supervisor'))):
    base = await public_analytics()
    # Official performance
    pipeline = [
        {"$match": {"assigned_official_id": {"$ne": None}}},
        {"$group": {
            "_id": {"id": "$assigned_official_id", "name": "$assigned_official_name"},
            "assigned": {"$sum": 1},
            "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["resolved", "closed"]]}, 1, 0]}},
        }}
    ]
    perf = await db.issues.aggregate(pipeline).to_list(50)
    official_perf = [{
        "official_id": p['_id']['id'],
        "name": p['_id'].get('name', 'Unknown'),
        "assigned": p['assigned'],
        "resolved": p['resolved'],
        "resolution_rate": round((p['resolved'] / p['assigned']) * 100, 1) if p['assigned'] else 0,
    } for p in perf]
    official_perf.sort(key=lambda o: ((o.get("name") or "Unknown").lower(), o.get("official_id") or ""))
    base['official_performance'] = official_perf
    return base


@api_router.get("/officials")
async def list_officials(user=Depends(require_roles('supervisor', 'official'))):
    officials = await db.profiles.find({"role": "official"}, {"_id": 0, "password_hash": 0}).to_list(100)
    # Attach current workload (active issues)
    for o in officials:
        active_query = assigned_to_official_query(o)
        active_issues = await db.issues.find(
            active_query,
            {
                "_id": 0,
                "id": 1,
                "title": 1,
                "category": 1,
                "priority": 1,
                "status": 1,
                "address": 1,
            }
        ).sort("created_at", -1).to_list(25)
        o['active_load'] = len(active_issues)
        o['active_issues'] = active_issues
    return officials


@api_router.delete("/officials/{official_id}")
async def delete_official(official_id: str, user=Depends(require_roles('supervisor'))):
    official = await db.profiles.find_one({"id": official_id, "role": "official"}, {"_id": 0})
    if not official:
        raise HTTPException(status_code=404, detail="Official not found")

    active_load = await db.issues.count_documents(assigned_to_official_query(official))
    if active_load > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Reassign {active_load} active issue(s) before deleting this official."
        )

    await db.profiles.delete_one({"id": official_id, "role": "official"})
    await db.notifications.delete_many({"user_id": official_id})
    return {"ok": True, "deleted_official": official.get("full_name")}


@api_router.get("/governance")
async def governance_monitor(user=Depends(require_roles('supervisor'))):
    """
    AI-assisted governance monitoring panel.
    Returns: unassigned, overloaded officials, SLA breaches, suspicious resolutions,
    inactive departments, reassignment history, category efficiency.
    """
    now = datetime.now(timezone.utc)

    # Unassigned issues
    unassigned = await db.issues.find(
        {"assigned_official_id": None, "status": {"$nin": ["resolved", "closed"]}},
        {"_id": 0, "id": 1, "title": 1, "category": 1, "priority": 1, "address": 1, "created_at": 1}
    ).to_list(50)

    # Overloaded officials (>= 5 active issues)
    officials = await db.profiles.find({"role": "official"}, {"_id": 0, "password_hash": 0}).to_list(100)
    overloaded = []
    for o in officials:
        load = await db.issues.count_documents({
            "assigned_official_id": o['id'],
            "status": {"$nin": ["resolved", "closed"]}
        })
        if load >= 5:
            overloaded.append({
                "official_id": o['id'], "name": o['full_name'],
                "ward": o.get('ward'), "load": load,
                "categories": o.get('assigned_categories', [])
            })

    # SLA-breached
    sla_breached = []
    open_issues = await db.issues.find(
        {"status": {"$nin": ["resolved", "closed"]}},
        {"_id": 0, "id": 1, "title": 1, "category": 1, "created_at": 1,
         "assigned_official_name": 1, "address": 1}
    ).to_list(500)
    for it in open_issues:
        try:
            c = datetime.fromisoformat(it['created_at'])
            hours = (now - c).total_seconds() / 3600
            if hours > 48:
                it['hours_open'] = round(hours, 1)
                sla_breached.append(it)
        except Exception:
            pass

    # Suspicious / fake resolutions
    suspicious = await db.issues.find(
        {"$or": [{"status": "suspicious_resolution"},
                 {"resolution_verification.suspicious": True}]},
        {"_id": 0, "id": 1, "title": 1, "category": 1,
         "assigned_official_name": 1, "resolution_verification": 1, "resolved_at": 1}
    ).to_list(100)

    # Category efficiency
    cat_eff = []
    for cat in ['pothole', 'garbage', 'water_leakage', 'streetlight', 'drainage',
                'sewage', 'illegal_construction', 'fallen_tree', 'other']:
        total = await db.issues.count_documents({"category": cat})
        resolved = await db.issues.count_documents({"category": cat, "status": {"$in": ["resolved", "closed"]}})
        if total > 0:
            cat_eff.append({
                "category": cat,
                "total": total,
                "resolved": resolved,
                "efficiency_pct": round((resolved / total) * 100, 1)
            })

    # Inactive departments — categories with 0 active officials assigned
    inactive_departments = []
    for cat in ['pothole', 'garbage', 'water_leakage', 'streetlight', 'drainage',
                'sewage', 'illegal_construction', 'fallen_tree']:
        n_off = await db.profiles.count_documents({"role": "official", "assigned_categories": cat})
        if n_off == 0:
            inactive_departments.append({"category": cat,
                                         "department": DEPARTMENT_BY_CATEGORY.get(cat)})

    # Recent reassignments (flatten history from issues)
    recent_reassignments = []
    issues_with_history = await db.issues.find(
        {"assignment_history": {"$exists": True, "$not": {"$size": 0}}},
        {"_id": 0, "id": 1, "title": 1, "assignment_history": 1}
    ).to_list(100)
    for it in issues_with_history:
        for h in it.get('assignment_history', []):
            recent_reassignments.append({
                "issue_id": it['id'], "issue_title": it['title'], **h
            })
    recent_reassignments = sorted(recent_reassignments,
                                  key=lambda x: x.get('timestamp', ''), reverse=True)[:20]

    return {
        "unassigned_count": len(unassigned),
        "unassigned": unassigned[:20],
        "overloaded_officials": overloaded,
        "sla_breached_count": len(sla_breached),
        "sla_breached": sorted(sla_breached, key=lambda x: x['hours_open'], reverse=True)[:20],
        "suspicious_resolutions_count": len(suspicious),
        "suspicious_resolutions": suspicious[:20],
        "category_efficiency": cat_eff,
        "inactive_departments": inactive_departments,
        "recent_reassignments": recent_reassignments,
    }


# ------------------- Seed -------------------
INDIAN_LOCATIONS = [
    ("MG Road, Bengaluru", 12.9756, 77.6050, "Central"),
    ("Koramangala 5th Block, Bengaluru", 12.9352, 77.6245, "South"),
    ("Andheri West, Mumbai", 19.1364, 72.8296, "West"),
    ("Bandra Linking Road, Mumbai", 19.0596, 72.8295, "West"),
    ("Connaught Place, New Delhi", 28.6315, 77.2167, "Central"),
    ("Saket, New Delhi", 28.5245, 77.2066, "South"),
    ("Salt Lake Sector V, Kolkata", 22.5808, 88.4317, "East"),
    ("T. Nagar, Chennai", 13.0418, 80.2341, "Central"),
    ("Banjara Hills, Hyderabad", 17.4156, 78.4347, "West"),
    ("Hinjawadi, Pune", 18.5908, 73.7384, "West"),
    ("HSR Layout, Bengaluru", 12.9116, 77.6446, "South"),
    ("Vashi, Navi Mumbai", 19.0760, 73.0007, "East"),
    ("Lajpat Nagar, New Delhi", 28.5677, 77.2431, "South"),
    ("Adyar, Chennai", 13.0067, 80.2570, "South"),
    ("Indiranagar, Bengaluru", 12.9784, 77.6408, "East"),
    ("Powai, Mumbai", 19.1197, 72.9099, "North"),
    ("Whitefield, Bengaluru", 12.9698, 77.7500, "East"),
    ("Gurgaon Cyber City", 28.4949, 77.0889, "West"),
    ("Anna Nagar, Chennai", 13.0850, 80.2101, "North"),
    ("Jubilee Hills, Hyderabad", 17.4239, 78.4738, "West"),
]

DEMO_ISSUES = [
    ("pothole", "Massive pothole on main road", "Deep pothole nearly 2 feet wide causing two-wheeler accidents daily near the signal.", "critical"),
    ("garbage", "Garbage pile not collected for 5 days", "Overflowing garbage bins attracting stray dogs and creating foul smell.", "high"),
    ("water_leakage", "Water pipeline burst near park", "Continuous water gushing onto road, wasting thousands of liters per hour.", "high"),
    ("streetlight", "Streetlights out on entire stretch", "All 8 streetlights on this street have been non-functional for two weeks. Safety concern.", "high"),
    ("drainage", "Storm drain blocked, flooding", "Heavy rains cause knee-deep flooding due to clogged drain.", "critical"),
    ("sewage", "Sewage overflow on footpath", "Manhole overflowing, sewage flowing onto pedestrian path.", "critical"),
    ("illegal_construction", "Unauthorized building extension", "Building owner extending second floor without permits, blocking neighbor windows.", "medium"),
    ("fallen_tree", "Fallen tree blocking road", "Large tree uprooted in last night's storm now blocks both lanes of traffic.", "critical"),
    ("pothole", "Cracks and potholes on flyover ramp", "Multiple potholes appearing on the ramp causing damage to vehicles.", "high"),
    ("garbage", "Construction debris dumped illegally", "Pile of construction waste dumped on public land near school.", "medium"),
    ("streetlight", "Single streetlight flickering", "One pole flickering all night, possible electrical hazard.", "low"),
    ("water_leakage", "Tanker truck leak", "Municipal water tanker leaking continuously near distribution point.", "medium"),
    ("drainage", "Open drain without cover", "Drain cover stolen, dangerous open hole 4 feet deep.", "critical"),
    ("fallen_tree", "Branches hanging dangerously over wires", "Tree branches resting on overhead electrical wires after rain.", "high"),
    ("pothole", "Bus stop area damaged", "Road around bus stop riddled with potholes; commuters injured.", "high"),
    ("garbage", "Public dustbin damaged", "Dustbin broken; trash strewn across plaza.", "low"),
    ("sewage", "Bad odor from manhole", "Persistent sewage smell from manhole near market.", "medium"),
    ("streetlight", "Park lights not working", "Entire park is dark at night, anti-social activities reported.", "high"),
    ("drainage", "Backflow during rains", "Drains backflow into society compound during monsoon.", "high"),
    ("pothole", "Newly laid road damaged", "Recently relaid road has potholes within 2 weeks of completion.", "medium"),
    ("water_leakage", "Underground pipe leak", "Wet patch on road indicating underground leak; water bill rising.", "medium"),
    ("garbage", "Wet waste not segregated", "Wet and dry waste mixed at collection point causing pest issues.", "low"),
]


SEED_VERSION = "v3-2026-02"  # bump to force re-seed migration


async def seed_if_empty():
    # Migration: if there are issues without assigned_department, wipe and reseed (v2 migration)
    marker = await db.system.find_one({"key": "seed_version"})
    current_version = marker.get("value") if marker else None

    if current_version != SEED_VERSION:
        logger.info(f"Migrating seed: {current_version} → {SEED_VERSION}. Clearing demo data…")
        await db.issues.delete_many({})
        await db.notifications.delete_many({})
        await db.activity_logs.delete_many({})
        await db.issue_comments.delete_many({})
        await db.issue_votes.delete_many({})
        await db.profiles.delete_many({"email": {"$regex": "@civicpulse\\.in$"}})
        await db.system.update_one({"key": "seed_version"},
                                   {"$set": {"value": SEED_VERSION}}, upsert=True)

    count = await db.issues.count_documents({})
    if count > 0:
        logger.info(f"Seed skipped: {count} issues exist")
        return

    # Demo users with assigned_categories for officials
    users_to_create = [
        # citizens
        ("citizen", "Aarav Sharma", "aarav@civicpulse.in", "password123", "Central", "+91-9876500001", []),
        ("citizen", "Priya Patel", "priya@civicpulse.in", "password123", "West", "+91-9876500002", []),
        ("citizen", "Rohan Kumar", "rohan@civicpulse.in", "password123", "South", "+91-9876500003", []),
        # officials with departments
        ("official", "Officer Ramesh (Roads)", "ramesh.official@civicpulse.in", "password123",
         "Central", "+91-9876511001", ["pothole", "streetlight"]),
        ("official", "Officer Sneha (Sanitation)", "sneha.official@civicpulse.in", "password123",
         "West", "+91-9876511002", ["garbage", "sewage"]),
        ("official", "Officer Vikas (Water)", "vikas.official@civicpulse.in", "password123",
         "South", "+91-9876511003", ["water_leakage", "drainage"]),
        ("official", "Officer Meera (Trees)", "meera.official@civicpulse.in", "password123",
         "East", "+91-9876511004", ["fallen_tree", "other"]),
        ("official", "Officer Arjun (Planning)", "arjun.official@civicpulse.in", "password123",
         "North", "+91-9876511005", ["illegal_construction"]),
        # supervisor
        ("supervisor", "Supervisor Anjali", "anjali.supervisor@civicpulse.in", "password123",
         "All", "+91-9876522001", []),
    ]
    user_ids = {}
    for role, name, email, pw, ward, phone, cats in users_to_create:
        uid = str(uuid.uuid4())
        await db.profiles.insert_one({
            "id": uid,
            "full_name": name,
            "email": email,
            "password_hash": hash_password(pw),
            "role": role,
            "ward": ward,
            "phone_number": phone,
            "assigned_categories": cats,
            "created_at": now_iso(),
        })
        user_ids[email] = uid

    citizen_ids = [user_ids[e] for e in ["aarav@civicpulse.in", "priya@civicpulse.in", "rohan@civicpulse.in"]]

    statuses_distribution = ["submitted"] * 3 + ["acknowledged"] * 6 + ["in_progress"] * 8 + ["resolved"] * 5 + ["closed"] * 1
    now = datetime.now(timezone.utc)

    # Realistic timestamps: hours-old, not days-old
    # Range from 2 hours to 60 hours ago, so SLA breaches show in single digits not 100+
    hour_ages = [2, 4, 6, 8, 10, 12, 18, 24, 30, 36, 40, 44, 48, 50, 54, 56, 60, 62, 66, 70, 72, 80, 96]

    for i, (cat, title, desc, prio) in enumerate(DEMO_ISSUES):
        loc = INDIAN_LOCATIONS[i % len(INDIAN_LOCATIONS)]
        reporter = citizen_ids[i % len(citizen_ids)]
        reporter_doc = await db.profiles.find_one({"id": reporter}, {"_id": 0})
        st = statuses_distribution[i % len(statuses_distribution)]
        hours_ago = hour_ages[i % len(hour_ages)]
        created = now - timedelta(hours=hours_ago)

        # Auto-assign based on category
        match_off = await auto_assign_official(cat, loc[3])
        assigned_id = match_off['id'] if match_off else None
        assigned_name = match_off['full_name'] if match_off else None
        assigned_dept = DEPARTMENT_BY_CATEGORY.get(cat, 'General Administration')

        resolved_at = None
        resolution_note = None
        resolution_image = None
        resolution_verification = None
        if st in ('resolved', 'closed'):
            resolved_at = (created + timedelta(hours=min(hours_ago - 1, 24))).isoformat()
            # Some realistic resolution notes
            sample_notes = [
                "Pothole filled with cold-mix asphalt. Road inspected.",
                "Garbage cleared by Sanitation team. Bin replaced.",
                "Leak located at junction, pipe section replaced.",
                "Streetlight bulb replaced. Voltage verified.",
                "Storm drain manually cleared of debris. Flow restored.",
            ]
            resolution_note = sample_notes[i % len(sample_notes)]
            # Mark the first resolved issue (lowest index) as suspicious for demo
            if i in (17, 18) and resolution_verification is None:
                resolution_note = "done"
                resolution_verification = {
                    "confidence": 0.15, "suspicious": True,
                    "reasoning": "Resolution note 'done' is generic and does not describe action taken."
                }
                st = 'suspicious_resolution'
            else:
                resolution_verification = {
                    "confidence": 0.85, "suspicious": False,
                    "reasoning": "Note describes concrete action plausibly addressing the complaint."
                }

        doc = {
            "id": str(uuid.uuid4()),
            "title": title,
            "description": desc,
            "category": cat,
            "priority": prio,
            "status": st,
            "latitude": loc[1],
            "longitude": loc[2],
            "address": loc[0],
            "ward": loc[3],
            "image_url": None,
            "reporter_id": reporter,
            "reporter_name": reporter_doc['full_name'],
            "assigned_official_id": assigned_id,
            "assigned_official_name": assigned_name,
            "assigned_department": assigned_dept,
            "assignment_history": [],
            "resolution_note": resolution_note,
            "resolution_image": resolution_image,
            "resolution_verification": resolution_verification,
            "upvotes": (i * 7) % 47,
            "ai_summary": desc[:140],
            "created_at": created.isoformat(),
            "updated_at": created.isoformat(),
            "resolved_at": resolved_at,
        }
        await db.issues.insert_one(doc)

    logger.info(f"Seed complete ({SEED_VERSION}): {len(users_to_create)} users + {len(DEMO_ISSUES)} issues")


@app.on_event("startup")
async def startup():
    try:
        await seed_if_empty()
    except Exception as e:
        logger.error(f"Seed error: {e}")


@api_router.get("/")
async def root():
    return {"message": "CivicPulse API live", "version": "1.0"}


# Register routes
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[origin.strip().strip('"').strip("'") for origin in os.environ.get('CORS_ORIGINS', '*').split(',') if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
