class DataHub:
    def __init__(self):
        self.memory = {
            "persona": None,
            "positioning": None,
            "history": [],
            "performance_log": [],
            "strategy_memory": {},
            "topic_rejections": [],
            "selected_topic": None,
        }

    def set_persona(self, persona):
        self.memory["persona"] = persona

    def set_positioning(self, positioning):
        self.memory["positioning"] = positioning

    def add_content(self, content):
        self.memory["history"].append(content)

    def add_performance(self, perf):
        self.memory["performance_log"].append(perf)

    def update_strategy(self, strategy):
        self.memory["strategy_memory"] = strategy

    def add_topic_rejections(self, topics):
        self.memory["topic_rejections"].extend(topics)

    def set_selected_topic(self, topic):
        self.memory["selected_topic"] = topic

    def get_context(self):
        return self.memory
