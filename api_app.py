import logging
import re
from contextvars import ContextVar

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from langgraph_workflow import (
    run_diagnosis_analyze,
    run_next_round_topics,
    run_operator_generate,
    run_performance_fetch,
    run_profile_analyze,
    run_script_generate,
    run_topic_generate,
)
from schemas import (
    DiagnosisAnalyzeRequest,
    DiagnosisResponse,
    OperatorGenerateRequest,
    OperatorResponse,
    PerformanceFetchRequest,
    PerformanceResponse,
    ProfileAnalyzeResponse,
    QuizAnswerSet,
    ScriptGenerateRequest,
    ScriptResponse,
    TopicGenerateRequest,
    TopicResponse,
)
from session_store import session_store
from config import MODEL
from accounts import router as accounts_router
import accounts

logger = logging.getLogger(__name__)
request_owner = ContextVar("request_owner", default=None)


def _failure(message, exc):
    if isinstance(exc, HTTPException):
        return exc
    logger.exception(message)
    # Return actionable local validation messages, never provider response bodies.
    detail = str(exc) if isinstance(exc, ValueError) and str(exc).startswith(("脚本", "第 ", "未配置", "模型返回")) else "请稍后重试，并检查后端配置和模型服务。"
    return HTTPException(status_code=503, detail=f"{message}：{detail}")
def _to_dict(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _ensure_session_id(session_id=None, claim=True):
    if session_id and not re.fullmatch(r"[a-f0-9]{32}", session_id):
        raise HTTPException(status_code=400, detail="会话标识无效。")
    owner = request_owner.get()
    if session_id:
        state = session_store.get(session_id)
        if state.get("owner_id") and state["owner_id"] != owner:
            raise HTTPException(status_code=404, detail="会话不存在或无权访问。")
        if claim and owner and not state.get("owner_id"):
            session_store.update(session_id, {"owner_id": owner})
        return session_id
    return session_store.create({"owner_id": owner} if owner else {})


app = FastAPI(
    title="GrowMate API",
    description="Backend API for the GrowMate KOC growth agent demo.",
    version="2.1.0",
    default_response_class=JSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(accounts_router)


@app.middleware("http")
async def account_session_context(request, call_next):
    user = accounts.store.user(request.cookies.get(accounts.COOKIE)) if request.url.path.startswith("/api/") else None
    if user and request.method not in ("GET", "HEAD", "OPTIONS"):
        try:
            accounts.check_origin(request)
        except HTTPException as exc:
            return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
    token = request_owner.set(user["id"] if user else None)
    try:
        return await call_next(request)
    finally:
        request_owner.reset(token)


@app.get("/health")
def health_check():
    return {"status": "ok", "model": MODEL}


@app.get("/api/session/{session_id}")
def restore_session(session_id: str):
    _ensure_session_id(session_id, claim=False)
    state = session_store.get(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="会话不存在或已过期，请重新开始。")
    return {"session_id": session_id, "state": state}


@app.post("/api/profile/analyze", response_model=ProfileAnalyzeResponse)
def profile_analyze(request: QuizAnswerSet):
    if len(request.answers) != 16:
        raise HTTPException(status_code=400, detail="answers 必须正好包含 16 个选项。")

    try:
        session_id = _ensure_session_id(request.session_id)
        graph_state = run_profile_analyze(request.answers, request.desired_content, request.target_duration, request.growth_goal)
        profile = graph_state["profile"]
        positioning = graph_state["positioning"]
        session_store.update(session_id, {"profile": profile, "positioning": positioning, "graph_trace": graph_state.get("trace", [])})
        return {"session_id": session_id, "profile": profile, "positioning": positioning, "graph_trace": graph_state.get("trace", [])}
    except Exception as exc:
        raise _failure("账号定位分析失败", exc) from exc


@app.post("/api/topic/generate", response_model=TopicResponse)
def topic_generate(request: TopicGenerateRequest):
    try:
        session_id = _ensure_session_id(request.session_id)
        graph_state = run_topic_generate(
            _to_dict(request.profile),
            positioning=request.positioning,
            previous_rejections=request.previous_rejections,
            strategy_memory=request.strategy_memory or session_store.get(session_id).get("strategy", {}),
        )
        session_store.update(session_id, {"topic_candidates": graph_state["topics"], "graph_trace": graph_state.get("trace", [])})
        return {"session_id": session_id, "topics": graph_state["topics"], "graph_trace": graph_state.get("trace", [])}
    except Exception as exc:
        raise _failure("选题生成失败", exc) from exc


@app.post("/api/topic/regenerate", response_model=TopicResponse)
def topic_regenerate(request: TopicGenerateRequest):
    try:
        session_id = _ensure_session_id(request.session_id)
        graph_state = run_next_round_topics(
            _to_dict(request.profile),
            positioning=request.positioning,
            previous_rejections=request.previous_rejections,
            strategy_memory=request.strategy_memory or session_store.get(session_id).get("strategy", {}),
            selected_topic=request.previous_rejections[-1] if request.previous_rejections else None,
        )
        session_store.update(
            session_id,
            {
                "topic_candidates": graph_state["topics"],
                "topic_rejections": request.previous_rejections,
                "graph_trace": graph_state.get("trace", []),
            },
        )
        return {"session_id": session_id, "topics": graph_state["topics"], "graph_trace": graph_state.get("trace", [])}
    except Exception as exc:
        raise _failure("选题重生成失败", exc) from exc


@app.post("/api/script/generate", response_model=ScriptResponse)
def script_generate(request: ScriptGenerateRequest):
    try:
        session_id = _ensure_session_id(request.session_id)
        graph_state = run_script_generate(_to_dict(request.profile), request.selected_topic)
        result = graph_state["script"]
        session_store.update(
            session_id,
            {
                "selected_topic": request.selected_topic,
                "script": result,
                "graph_trace": graph_state.get("trace", []),
            },
        )
        return {"session_id": session_id, **result, "graph_trace": graph_state.get("trace", [])}
    except Exception as exc:
        raise _failure("脚本生成失败", exc) from exc


@app.post("/api/operator/generate", response_model=OperatorResponse)
def operator_generate(request: OperatorGenerateRequest):
    try:
        session_id = _ensure_session_id(request.session_id)
        graph_state = run_operator_generate(_to_dict(request.profile), request.selected_topic)
        result = graph_state["operator"]
        session_store.update(session_id, {"operator": result, "graph_trace": graph_state.get("trace", [])})
        return {"session_id": session_id, **result, "graph_trace": graph_state.get("trace", [])}
    except Exception as exc:
        raise _failure("运营建议生成失败", exc) from exc


@app.post("/api/performance/fetch", response_model=PerformanceResponse)
def performance_fetch(request: PerformanceFetchRequest):
    try:
        session_id = _ensure_session_id(request.session_id)
        graph_state = run_performance_fetch(
            video_id=request.video_id,
            mode=request.mode,
            manual_metrics=_to_dict(request.manual_metrics) if request.manual_metrics is not None else None,
        )
        result = graph_state["performance"]
        session_store.update(session_id, {"performance": result, "graph_trace": graph_state.get("trace", [])})
        return {"session_id": session_id, **result, "graph_trace": graph_state.get("trace", [])}
    except Exception as exc:
        raise _failure("表现数据获取失败", exc) from exc


@app.post("/api/diagnosis/analyze", response_model=DiagnosisResponse)
def diagnosis_analyze(request: DiagnosisAnalyzeRequest):
    try:
        session_id = _ensure_session_id(request.session_id)
        graph_state = run_diagnosis_analyze(
            _to_dict(request.profile),
            request.selected_topic,
            request.performance,
            strategy_memory=request.strategy_memory or session_store.get(session_id).get("strategy", {}),
        )
        result = {
            "diagnosis": graph_state["diagnosis"],
            "strategy": graph_state["strategy_memory"],
        }
        session_store.update(
            session_id,
            {
                "diagnosis": result["diagnosis"],
                "strategy": result["strategy"],
                "graph_trace": graph_state.get("trace", []),
            },
        )
        return {"session_id": session_id, **result, "graph_trace": graph_state.get("trace", [])}
    except Exception as exc:
        raise _failure("复盘分析失败", exc) from exc
