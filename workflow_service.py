from typing import Any, Dict, List

from data_hub import DataHub
from diagnosis_agent import diagnose
from llm_utils import ensure_diagnosis, ensure_operator, ensure_script, ensure_topics
from operator_agent import generate_operator
from performance_agent import evaluate
from profile_agent import analyze_profile
from script_agent import generate_script
from strategy_memory import update_strategy_memory
from schemas import PerformanceResponse
from topic_agent import generate_topic


QUESTION_BANK = [
    "What content do you prefer to publish?",
    "What is your main motivation for creating content?",
    "What video style do you prefer?",
    "What are you like in front of the camera?",
    "What do you care about most?",
    "What kind of content are you best at?",
    "What is your posting rhythm like?",
    "What kind of creator do you want to become?",
    "When a trend appears, what do you usually do?",
    "What kind of comment makes you most excited?",
    "How do you usually prepare before shooting?",
    "When a video performs poorly, what is your first reaction?",
    "Which creator role sounds most like you?",
    "What kind of opening do you prefer?",
    "How do you want followers to remember you?",
    "What is your biggest advantage as a KOC?",
]

ANSWER_MAPPING = ["life", "emotion", "knowledge", "growth"]
ANSWER_OPTIONS = [
    ["日常生活记录", "情绪表达/吐槽", "知识干货", "挑战/成长类内容"],
    ["记录生活", "表达情绪", "展示能力", "涨粉变现"],
    ["真实日常", "情绪共鸣", "结构清晰讲解", "强节奏挑战"],
    ["自然分享者", "情绪表达者", "讲解型博主", "表现型博主"],
    ["真实感", "共鸣感", "专业感", "爆款流量"],
    ["生活记录短视频", "情绪故事", "干货总结", "挑战视频"],
    ["随缘记录", "情绪驱动", "规律输出", "追热点/冲爆款"],
    ["生活博主", "情绪博主", "知识博主", "成长型博主"],
    ["想想怎么自然带入生活", "先看评论区情绪", "拆解它为什么火", "立刻改成自己的挑战"],
    ["你拍得好真实", "这就是我的心声", "学到了，讲得很清楚", "被你带动想行动了"],
    ["随手记录现场感", "先找到情绪点", "列出清晰结构", "设计强节奏过程"],
    ["是不是不够真实", "是不是没击中情绪", "是不是信息不够清楚", "是不是开头不够抓人"],
    ["生活观察员", "互联网嘴替", "人间说明书", "行动派队长"],
    ["今天发生一件小事", "有没有人和我一样", "三步讲清楚这件事", "我决定挑战一个目标"],
    ["真实、不装", "懂我、会说", "靠谱、有用", "自律、有冲劲"],
    ["生活细节敏感", "情绪表达直接", "总结能力强", "行动执行力强"],
]
PERSONA_MAP = {
    "life": "生活共感型 KOC",
    "emotion": "情绪雷达型 KOC",
    "knowledge": "知识导航型 KOC",
    "growth": "成长燃料型 KOC",
}
PERSONA_EXPLANATIONS = {
    "life": "你的内容气质像朋友圈里最会讲生活的人：不端着、不说教，但很容易让人觉得“这不就是我吗”。适合用真实日常、轻观察和生活切片建立亲近感。",
    "emotion": "你像一台高灵敏度情绪雷达，总能捕捉到别人没说出口的小崩溃和小开心。适合做共鸣型开头、故事化表达和评论区情绪互动。",
    "knowledge": "你是那种会把混乱信息整理成清楚路径的人，观众关注你是为了少走弯路。适合做结构化干货、清单、避坑和方法论内容。",
    "growth": "你自带一种“今天也要变好一点”的推进感，适合把挑战、复盘和改变过程拍出来。观众会因为你的行动感而被带着一起往前走。",
}
PERSONA_TRAITS = {
    "life": ["真实感强", "低距离感", "适合日常连续更新"],
    "emotion": ["共鸣敏锐", "表达有记忆点", "评论区互动潜力高"],
    "knowledge": ["结构清晰", "信任感强", "适合系列化内容"],
    "growth": ["行动感强", "转粉潜力高", "适合挑战和复盘"],
}


def score_persona(answers: List[str], desired_content: str, target_duration: int, growth_goal: str = "提升账号的稳定涨粉效率"):
    score = {key: 0 for key in ANSWER_MAPPING}

    for answer in answers:
        normalized = answer.strip().upper()
        if normalized in {"A", "B", "C", "D"}:
            score[ANSWER_MAPPING[ord(normalized) - 65]] += 1

    persona_key = max(score, key=score.get)
    tied = [key for key, value in score.items() if value == score[persona_key]]
    mixed = len(tied) > 1
    return {
        "type": "mixed" if mixed else persona_key,
        "label": "复合偏好型 KOC" if mixed else PERSONA_MAP[persona_key],
        "explanation": ("你的创作偏好同时涉及：" + "、".join(PERSONA_MAP[key] for key in tied) + "。分类仅作创作参考，后续结合具体回答与内容方向生成建议。") if mixed else PERSONA_EXPLANATIONS[persona_key],
        "traits": ["多元表达偏好", "结合具体内容选择风格", "通过真实创作验证方向"] if mixed else PERSONA_TRAITS[persona_key],
        "desired_content": desired_content,
        "target_duration": target_duration,
        "growth_goal": growth_goal,
    }


def build_answers_payload(answers: List[str]):
    return [
        {
            "question": QUESTION_BANK[idx],
            "answer": answer,
            "answer_text": ANSWER_OPTIONS[idx][ord(answer.strip().upper()) - 65],
        }
        for idx, answer in enumerate(answers[: len(QUESTION_BANK)])
    ]


def generate_positioning(profile: Dict[str, Any], answers: List[str]):
    return analyze_profile(profile, build_answers_payload(answers))


def generate_topics(profile: Dict[str, Any], positioning=None, previous_rejections=None, strategy_memory=None):
    hub = DataHub()
    hub.set_persona(profile)
    if strategy_memory:
        hub.update_strategy(strategy_memory)
    if previous_rejections:
        hub.add_topic_rejections(previous_rejections)
    if positioning:
        hub.set_positioning(positioning)

    payload = generate_topic(profile, hub.get_context(), previous_rejections=previous_rejections)
    return ensure_topics(payload)


def generate_script_content(profile: Dict[str, Any], selected_topic: Dict[str, Any]):
    payload = generate_script(profile, selected_topic, profile["target_duration"])
    return ensure_script(payload, profile["target_duration"])


def generate_operator_plan(profile: Dict[str, Any], selected_topic: Dict[str, Any]):
    payload = generate_operator(profile, selected_topic)
    return ensure_operator(payload)


def fetch_performance(video_id=None, mode="mock", manual_metrics=None):
    return evaluate(video_id=video_id, mode=mode, manual_metrics=manual_metrics)


def analyze_diagnosis(
    profile: Dict[str, Any],
    selected_topic: Dict[str, Any],
    performance: Dict[str, Any],
    strategy_memory=None,
):
    performance = PerformanceResponse.model_validate(performance).model_dump()
    views = performance["views"]
    performance["engagement_rate"] = round((performance["likes"] + performance["comments"] + performance["shares"]) / max(views, 1), 4)
    diagnosis_payload = diagnose(performance, profile, selected_topic)
    diagnosis = ensure_diagnosis(diagnosis_payload)
    diagnosis["evidence"] = [
        f"播放量 {views}；互动数（点赞+评论+转发）{performance['likes'] + performance['comments'] + performance['shares']}。",
        f"互动率 {performance['engagement_rate'] * 100:.2f}%；关注转化率 {performance['follows'] / max(views, 1) * 100:.2f}%，均以播放量为分母。",
    ]
    diagnosis["limitations"] = [
        "未提供完播率、观看时长、实际发布时间和历史对照，无法确定表现变化的具体原因。",
        "建议在相同统计窗口下对比下一轮数据，每次优先验证一个改动。",
    ]
    if not views:
        diagnosis["evidence"] = ["播放量为 0，无法计算有效互动率和关注转化率。"]
    if performance["source"] == "mock":
        diagnosis["limitations"].insert(0, "本次使用模拟数据，仅演示复盘方法，不代表真实账号效果。")
    strategy = update_strategy_memory(strategy_memory or {}, diagnosis, performance, profile.get("growth_goal", ""))
    return {"diagnosis": diagnosis, "strategy": strategy}
