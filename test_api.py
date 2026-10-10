"""Manual provider smoke test; imports do not perform paid inference."""

from llm_utils import invoke_json


def main():
    result = invoke_json("""
你是 KOC 内容增长顾问。用户偏好知识干货，目标是提升评论互动。
请给出创作定位和第一条选题，输出 JSON，包含 persona、content_direction、
avoid、growth_strategy、first_video_idea。不要将创作偏好当成心理测评。
""")
    print(result)


if __name__ == "__main__":
    main()
