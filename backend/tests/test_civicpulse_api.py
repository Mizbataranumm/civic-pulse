"""
CivicPulse Backend API Test Suite
Tests all major endpoints: auth, issues, AI categorization, notifications, analytics
"""
import os
import uuid
import time
import pytest
import requests

from dotenv import load_dotenv
from pathlib import Path

# Try loading env configurations
for env_path in [Path(__file__).parents[1] / '.env', Path(__file__).parents[2] / 'frontend' / '.env']:
    if env_path.exists():
        load_dotenv(env_path)

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')
API = f"{BASE_URL}/api"

# Seeded credentials (password from env, defaults to seed value)
CITIZEN_EMAIL = "aarav@civicpulse.in"
OFFICIAL_EMAIL = "ramesh.official@civicpulse.in"
SUPERVISOR_EMAIL = "anjali.supervisor@civicpulse.in"
PASSWORD = os.environ.get('TEST_SEED_PASSWORD', 'password123')


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(s, email, password=PASSWORD):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def citizen_auth(session):
    return _login(session, CITIZEN_EMAIL)


@pytest.fixture(scope="session")
def official_auth(session):
    return _login(session, OFFICIAL_EMAIL)


@pytest.fixture(scope="session")
def supervisor_auth(session):
    return _login(session, SUPERVISOR_EMAIL)


def _hdr(auth):
    return {"Authorization": f"Bearer {auth['token']}"}


# ---------------- AUTH TESTS ----------------
class TestAuth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert "CivicPulse" in r.json().get("message", "")

    def test_signup_new_user(self, session):
        email = f"TEST_user_{uuid.uuid4().hex[:8]}@civicpulse.in"
        payload = {"full_name": "Test User", "email": email, "password": "testpass123", "role": "citizen", "ward": "Central"}
        r = session.post(f"{API}/auth/signup", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
        # API lowercases the email - acceptable normalization
        assert data["user"]["email"].lower() == email.lower()
        assert data["user"]["role"] == "citizen"
        assert data["user"]["full_name"] == "Test User"
        assert "id" in data["user"]

    def test_signup_duplicate_email_returns_400(self, session):
        payload = {"full_name": "Dup", "email": CITIZEN_EMAIL, "password": "x", "role": "citizen"}
        r = session.post(f"{API}/auth/signup", json=payload)
        assert r.status_code == 400
        assert "already" in r.json().get("detail", "").lower()

    def test_signup_official_and_supervisor(self, session):
        for role in ("official", "supervisor"):
            email = f"TEST_{role}_{uuid.uuid4().hex[:8]}@civicpulse.in"
            r = session.post(f"{API}/auth/signup", json={
                "full_name": f"T {role}", "email": email, "password": "testpass123", "role": role
            })
            assert r.status_code == 200
            assert r.json()["user"]["role"] == role

    def test_login_seeded_citizen(self, session):
        data = _login(session, CITIZEN_EMAIL)
        assert data["user"]["email"] == CITIZEN_EMAIL
        assert data["user"]["role"] == "citizen"
        assert "token" in data

    def test_login_invalid_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": CITIZEN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_email(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "nope@nowhere.io", "password": "x"})
        assert r.status_code == 401

    def test_me_returns_profile(self, session, citizen_auth):
        r = session.get(f"{API}/auth/me", headers=_hdr(citizen_auth))
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == CITIZEN_EMAIL
        assert data["role"] == "citizen"
        assert "password_hash" not in data
        assert "_id" not in data

    def test_me_no_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------- AI CATEGORIZATION ----------------
class TestAICategorize:
    ALLOWED_CATEGORIES = {"pothole", "garbage", "water_leakage", "streetlight", "drainage", "sewage", "illegal_construction", "fallen_tree", "other"}
    ALLOWED_PRIORITIES = {"low", "medium", "high", "critical"}

    def test_ai_categorize_pothole(self, session):
        desc = "There is a huge pothole on the main road causing two-wheeler accidents daily near the bus stop"
        r = session.post(f"{API}/ai/categorize", json={"description": desc})
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) >= {"category", "priority", "suggested_department", "ai_summary"}
        assert data["category"] == "pothole"
        assert data["priority"] == "critical"
        assert data["suggested_department"] == "Public Works Department"
        assert isinstance(data["suggested_department"], str) and len(data["suggested_department"]) > 0
        assert isinstance(data["ai_summary"], str)

    def test_ai_categorize_short_desc_fallback(self, session):
        r = session.post(f"{API}/ai/categorize", json={"description": "hi"})
        assert r.status_code == 200
        data = r.json()
        assert data["category"] == "other"
        assert data["priority"] == "medium"

    def test_ai_categorize_garbage_likely(self, session):
        desc = "Garbage piles overflowing on the street for the last week, foul smell and stray dogs everywhere"
        r = session.post(f"{API}/ai/categorize", json={"description": desc})
        assert r.status_code == 200
        data = r.json()
        assert data["category"] == "garbage"
        assert data["priority"] == "critical"

    def test_ai_categorize_common_pothole_typo(self, session):
        desc = "Massive pathole on MG road is causing daily accidents"
        r = session.post(f"{API}/ai/categorize", json={"description": desc})
        assert r.status_code == 200
        data = r.json()
        assert data["category"] == "pothole"
        assert data["priority"] == "critical"


# ---------------- ISSUES ----------------
class TestIssues:
    @pytest.fixture(scope="class")
    def created_issue(self, session, citizen_auth):
        payload = {
            "title": "TEST_Pothole on test road",
            "description": "Large pothole created by test suite for verification purposes only, please ignore",
            "category": "pothole",
            "priority": "high",
            "latitude": 12.9756,
            "longitude": 77.6050,
            "address": "TEST_MG Road",
            "image_url": None,
        }
        r = session.post(f"{API}/issues", json=payload, headers=_hdr(citizen_auth))
        assert r.status_code == 200, r.text
        return r.json()

    def test_create_issue(self, created_issue):
        assert created_issue["title"].startswith("TEST_")
        assert created_issue["status"] in ("submitted", "acknowledged")
        assert created_issue["upvotes"] == 0
        assert "id" in created_issue
        assert "_id" not in created_issue
        assert "ai_summary" in created_issue
        assert "created_at" in created_issue and isinstance(created_issue["created_at"], str)
        assert "T" in created_issue["created_at"]  # ISO format

    def test_create_issue_requires_auth(self, session):
        r = session.post(f"{API}/issues", json={
            "title": "x", "description": "x", "category": "pothole",
            "latitude": 0, "longitude": 0, "address": "x"
        })
        assert r.status_code == 401

    def test_get_issue_with_comments_activity(self, session, citizen_auth, created_issue):
        r = session.get(f"{API}/issues/{created_issue['id']}", headers=_hdr(citizen_auth))
        assert r.status_code == 200
        data = r.json()
        assert "issue" in data and "comments" in data and "activity" in data
        assert data["issue"]["id"] == created_issue["id"]
        assert isinstance(data["activity"], list) and len(data["activity"]) >= 1  # at least "Issue reported"
        assert "hours_open" in data["issue"]
        assert "sla_status" in data["issue"]
        assert "_id" not in data["issue"]

    def test_get_issue_not_found(self, session, citizen_auth):
        r = session.get(f"{API}/issues/nonexistent-id-xyz", headers=_hdr(citizen_auth))
        assert r.status_code == 404

    def test_list_issues_mine_filter(self, session, citizen_auth, created_issue):
        r = session.get(f"{API}/issues?mine=true", headers=_hdr(citizen_auth))
        assert r.status_code == 200
        issues = r.json()
        assert isinstance(issues, list) and len(issues) > 0
        # all should belong to me
        my_id = created_issue["reporter_id"]
        for it in issues:
            assert it["reporter_id"] == my_id

    def test_list_issues_category_filter(self, session, citizen_auth):
        r = session.get(f"{API}/issues?category=pothole", headers=_hdr(citizen_auth))
        assert r.status_code == 200
        for it in r.json():
            assert it["category"] == "pothole"

    def test_list_issues_status_filter(self, session, citizen_auth):
        r = session.get(f"{API}/issues?status_filter=resolved", headers=_hdr(citizen_auth))
        assert r.status_code == 200
        for it in r.json():
            assert it["status"] == "resolved"

    def test_list_issues_assigned_filter(self, session, official_auth):
        r = session.get(f"{API}/issues?assigned=true", headers=_hdr(official_auth))
        assert r.status_code == 200
        # may be empty for some officials; just check structure
        assert isinstance(r.json(), list)

    def test_public_issues_no_auth(self, session):
        r = session.get(f"{API}/issues/public")
        assert r.status_code == 200
        issues = r.json()
        assert isinstance(issues, list)
        assert len(issues) >= 20, f"Expected ≥20 seeded issues, got {len(issues)}"
        sample = issues[0]
        # public response should NOT leak _id
        assert "_id" not in sample
        # sla fields
        for k in ("hours_open", "sla_status", "overdue"):
            assert k in sample, f"Missing SLA field {k}"

    def test_patch_issue_as_citizen_forbidden(self, session, citizen_auth, created_issue):
        r = session.patch(f"{API}/issues/{created_issue['id']}",
                          json={"status": "acknowledged"},
                          headers=_hdr(citizen_auth))
        assert r.status_code == 403

    def test_patch_issue_as_official_updates_status(self, session, official_auth, created_issue):
        r = session.patch(f"{API}/issues/{created_issue['id']}",
                          json={"status": "acknowledged"},
                          headers=_hdr(official_auth))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "acknowledged"
        # Verify persisted
        r2 = requests.get(f"{API}/issues/{created_issue['id']}", headers=_hdr(official_auth))
        assert r2.json()["issue"]["status"] == "acknowledged"

    def test_patch_resolve_sets_resolved_at(self, session, official_auth, created_issue):
        r = session.patch(f"{API}/issues/{created_issue['id']}",
                          json={"status": "resolved", "resolution_note": "Pothole filled with cold-mix asphalt. Road inspected."},
                          headers=_hdr(official_auth))
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "resolved"
        assert data.get("resolved_at") is not None

    def test_add_comment(self, session, official_auth, created_issue):
        r = session.post(f"{API}/issues/{created_issue['id']}/comments",
                         json={"comment": "TEST_comment from official"},
                         headers=_hdr(official_auth))
        assert r.status_code == 200
        c = r.json()
        assert c["comment"] == "TEST_comment from official"
        assert c["user_role"] == "official"
        assert "_id" not in c

    def test_upvote_increments(self, session, citizen_auth, created_issue):
        before = session.get(f"{API}/issues/{created_issue['id']}", headers=_hdr(citizen_auth)).json()["issue"]["upvotes"]
        r = session.post(f"{API}/issues/{created_issue['id']}/upvote", headers=_hdr(citizen_auth))
        assert r.status_code == 200
        assert r.json()["upvotes"] == before + 1


# ---------------- NOTIFICATIONS ----------------
class TestNotifications:
    def test_get_notifications(self, session, citizen_auth):
        # ensure at least one notif by creating an issue
        session.post(f"{API}/issues", json={
            "title": "TEST_notif_trigger", "description": "trigger notif",
            "category": "other", "priority": "low",
            "latitude": 0, "longitude": 0, "address": "x"
        }, headers=_hdr(citizen_auth))
        r = session.get(f"{API}/notifications", headers=_hdr(citizen_auth))
        assert r.status_code == 200
        notifs = r.json()
        assert isinstance(notifs, list)
        assert len(notifs) >= 1
        sample = notifs[0]
        for k in ("id", "title", "message", "read", "created_at"):
            assert k in sample
        assert "_id" not in sample

    def test_mark_all_read(self, session, citizen_auth):
        r = session.post(f"{API}/notifications/read-all", headers=_hdr(citizen_auth))
        assert r.status_code == 200
        assert r.json()["ok"]
        # verify
        r2 = session.get(f"{API}/notifications", headers=_hdr(citizen_auth))
        for n in r2.json():
            assert n["read"]


# ---------------- ANALYTICS ----------------
class TestAnalytics:
    def test_public_analytics(self, session):
        r = session.get(f"{API}/analytics/public")
        assert r.status_code == 200
        data = r.json()
        required = {"total", "resolved", "in_progress", "pending", "avg_resolution_hours",
                    "sla_breaches", "category_breakdown", "status_breakdown",
                    "ward_breakdown", "trend_7d"}
        missing = required - set(data.keys())
        assert not missing, f"Missing analytics keys: {missing}"
        assert data["total"] >= 20
        assert isinstance(data["category_breakdown"], list)
        assert isinstance(data["status_breakdown"], list)
        assert isinstance(data["ward_breakdown"], list)
        assert isinstance(data["trend_7d"], list) and len(data["trend_7d"]) == 7

    def test_supervisor_analytics_requires_supervisor(self, session, citizen_auth):
        r = session.get(f"{API}/analytics/supervisor", headers=_hdr(citizen_auth))
        assert r.status_code == 403

    def test_supervisor_analytics_ok(self, session, supervisor_auth):
        r = session.get(f"{API}/analytics/supervisor", headers=_hdr(supervisor_auth))
        assert r.status_code == 200
        data = r.json()
        assert "official_performance" in data
        assert isinstance(data["official_performance"], list)
        if data["official_performance"]:
            p = data["official_performance"][0]
            for k in ("official_id", "name", "assigned", "resolved", "resolution_rate"):
                assert k in p


# ---------------- OFFICIALS ----------------
class TestOfficials:
    def test_officials_requires_role(self, session, citizen_auth):
        r = session.get(f"{API}/officials", headers=_hdr(citizen_auth))
        assert r.status_code == 403

    def test_officials_supervisor(self, session, supervisor_auth):
        r = session.get(f"{API}/officials", headers=_hdr(supervisor_auth))
        assert r.status_code == 200
        officials = r.json()
        assert isinstance(officials, list)
        assert len(officials) >= 3
        for o in officials:
            assert o["role"] == "official"
            assert "password_hash" not in o
            assert "_id" not in o

    def test_officials_official_role(self, session, official_auth):
        r = session.get(f"{API}/officials", headers=_hdr(official_auth))
        assert r.status_code == 200


# ---------------- SEED VERIFICATION ----------------
class TestSeed:
    def test_seed_20_issues(self, session):
        r = session.get(f"{API}/issues/public")
        assert len(r.json()) >= 20

    def test_seed_demo_accounts(self, session):
        demo_emails = [
            "aarav@civicpulse.in", "priya@civicpulse.in", "rohan@civicpulse.in",
            "ramesh.official@civicpulse.in", "sneha.official@civicpulse.in", "vikas.official@civicpulse.in",
            "anjali.supervisor@civicpulse.in",
        ]
        for email in demo_emails:
            r = session.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD})
            assert r.status_code == 200, f"Demo account {email} failed to login"
