from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from workflow_service import (
    analyze_diagnosis,
    fetch_performance,
    generate_operator_plan,
    generate_positioning,
    generate_script_content,
    generate_topics,
    score_persona,
)


class GrowMateGraphState(TypedDict, total=False):
    task: str
    answers: List[str]
    desired_content: str
    growth_goal: str
    target_duration: int
    profile: Dict[str, Any]
    positioning: Dict[str, Any]
    previous_rejections: List[Dict[str, Any]]
    strategy_memory: Dict[str, Any]
    selected_topic: Dict[str, Any]
    video_id: Optional[str]
    mode: str
    manual_metrics: Optional[Dict[str, Any]]
    performance: Dict[str, Any]
    diagnosis: Dict[str, Any]
    topics: List[Dict[str, Any]]
    script: Dict[str, Any]
    operator: Dict[str, Any]
    trace: List[str]
    performance_source_route: str


def _append_trace(state: GrowMateGraphState, message: str):
    trace = list(state.get("trace", []))
    trace.append(message)
    return trace


def _route_task(state: GrowMateGraphState):
    return state["task"]


def _route_performance_mode(state: GrowMateGraphState):
    mode = state.get("mode", "mock")
    if mode == "manual" and state.get("manual_metrics"):
        return "manual"
    if mode == "real_api" and state.get("video_id"):
        return "real_api"
    return "mock"


def _score_persona_node(state: GrowMateGraphState) -> GrowMateGraphState:
    profile = score_persona(
        state["answers"],
        state["desired_content"],
        state["target_duration"],
        state.get("growth_goal", "提升账号的稳定涨粉效率"),
    )
    return {
        "profile": profile,
        "trace": _append_trace(state, "已完成人格识别并生成基础创作画像。"),
    }


def _positioning_node(state: GrowMateGraphState) -> GrowMateGraphState:
    positioning = generate_positioning(state["profile"], state["answers"])
    return {
        "positioning": positioning,
        "trace": _append_trace(state, "已结合人格画像生成账号定位与起号建议。"),
    }


def _topic_generation_node(state: GrowMateGraphState) -> GrowMateGraphState:
    result = generate_topics(
        state["profile"],
        positioning=state.get("positioning"),
        previous_rejections=state.get("previous_rejections"),
        strategy_memory=state.get("strategy_memory"),
    )
    return {
        "topics": result["topics"],
        "trace": _append_trace(state, "已完成候选选题生成与方向筛选。"),
    }


def _topic_regeneration_note_node(state: GrowMateGraphState) -> GrowMateGraphState:
    return {
        "trace": _append_trace(state, "检测到历史拒绝选题，已避开重复方向并重新计算候选题。"),
    }


def _script_generation_node(state: GrowMateGraphState) -> GrowMateGraphState:
    script = generate_script_content(state["profile"], state["selected_topic"])
    return {
        "script": script,
        "trace": _append_trace(state, "已将选题拆解为可执行脚本。"),
    }


def _operator_generation_node(state: GrowMateGraphState) -> GrowMateGraphState:
    operator = generate_operator_plan(state["profile"], state["selected_topic"])
    return {
        "operator": operator,
        "trace": _append_trace(state, "已生成发布时间、更新节奏与互动策略。"),
    }


def _manual_performance_node(state: GrowMateGraphState) -> GrowMateGraphState:
    performance = fetch_performance(
        video_id=None,
        mode="manual",
        manual_metrics=state.get("manual_metrics"),
    )
    return {
        "performance": performance,
        "performance_source_route": "manual",
        "trace": _append_trace(state, "已根据用户录入的真实内容数据生成表现分析。"),
    }


def _mock_performance_node(state: GrowMateGraphState) -> GrowMateGraphState:
    performance = fetch_performance(
        video_id=None,
        mode="mock",
        manual_metrics=None,
    )
    return {
        "performance": performance,
        "performance_source_route": "mock",
        "trace": _append_trace(state, "未提供真实数据，已生成模拟表现数据用于演示与复盘。"),
    }


def _real_api_performance_node(state: GrowMateGraphState) -> GrowMateGraphState:
    performance = fetch_performance(
        video_id=state.get("video_id"),
        mode="real_api",
        manual_metrics=None,
    )
    route = "real_api" if performance.get("source") == "real_api" else "mock_fallback"
    message = "已从视频平台接口读取真实表现数据。" if route == "real_api" else "真实接口不可用，已自动切换到模拟数据兜底。"
    return {
        "performance": performance,
        "performance_source_route": route,
        "trace": _append_trace(state, message),
    }


def _performance_fetch_node(state: GrowMateGraphState) -> GrowMateGraphState:
    mode = state.get("mode", "mock")
    if mode == "manual":
        message = "检测到用户选择手动录入数据，进入真实数据分析分支。"
    elif mode == "real_api" and state.get("video_id"):
        message = "检测到视频 ID，优先尝试视频平台接口分支。"
    else:
        message = "未提供真实数据，进入模拟数据分析分支。"
    return {
        "trace": _append_trace(state, message),
    }


def _diagnosis_node(state: GrowMateGraphState) -> GrowMateGraphState:
    result = analyze_diagnosis(
        state["profile"],
        state["selected_topic"],
        state["performance"],
        strategy_memory=state.get("strategy_memory"),
    )
    return {
        "diagnosis": result["diagnosis"],
        "strategy_memory": result["strategy"],
        "trace": _append_trace(state, "已完成复盘诊断并更新下一轮策略记忆。"),
    }


def _next_round_topic_node(state: GrowMateGraphState) -> GrowMateGraphState:
    previous_rejections = list(state.get("previous_rejections", []))
    if state.get("selected_topic") and state["selected_topic"] not in previous_rejections:
        previous_rejections.append(state["selected_topic"])
    result = generate_topics(
        state["profile"],
        positioning=state.get("positioning"),
        previous_rejections=previous_rejections,
        strategy_memory=state.get("strategy_memory"),
    )
    return {
        "previous_rejections": previous_rejections,
        "topics": result["topics"],
        "trace": _append_trace(state, "已基于复盘后的策略记忆生成下一轮候选选题。"),
    }


def _build_graph():
    graph = StateGraph(GrowMateGraphState)

    graph.add_node("profile_score", _score_persona_node)
    graph.add_node("profile_positioning", _positioning_node)
    graph.add_node("topic_regeneration_note", _topic_regeneration_note_node)
    graph.add_node("topic_generation", _topic_generation_node)
    graph.add_node("script_generation", _script_generation_node)
    graph.add_node("operator_generation", _operator_generation_node)
    graph.add_node("performance_fetch", _performance_fetch_node)
    graph.add_node("manual_performance_fetch", _manual_performance_node)
    graph.add_node("mock_performance_fetch", _mock_performance_node)
    graph.add_node("real_api_performance_fetch", _real_api_performance_node)
    graph.add_node("diagnosis_analysis", _diagnosis_node)
    graph.add_node("next_round_topic_generation", _next_round_topic_node)

    graph.add_conditional_edges(
        START,
        _route_task,
        {
            "profile_analyze": "profile_score",
            "topic_generate": "topic_generation",
            "topic_regenerate": "topic_generation",
            "script_generate": "script_generation",
            "operator_generate": "operator_generation",
            "performance_fetch": "performance_fetch",
            "diagnosis_analyze": "diagnosis_analysis",
            "next_round_topics": "next_round_topic_generation",
        },
    )

    graph.add_edge("profile_score", "profile_positioning")
    graph.add_edge("profile_positioning", END)
    graph.add_conditional_edges(
        "topic_generation",
        lambda state: "has_rejections" if state.get("previous_rejections") else "fresh_topics",
        {
            "has_rejections": "topic_regeneration_note",
            "fresh_topics": END,
        },
    )
    graph.add_edge("topic_regeneration_note", END)
    graph.add_edge("script_generation", END)
    graph.add_edge("operator_generation", END)
    graph.add_conditional_edges(
        "performance_fetch",
        _route_performance_mode,
        {
            "manual": "manual_performance_fetch",
            "real_api": "real_api_performance_fetch",
            "mock": "mock_performance_fetch",
        },
    )
    graph.add_edge("manual_performance_fetch", END)
    graph.add_edge("mock_performance_fetch", END)
    graph.add_edge("real_api_performance_fetch", END)
    graph.add_edge("diagnosis_analysis", END)
    graph.add_edge("next_round_topic_generation", END)

    return graph.compile()


growmate_graph = _build_graph()


def run_profile_analyze(answers: List[str], desired_content: str, target_duration: int, growth_goal: str = "提升账号的稳定涨粉效率"):
    return growmate_graph.invoke(
        {
            "task": "profile_analyze",
            "answers": answers,
            "desired_content": desired_content,
            "target_duration": target_duration,
            "growth_goal": growth_goal,
            "trace": [],
        }
    )


def run_topic_generate(
    profile: Dict[str, Any],
    positioning: Optional[Dict[str, Any]] = None,
    previous_rejections: Optional[List[Dict[str, Any]]] = None,
    strategy_memory: Optional[Dict[str, Any]] = None,
):
    return growmate_graph.invoke(
        {
            "task": "topic_generate",
            "profile": profile,
            "positioning": positioning or {},
            "previous_rejections": previous_rejections or [],
            "strategy_memory": strategy_memory or {},
            "trace": [],
        }
    )


def run_next_round_topics(
    profile: Dict[str, Any],
    positioning: Optional[Dict[str, Any]] = None,
    previous_rejections: Optional[List[Dict[str, Any]]] = None,
    strategy_memory: Optional[Dict[str, Any]] = None,
    selected_topic: Optional[Dict[str, Any]] = None,
):
    return growmate_graph.invoke(
        {
            "task": "next_round_topics",
            "profile": profile,
            "positioning": positioning or {},
            "previous_rejections": previous_rejections or [],
            "strategy_memory": strategy_memory or {},
            "selected_topic": selected_topic or {},
            "trace": [],
        }
    )


def run_script_generate(profile: Dict[str, Any], selected_topic: Dict[str, Any]):
    return growmate_graph.invoke(
        {
            "task": "script_generate",
            "profile": profile,
            "selected_topic": selected_topic,
            "trace": [],
        }
    )


def run_operator_generate(profile: Dict[str, Any], selected_topic: Dict[str, Any]):
    return growmate_graph.invoke(
        {
            "task": "operator_generate",
            "profile": profile,
            "selected_topic": selected_topic,
            "trace": [],
        }
    )


def run_performance_fetch(
    video_id: Optional[str] = None,
    mode: str = "mock",
    manual_metrics: Optional[Dict[str, Any]] = None,
):
    return growmate_graph.invoke(
        {
            "task": "performance_fetch",
            "video_id": video_id,
            "mode": mode,
            "manual_metrics": manual_metrics,
            "trace": [],
        }
    )


def run_diagnosis_analyze(
    profile: Dict[str, Any],
    selected_topic: Dict[str, Any],
    performance: Dict[str, Any],
    strategy_memory: Optional[Dict[str, Any]] = None,
):
    return growmate_graph.invoke(
        {
            "task": "diagnosis_analyze",
            "profile": profile,
            "selected_topic": selected_topic,
            "performance": performance,
            "strategy_memory": strategy_memory or {},
            "trace": [],
        }
    )
