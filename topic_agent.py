from llm_utils import invoke_json


def generate_topic(persona, context, previous_rejections=None):
    previous_rejections = previous_rejections or []

    prompt = f"""
You are a social media growth planner for normal KOCs.

User profile:
{persona}

Context:
{context}

Desired content direction:
{persona.get("desired_content", "")}

Rejected topic directions:
{previous_rejections}

Generate 3 fresh short-video topic ideas.
Requirements:
1. Match the user persona and desired content.
2. The 3 topics must be clearly different from one another.
3. Suitable for low-cost execution by a normal KOC.
4. Avoid previously rejected directions.
5. Write the final content in Chinese.
6. Prioritize the user's growth_goal and explain how each topic serves it. Scores are heuristic AI estimates, not real trend data or predicted results. Use 0-100 integers and explain the basis; do not claim live platform trends.

Only output JSON:
{{
  "topics": [
    {{
      "title": "",
      "hook": "",
      "angle": "",
      "heat": 0,
      "fit": 0,
      "growth_potential": 0,
      "reason": ""
    }}
  ]
}}
"""

    return invoke_json(prompt)
