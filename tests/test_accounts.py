from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
import accounts
from api_app import app
from session_store import SessionStore


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = accounts.AccountStore(Path(self.tmp.name) / "accounts.sqlite3")
        self.patcher = patch.object(accounts, "store", self.store)
        self.patcher.start()
        self.client = TestClient(app)
        self.credentials = {"email": "creator@example.com", "password": "test-password-123", "name": "测试创作者"}

    def tearDown(self):
        self.client.close()
        self.patcher.stop()
        self.tmp.cleanup()

    def test_register_profile_logout_login_and_password_storage(self):
        response = self.client.post("/api/auth/register", json=self.credentials)
        self.assertEqual(response.status_code, 201)
        self.assertIn("HttpOnly", response.headers["set-cookie"])
        self.assertIn("SameSite=lax", response.headers["set-cookie"])
        user = response.json()["user"]
        self.assertNotIn("password", user)
        self.assertEqual(self.client.get("/api/auth/me").json()["user"]["name"], "测试创作者")
        with self.store.connect() as db:
            password = db.execute("SELECT password FROM users").fetchone()[0]
        self.assertNotIn(self.credentials["password"], password)
        self.assertEqual(self.client.post("/api/auth/register", json=self.credentials).status_code, 409)
        self.assertEqual(self.client.patch("/api/auth/profile", json={"name": "新昵称"}).json()["user"]["name"], "新昵称")
        token = self.client.cookies.get(accounts.COOKIE)
        self.client.post("/api/auth/logout")
        self.assertIsNone(self.store.user(token))
        self.assertIsNone(self.client.get("/api/auth/me").json()["user"])
        self.assertEqual(self.client.post("/api/auth/login", json={**self.credentials, "password": "wrong-password"}).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json=self.credentials).status_code, 200)

    def test_projects_are_private_persistent_and_restorable(self):
        self.assertEqual(self.client.get("/api/projects").status_code, 401)
        self.client.post("/api/auth/register", json=self.credentials)
        snapshot = {"title": "我的选题", "stage": "topics", "state": {"version": 5, "customGoalText": "稳定涨粉", "topics": []}}
        response = self.client.post("/api/projects", json=snapshot)
        self.assertEqual(response.status_code, 201)
        project_id = response.json()["id"]
        self.assertEqual(len(self.client.get("/api/projects").json()["projects"]), 1)
        self.assertEqual(self.client.get(f"/api/projects/{project_id}").json()["state"], snapshot["state"])
        accounts.AccountStore(self.store.path)
        self.assertEqual(self.client.get(f"/api/projects/{project_id}").status_code, 200)
        with TestClient(app) as other:
            other.post("/api/auth/register", json={**self.credentials, "email": "other@example.com"})
            self.assertEqual(other.get("/api/projects").json()["projects"], [])
            self.assertEqual(other.get(f"/api/projects/{project_id}").status_code, 404)
            self.assertEqual(other.delete(f"/api/projects/{project_id}").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/projects/{project_id}").status_code, 200)
        self.assertEqual(self.client.get("/api/projects").json()["projects"], [])

    def test_origin_validation_and_rate_limit(self):
        response = self.client.post("/api/auth/register", json=self.credentials, headers={"Origin": "https://untrusted.example"})
        self.assertEqual(response.status_code, 403)
        for _ in range(20):
            self.store.limit("test-key")
        with self.assertRaises(Exception) as caught:
            self.store.limit("test-key")
        self.assertEqual(caught.exception.status_code, 429)

    def test_authenticated_workflow_sessions_are_owner_scoped(self):
        workflow_store = SessionStore(Path(self.tmp.name) / "workflow.sqlite3")
        self.client.post("/api/auth/register", json=self.credentials)
        with patch("api_app.session_store", workflow_store), patch("api_app.run_profile_analyze", return_value={
            "profile": {"type": "life", "label": "生活型", "desired_content": "测试", "target_duration": 30, "growth_goal": "稳定涨粉"},
            "positioning": {"persona": "生活", "account_positioning": "生活号", "content_style": "真实", "target_audience": "大学生", "persona_tags": [], "expression_formats": [], "starter_suggestions": []},
        }):
            missing_id = "a" * 32
            self.assertEqual(self.client.get(f"/api/session/{missing_id}").status_code, 404)
            self.assertEqual(workflow_store.get(missing_id), {})
            response = self.client.post("/api/profile/analyze", json={"answers": ["A"] * 16, "desired_content": "测试", "target_duration": 30})
            self.assertEqual(response.status_code, 200)
            session_id = response.json()["session_id"]
            self.assertEqual(self.client.get(f"/api/session/{session_id}").status_code, 200)
            with TestClient(app) as guest:
                self.assertEqual(guest.get(f"/api/session/{session_id}").status_code, 404)
                guest.post("/api/auth/register", json={**self.credentials, "email": "another@example.com"})
                self.assertEqual(guest.get(f"/api/session/{session_id}").status_code, 404)


if __name__ == "__main__":
    unittest.main()
