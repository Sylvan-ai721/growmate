import json
import time

from llm_utils import build_script_timeline_plan, count_voiceover_characters, invoke_json


def _duration_template_notes(duration_seconds: int):
    if duration_seconds <= 30:
        return """
Duration template: 30-second short video
- Overall style: fast, sharp, one core point only
- Expression density: every sentence should carry information, almost no filler
- Recommended structure: hook -> core point or contrast -> one quick example -> CTA
- Voiceover style: short sentences, strong rhythm, easy to remember
- Visual style: quick cuts, clear emotional or informational punch
"""

    if duration_seconds <= 60:
        return """
Duration template: 60-second short video
- Overall style: complete but still compact, suitable for one clear topic
- Expression density: concise opening, moderate middle expansion, direct ending
- Recommended structure: hook -> background or pain point -> core point -> example or support -> CTA
- Voiceover style: each stage should sound complete, not just headline phrases
- Visual style: clear transitions between stages, one main line throughout
"""

    if duration_seconds <= 180:
        return """
Duration template: 3-minute video
- Overall style: explanation-oriented, with more detail and persuasive structure
- Expression density: slower than short video, but every stage must continue pushing the argument forward
- Recommended structure: hook -> background -> problem breakdown -> 2-3 key points -> example -> summary -> CTA
- Voiceover style: fuller sentences, clearer logic, more explicit transitions between parts
- Visual style: can mix talking-head, B-roll, screenshots, and supporting examples
"""

    return """
Duration template: 10-minute long-form video
- Overall style: long-form storytelling or deep explanation, with clear chapters
- Expression density: allow fuller expansion, but each section must have a distinct purpose
- Recommended structure: hook -> context -> problem framing -> multiple sections -> case/examples -> summary -> CTA
- Voiceover style: natural long-form narration, with transitions, emphasis, recap and chapter progression
- Visual style: main camera + B-roll + examples + visual aids; avoid feeling like one repetitive monologue
- Important: long duration must feel truly expanded, not a short script artificially stretched
"""


def generate_script(persona, topic, duration_seconds):
    started = time.monotonic()
    timeline_plan = build_script_timeline_plan(duration_seconds)
    duration_template_notes = _duration_template_notes(duration_seconds)
    context = f"""You are a video director. Write complete, shootable Chinese content.
User profile: {json.dumps(persona, ensure_ascii=False)}
Selected topic: {json.dumps(topic, ensure_ascii=False)}
Target: {duration_seconds} seconds. Prioritize growth_goal.
{duration_template_notes}
No invented personal achievements or factual claims. Use illustrative scenarios explicitly.
Timeline: {json.dumps(timeline_plan, ensure_ascii=False)}
"""
    result = invoke_json(context + """
Create metadata and a distinct outline for every planned stage; keep one coherent narrative.
Return JSON: {"title":"", "hook":"", "summary":"", "cover_text":"",
"comment_cta":"", "outline":["specific content for each stage"]}.
""")
    timeline = []
    # Bound each model response so long scripts do not get truncated into short summaries.
    batches = [timeline_plan] if duration_seconds <= 180 else [[item] for item in timeline_plan]
    for batch in batches:
        budget = [dict(item, minimum_characters=max(4, int(item["duration_seconds"] * 3)),
                       maximum_characters=max(16, int(item["duration_seconds"] * 4)),
                       target_characters=max(6, round(item["duration_seconds"] * 3.5))) for item in batch]
        prompt = context + f"""
Approved outline and metadata: {json.dumps(result, ensure_ascii=False)}
Previous segment ending: {timeline[-1]['voiceover'][-180:] if timeline else 'Start with the hook'}
Write only these segments in this order: {json.dumps(budget, ensure_ascii=False)}.
Every voiceover must meet its character budget (count Chinese letters, English letters and digits,
exclude punctuation). Aim for target_characters, avoid repetition and placeholders.
Use concrete examples, transitions and complete spoken sentences; end the final segment with CTA.
For each segment visual and action_tip must explain how to shoot it at low cost.
Return JSON: {{"timeline":[{{"stage":"", "duration":"", "visual":"", "voiceover":"", "action_tip":""}}]}}.
"""
        for attempt in range(2):
            if time.monotonic() - started > 660:
                raise ValueError("脚本生成耗时过长，请尝试较短时长后重试。")
            items = invoke_json(prompt).get("timeline", [])
            valid = isinstance(items, list) and len(items) == len(batch)
            if valid:
                valid = all(isinstance(item, dict) and
                            all(isinstance(item.get(key), str) and item[key].strip() for key in ("voiceover", "visual", "action_tip")) and
                            limits["minimum_characters"] <= count_voiceover_characters(item["voiceover"]) <= limits["maximum_characters"]
                            for item, limits in zip(items, budget))
            if valid:
                timeline.extend(items)
                break
            if attempt:
                raise ValueError("脚本口播长度或段落不符合目标时长，请重试。")
            prompt += "\nPrevious response failed segment/character checks. Rewrite with complete segments and respect all character budgets."
    result["timeline"] = timeline
    result["target_duration"] = duration_seconds
    return result
