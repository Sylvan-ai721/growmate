from llm_utils import invoke_json


def diagnose(perf, persona, topic):
    prompt = f"""
You are a short-video growth review expert.

User profile:
{persona}

Current topic:
{topic}

Performance data:
{perf}

Generate a structured review result.
Requirements:
1. Calculate interaction and follow conversion only from supplied metrics. State the denominator.
2. Without retention, watch time, script, publishing time or historical benchmarks, do not claim low completion, poor hooks, bad timing, or algorithm suppression as facts. Label suspected causes as hypotheses and suggest a test.
3. When source is mock, explicitly say this is a simulation, not evidence about actual performance. Avoid claims of proven growth.
4. Respect the user's growth_goal. Provide one specific change to test next, the metric to observe, and the same observation window for comparison. Do not invent benchmarks or data.
2. Keep the suggestions practical for the next round.
3. Write the final content in Chinese.

Only output JSON:
{{
  "problem": "",
  "evidence": ["Data-derived observations with calculations"],
  "limitations": ["Missing data and limits of inference"],
  "next_focus": "One next experiment and how to evaluate it",
  "avoid": ["Specific pitfalls supported by this review"],
  "strengths": ["", ""],
  "suggestions": ["", "", ""],
  "next_topics": ["", "", ""]
}}
"""

    return invoke_json(prompt)
