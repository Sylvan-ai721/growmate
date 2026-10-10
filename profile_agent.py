from llm_utils import ensure_profile, invoke_json


def analyze_profile(persona, answers):
    prompt = f"""
You are a social media growth consultant helping a normal KOC define account positioning.

User persona result:
{persona}

Raw quiz answers:
{answers}

Please produce a structured account positioning result.
Requirements:
1. Combine the persona tendency with the content the user wants to create.
2. Fit short-video platforms such as WeChat Channels.
3. Keep the advice practical and easy to execute.
4. Write the final content in Chinese.
5. Use growth_goal to prioritize positioning and starter actions. Quiz labels are heuristic creative preferences, not psychological diagnoses; for mixed preferences consider all answer_text values.

Only output JSON:
{{
  "persona": "",
  "account_positioning": "",
  "content_style": "",
  "target_audience": "",
  "persona_tags": ["", "", ""],
  "expression_formats": ["", "", ""],
  "starter_suggestions": ["", "", ""]
}}
"""

    payload = invoke_json(prompt)
    return ensure_profile(payload, persona.get("label", "普通KOC"))
