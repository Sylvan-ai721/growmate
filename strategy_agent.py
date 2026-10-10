def decide_strategy(persona):

    if "情绪" in persona:
        return {"type":"emotion","focus":"共鸣+冲突"}
    if "知识" in persona:
        return {"type":"knowledge","focus":"干货"}
    return {"type":"growth","focus":"爆款"}