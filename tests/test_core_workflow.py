import json
from pathlib import Path
import re
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

import api_app
import llm_utils
import script_agent
from langgraph_workflow import _route_performance_mode
from schemas import ManualMetrics, PersonaProfile, QuizAnswerSet
from session_store import SessionStore
from strategy_memory import update_strategy_memory
from workflow_service import build_answers_payload, score_persona


TOPIC = dict(title="学习复盘", hook="试试这个方法", angle="真实案例", heat=65, fit=85, growth_potential=70, reason="适合目标受众")
PROFILE = dict(type="knowledge", label="知识导航型 KOC", desired_content="学习效率", target_duration=60, growth_goal="提升评论互动")
POSITIONING = dict(persona="知识导航", account_positioning="学习方法", content_style="真实", target_audience="大学生", persona_tags=["方法"], expression_formats=["口播"], starter_suggestions=["验证"])
METRICS = dict(views=1000, likes=80, comments=15, shares=5, follows=10)


def fake_script_model(prompt):
    match = re.search(r"Write only these segments in this order: (.+)\.\n", prompt)
    if not match:
        return dict(title="学习复盘", hook="试试这个方法", summary="实用方法", cover_text="学习复盘", comment_cta="分享你的方法", outline=["背景", "案例", "方法"])
    budgets = json.loads(match.group(1))
    return {"timeline": [dict(stage=item["stage"], duration=item["duration_text"], visual="真人出镜结合学习笔记", action_tip="展示具体笔记内容", voiceover="学" * item["target_characters"]) for item in budgets]}


class CoreWorkflowTests(unittest.TestCase):
    def test_invalid_quiz_and_duration_rejected(self):
        for answers in (["Z"] * 16, ["A"] * 15, [""] * 16):
            with self.assertRaises(ValidationError):
                QuizAnswerSet(answers=answers, desired_content="test", target_duration=60)
        for duration in (-1, 0, 3001):
            with self.assertRaises(ValidationError):
                PersonaProfile(**{**PROFILE, "target_duration": duration})

    def test_manual_metrics_require_complete_nonnegative_integers(self):
        for bad in ({**METRICS, "views": 0}, {**METRICS, "likes": -1}, {**METRICS, "likes": 1.5}):
            with self.assertRaises(ValidationError):
                ManualMetrics(**bad)

    def test_quiz_option_semantics_and_mixed_preferences(self):
        self.assertEqual(build_answers_payload(["C"] * 16)[0]["answer_text"], "知识干货")
        profile = score_persona(["A", "B", "C", "D"] * 4, "学习", 60, "提升互动")
        self.assertEqual(profile["type"], "mixed")
        self.assertEqual(profile["growth_goal"], "提升互动")

    def test_explicit_mock_mode_ignores_video_id(self):
        self.assertEqual(_route_performance_mode({"mode": "mock", "video_id": "test"}), "mock")

    def test_duration_scripts_cover_all_stages_with_real_length_checks(self):
        with patch.object(script_agent, "invoke_json", side_effect=fake_script_model):
            for duration in (30, 60, 180, 600, 3000):
                with self.subTest(duration=duration):
                    result = llm_utils.ensure_script(script_agent.generate_script(PROFILE, TOPIC, duration), duration)
                    self.assertEqual(result["timeline"][-1]["duration"].split("-")[-1], f"{duration}秒")
                    self.assertLess(abs(result["estimated_voiceover_seconds"] - duration), 2)
                    self.assertGreater(result["voiceover_characters"], duration * 3)
        with self.assertRaises(ValueError):
            llm_utils.ensure_script({"timeline": [{"voiceover": "一句话"}]}, 600)

    def test_short_model_script_is_retried_then_rejected(self):
        with patch.object(script_agent, "invoke_json", return_value={"timeline": []}) as model:
            with self.assertRaises(ValueError):
                script_agent.generate_script(PROFILE, TOPIC, 60)
            self.assertEqual(model.call_count, 3)

    def test_json_repair_does_not_call_real_model(self):
        model = SimpleNamespace(invoke=unittest.mock.Mock(side_effect=[SimpleNamespace(content="not json"), SimpleNamespace(content='{"ok":true}')]))
        with patch.object(llm_utils, "get_llm", return_value=model):
            self.assertEqual(llm_utils.invoke_json("test"), {"ok": True})

    def test_missing_key_has_clear_error(self):
        with patch.object(llm_utils, "API_KEY", None):
            with self.assertRaisesRegex(ValueError, "DEEPSEEK_API_KEY"):
                llm_utils.get_llm()

    def test_strategy_history_bounded_and_not_fixed(self):
        memory = {}
        for i in range(20):
            memory = update_strategy_memory(memory, {"suggestions": [f"建议{i}"], "next_focus": f"重点{i}", "avoid": ["重复建议"]}, {"source": "manual", **METRICS}, "评论")
        self.assertEqual(memory["next_focus"], "重点19")
        self.assertEqual(len(memory["history"]), 10)
        self.assertEqual(memory["avoid"], ["重复建议"])

    def test_persistent_session_and_concurrent_updates(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sessions.sqlite3"
            store = SessionStore(path)
            session = store.create({"profile": PROFILE})
            with ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(lambda i: store.update(session, {str(i): i}), range(8)))
            restored = SessionStore(path).get(session)
            self.assertEqual(restored["profile"]["growth_goal"], PROFILE["growth_goal"])
            self.assertTrue(all(str(i) in restored for i in range(8)))

    def test_full_api_flow_and_server_side_memory_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            store = SessionStore(Path(directory) / "sessions.sqlite3")
            with patch.object(api_app, "session_store", store), TestClient(api_app.app) as client, \
                 patch("workflow_service.analyze_profile", return_value=POSITIONING), \
                 patch("workflow_service.generate_topic", return_value={"topics": [TOPIC] * 3}) as topic_model, \
                 patch.object(script_agent, "invoke_json", side_effect=fake_script_model), \
                 patch("workflow_service.generate_operator", return_value=dict(publish_time="明天 19:30 试发", schedule=["明天试发"], comment_hooks=["有什么问题"], interaction_tips=["回复评论"])), \
                 patch("workflow_service.diagnose", return_value=dict(problem="待验证", strengths=["互动"], suggestions=["测试评论提问"], next_topics=["学习案例"], next_focus="对比评论率", avoid=["同时更改多个变量"])):
                response = client.post("/api/profile/analyze", json=dict(answers=["C"] * 16, desired_content="学习", target_duration=60, growth_goal="提升评论互动"))
                self.assertEqual(response.status_code, 200, response.text)
                data = response.json()
                base = dict(session_id=data["session_id"], profile=data["profile"])
                self.assertEqual(data["profile"]["growth_goal"], "提升评论互动")
                response = client.post("/api/topic/generate", json={**base, "positioning": data["positioning"]})
                self.assertEqual(response.status_code, 200, response.text)
                for route in ("script", "operator"):
                    response = client.post(f"/api/{route}/generate", json={**base, "selected_topic": TOPIC})
                    self.assertEqual(response.status_code, 200, response.text)
                perf = client.post("/api/performance/fetch", json=dict(session_id=base["session_id"], mode="manual", manual_metrics=METRICS))
                self.assertEqual(perf.status_code, 200, perf.text)
                review = client.post("/api/diagnosis/analyze", json={**base, "selected_topic": TOPIC, "performance": perf.json()})
                self.assertEqual(review.status_code, 200, review.text)
                self.assertIn("10.00%", review.json()["diagnosis"]["evidence"][1])
                self.assertTrue(review.json()["diagnosis"]["limitations"])
                response = client.post("/api/topic/generate", json=base)
                self.assertEqual(response.status_code, 200, response.text)
                context = topic_model.call_args.args[1]
                self.assertEqual(context["strategy_memory"]["next_focus"], "对比评论率")
                self.assertEqual(client.get(f"/api/session/{base['session_id']}").status_code, 200)
                self.assertEqual(client.post("/api/profile/analyze", json=dict(answers=["Z"] * 16, desired_content="test", target_duration=60)).status_code, 422)
                self.assertEqual(client.post("/api/topic/generate", json={**base, "session_id": "invalid"}).status_code, 400)
                simulated = client.post("/api/performance/fetch", json=dict(mode="mock"))
                review = client.post("/api/diagnosis/analyze", json={**base, "selected_topic": TOPIC, "performance": simulated.json()})
                self.assertIn("模拟数据", review.json()["diagnosis"]["limitations"][0])


if __name__ == "__main__":
    unittest.main()
