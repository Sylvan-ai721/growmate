def update_strategy_memory(old_strategy, diagnosis, performance=None, growth_goal=""):
    old_strategy = old_strategy or {}
    performance = performance or {}
    suggestions = diagnosis.get("suggestions", [])
    history = list(old_strategy.get("history", []))
    history.append({
        "source": performance.get("source", "unknown"),
        "growth_goal": growth_goal,
        "problem": diagnosis.get("problem", ""),
        "metrics": {key: performance[key] for key in ("views", "likes", "comments", "shares", "follows", "engagement_rate") if key in performance},
        "suggestions": suggestions,
    })

    return {
        "content_direction": diagnosis.get("next_topics", []),
        "hook_strategy": next((item for item in suggestions if any(word in item for word in ("开头", "钩子", "前3秒", "前三秒"))), old_strategy.get("hook_strategy", "下一轮对比两种开场，观察相同统计窗口下的互动与关注变化。")),
        "avoid": list(dict.fromkeys(old_strategy.get("avoid", []) + diagnosis.get("avoid", [])))[-10:],
        "next_focus": diagnosis.get("next_focus") or (suggestions[0] if suggestions else "保持统计口径一致，验证下一轮改动。"),
        "history": history[-10:],
    }
