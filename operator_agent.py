from datetime import datetime, timedelta

from llm_utils import invoke_json


def generate_operator(persona, topic):
    today = datetime.now()
    candidate_dates = [(today + timedelta(days=offset)).strftime("%Y-%m-%d") for offset in (1, 3, 5)]
    prompt = f"""
You are a short-video operations expert.

User profile:
{persona}

Selected topic:
{topic}

Generate publishing and interaction strategy for a normal KOC in the account growth stage.
Write the final content in Chinese.
Align actions with the user's growth_goal. Without audience activity data, describe publishing times as experimental suggestions, not proven optimal times or knowledge of platform algorithms.
Today is {today.strftime("%Y-%m-%d")}.
All suggested publishing dates must be on or after today, and preferably within the next 7 days.
You can use these candidate dates if helpful: {", ".join(candidate_dates)}.
Do not output any past date.

Only output JSON:
{{
  "publish_time": "",
  "schedule": ["", "", ""],
  "comment_hooks": ["", "", ""],
  "interaction_tips": ["", "", ""]
}}
"""

    return invoke_json(prompt)
