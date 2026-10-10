from workflow_service import (
    analyze_diagnosis,
    fetch_performance,
    generate_operator_plan,
    generate_script_content,
    generate_topics,
)


def _select_topic(topic_pack):
    while True:
        print("\n===== 为你生成的 3 个选题 =====")
        for idx, item in enumerate(topic_pack["topics"], start=1):
            print(
                f"{idx}. {item['title']}\n"
                f"   钩子: {item['hook']}\n"
                f"   角度: {item['angle']}\n"
                f"   热度/匹配度/涨粉潜力: {item['heat']}/{item['fit']}/{item['growth_potential']}\n"
                f"   推荐理由: {item['reason']}"
            )

        choice = input("\n输入 1/2/3 选择选题，或输入 R 重新生成 3 个新选题：").strip().upper()
        if choice in {"1", "2", "3"}:
            return topic_pack["topics"][int(choice) - 1], False
        if choice == "R":
            return None, True
        print("输入无效，请重新输入。")


def run(persona):
    previous_rejections = []
    strategy_memory = {}

    while True:
        topic_pack = generate_topics(
            persona,
            previous_rejections=previous_rejections,
            strategy_memory=strategy_memory,
        )
        selected_topic, should_regenerate = _select_topic(topic_pack)
        if should_regenerate:
            previous_rejections.extend(topic_pack["topics"])
            continue
        break

    script = generate_script_content(persona, selected_topic)
    operator = generate_operator_plan(persona, selected_topic)

    video_id = input("\n如果你有视频平台的视频 ID，可输入用于拉取真实表现数据；直接回车则使用模拟数据：\n> ").strip()
    perf = fetch_performance(video_id or None)

    diagnosis_result = analyze_diagnosis(persona, selected_topic, perf, strategy_memory=strategy_memory)

    return {
        "profile": persona,
        "topic_candidates": topic_pack,
        "selected_topic": selected_topic,
        "content": script,
        "operator": operator,
        "performance": perf,
        "diagnosis": diagnosis_result["diagnosis"],
        "strategy": diagnosis_result["strategy"],
    }
