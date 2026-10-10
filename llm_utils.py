import json
import re
from datetime import datetime, timedelta
from typing import Any, Dict

from langchain_openai import ChatOpenAI

from config import API_KEY, BASE_URL, MODEL


def get_llm():
    if not API_KEY:
        raise ValueError("未配置 DEEPSEEK_API_KEY，请在后端 .env 中填写有效密钥。")
    return ChatOpenAI(api_key=API_KEY, base_url=BASE_URL, model=MODEL,
                      timeout=90, max_retries=1, max_tokens=8192)


def extract_json(text: str):
    stripped = text.strip()

    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)

    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    match = re.search(r"(\{.*\}|\[.*\])", stripped, re.S)
    if match:
        return json.loads(match.group(1))

    raise ValueError(f"No valid JSON found in model output: {text}")


def invoke_json(prompt: str):
    model = get_llm()
    for attempt in range(2):
        content = model.invoke(prompt).content
        try:
            payload = extract_json(content)
            if not isinstance(payload, dict):
                raise ValueError("Expected a JSON object")
            return payload
        except (ValueError, TypeError):
            if attempt:
                raise ValueError("模型返回格式不完整，请重试生成。") from None
            prompt += "\nPrevious response was invalid. Return one complete JSON object without Markdown."


def ensure_list(value: Any, size: int, default_factory):
    result = value if isinstance(value, list) else []
    while len(result) < size:
        result.append(default_factory(len(result)))
    return result[:size]


def ensure_topic_item(item: Dict[str, Any], index: int):
    return {
        "title": str(item.get("title") or f"选题方向 {index + 1}"),
        "hook": str(item.get("hook") or "用一个反差开场，快速抓住注意力。"),
        "angle": str(item.get("angle") or "从普通 KOC 的真实经历切入，降低用户理解门槛。"),
        "heat": max(0, min(100, int(item.get("heat", 70)))),
        "fit": max(0, min(100, int(item.get("fit", 75)))),
        "growth_potential": max(0, min(100, int(item.get("growth_potential", 78)))),
        "reason": str(item.get("reason") or "兼顾用户表达意愿、平台偏好和起号可执行性。"),
    }


def ensure_topics(payload: Dict[str, Any]):
    topics = ensure_list(payload.get("topics"), 3, lambda idx: {})
    return {"topics": [ensure_topic_item(item or {}, idx) for idx, item in enumerate(topics)]}


def _distribute_duration(total_seconds: int, segment_count: int):
    if segment_count <= 0:
        return []

    base = total_seconds // segment_count
    remainder = total_seconds % segment_count
    values = [base] * segment_count
    for idx in range(remainder):
        values[idx] += 1
    return values


def build_script_timeline_plan(duration_seconds: int):
    total = max(int(duration_seconds or 0), 1)
    hook_seconds = 3 if total > 3 else total
    remaining = max(total - hook_seconds, 0)

    if total <= 30:
        labels = ["背景铺垫", "核心展开", "案例补充", "结尾转化"]
    elif total <= 60:
        labels = ["背景铺垫", "痛点抛出", "核心观点", "案例补充", "结尾转化"]
    elif total <= 180:
        labels = ["背景铺垫", "痛点拆解", "方法一", "方法二", "案例补充", "结尾转化"]
    elif total <= 900:
        labels = ["背景铺垫", "问题拆解", "第一部分", "第二部分", "第三部分", "总结强化", "结尾转化"]
    else:
        labels = ["背景铺垫", "问题拆解", "第一部分", "第二部分", "第三部分", "第四部分", "总结强化", "结尾转化"]

    tail_values = _distribute_duration(remaining, len(labels))
    segments = [("强钩子", hook_seconds)]
    segments.extend((label, seconds) for label, seconds in zip(labels, tail_values))

    cursor = 0
    plan = []
    for label, seconds in segments:
        if seconds <= 0:
            continue
        start = cursor
        end = cursor + seconds
        plan.append(
            {
                "stage": label,
                "duration_seconds": seconds,
                "duration_text": f"{start}-{end}秒",
            }
        )
        cursor = end
    return plan


def ensure_timeline_item(item: Dict[str, Any], index: int):
    return {
        "stage": str(item.get("stage") or f"段落 {index + 1}"),
        "duration": str(item.get("duration") or "5-10秒"),
        "visual": str(item.get("visual") or "真人出镜，画面尽量简洁真实。"),
        "voiceover": str(item.get("voiceover") or "围绕主题直接表达，避免空话。"),
        "action_tip": str(item.get("action_tip") or "语速自然，重点句适当加重。"),
    }


def ensure_script(payload: Dict[str, Any], duration_seconds: int):
    plan = build_script_timeline_plan(duration_seconds)
    timeline = payload.get("timeline", [])
    if not isinstance(timeline, list) or len(timeline) != len(plan):
        raise ValueError("脚本段落不完整，请重新生成。")
    normalized_timeline = []
    for idx, plan_item in enumerate(plan):
        raw = timeline[idx]
        if not isinstance(raw, dict) or not all(str(raw.get(key, "")).strip() for key in ("visual", "voiceover", "action_tip")):
            raise ValueError("脚本缺少完整口播或拍摄说明，请重新生成。")
        item = ensure_timeline_item(raw, idx)
        characters = count_voiceover_characters(item["voiceover"])
        seconds = plan_item["duration_seconds"]
        if characters < max(4, int(seconds * 3)) or characters > max(16, int(seconds * 4)):
            raise ValueError(f"第 {idx + 1} 段口播长度与目标时长不匹配，请重新生成。")
        item["stage"] = plan_item["stage"]
        item["duration"] = plan_item["duration_text"]
        normalized_timeline.append(item)
    return {
        "title": str(payload.get("title") or "待完善标题"),
        "target_duration": int(duration_seconds),
        "hook": str(payload.get("hook") or "先用一句反差问题抓住观众。"),
        "summary": str(payload.get("summary") or "围绕选题输出一条结构清晰、可直接执行的脚本。"),
        "cover_text": str(payload.get("cover_text") or "封面文案待补充"),
        "comment_cta": str(payload.get("comment_cta") or "你最想先尝试哪一步，评论区告诉我。"),
        "timeline": normalized_timeline,
        "voiceover_characters": sum(count_voiceover_characters(item["voiceover"]) for item in normalized_timeline),
        "estimated_voiceover_seconds": round(sum(count_voiceover_characters(item["voiceover"]) for item in normalized_timeline) / 3.5, 1),
        "timing_note": "按每秒约 3.5 个口播字估算；实际时长受语速、停顿和画面留白影响。",
    }


def count_voiceover_characters(text: str):
    return len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", text))


def _normalize_future_text(value: Any, fallback_text: str, fallback_offset: int):
    today = datetime.now().date()
    fallback_date = today + timedelta(days=fallback_offset)
    text = str(value or "").strip()

    if not text:
        return f"{fallback_date.strftime('%Y-%m-%d')} {fallback_text}"

    date_pattern = re.compile(r"(\d{4}-\d{2}-\d{2})")
    match = date_pattern.search(text)
    if not match:
        return text

    try:
        parsed_date = datetime.strptime(match.group(1), "%Y-%m-%d").date()
    except ValueError:
        return text

    if parsed_date >= today:
        return text

    return text.replace(match.group(1), fallback_date.strftime("%Y-%m-%d"), 1)


def ensure_operator(payload: Dict[str, Any]):
    today = datetime.now().date()
    schedule = ensure_list(
        payload.get("schedule"),
        3,
        lambda idx: f"{(today + timedelta(days=idx * 2 + 1)).strftime('%Y-%m-%d')} 19:30 发布",
    )

    return {
        "publish_time": _normalize_future_text(payload.get("publish_time"), "19:30", 1),
        "schedule": [
            _normalize_future_text(item, "19:30 发布", idx * 2 + 1)
            for idx, item in enumerate(schedule)
        ],
        "comment_hooks": ensure_list(
            payload.get("comment_hooks"),
            3,
            lambda idx: [
                "你现在最卡的是定位、选题还是脚本？",
                "如果是你，你会怎么拍这一条？",
                "想看我继续拆下一条选题的话告诉我。",
            ][idx],
        ),
        "interaction_tips": ensure_list(
            payload.get("interaction_tips"),
            3,
            lambda idx: [
                "发布后30分钟内优先回复高质量评论。",
                "把评论区问题反向整理成下一条内容。",
                "对高互动评论使用追问，拉长讨论链路。",
            ][idx],
        ),
    }


def ensure_diagnosis(payload: Dict[str, Any]):
    return {
        "evidence": payload.get("evidence", []) if isinstance(payload.get("evidence"), list) else [],
        "limitations": payload.get("limitations", []) if isinstance(payload.get("limitations"), list) else [],
        "avoid": payload.get("avoid", []) if isinstance(payload.get("avoid"), list) else [],
        "next_focus": str(payload.get("next_focus") or ""),
        "problem": str(payload.get("problem") or "当前内容在转粉链路上还有优化空间。"),
        "strengths": ensure_list(
            payload.get("strengths"),
            2,
            lambda idx: ["内容切口真实", "具备继续迭代的基础"][idx],
        ),
        "suggestions": ensure_list(
            payload.get("suggestions"),
            3,
            lambda idx: [
                "开头更快抛出冲突或结果。",
                "强化评论区提问，提升互动率。",
                "保持同一定位下的连续更新。",
            ][idx],
        ),
        "next_topics": ensure_list(
            payload.get("next_topics"),
            3,
            lambda idx: [
                "延展同主题下更具体的真实案例。",
                "补一条更强钩子的对比型内容。",
                "围绕评论区问题做答疑型内容。",
            ][idx],
        ),
    }


def ensure_profile(payload: Dict[str, Any], persona_label: str):
    return {
        "persona": str(payload.get("persona") or persona_label),
        "account_positioning": str(payload.get("account_positioning") or "真实分享型成长账号"),
        "content_style": str(payload.get("content_style") or "真诚、清晰、带一点结果导向。"),
        "target_audience": str(payload.get("target_audience") or "对相似经历有共鸣、希望获得实用启发的人群。"),
        "persona_tags": ensure_list(
            payload.get("persona_tags"),
            3,
            lambda idx: ["真实表达", "持续成长", "低门槛可复制"][idx],
        ),
        "expression_formats": ensure_list(
            payload.get("expression_formats"),
            3,
            lambda idx: ["口播拆解", "日常记录", "观点短视频"][idx],
        ),
        "starter_suggestions": ensure_list(
            payload.get("starter_suggestions"),
            3,
            lambda idx: [
                "先连续做7条同主题内容建立记忆点。",
                "每条内容只讲一个明确观点。",
                "优先选择低成本、可反复拍摄的场景。",
            ][idx],
        ),
    }
