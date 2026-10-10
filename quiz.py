from workflow_service import score_persona


QUESTIONS = [
    {
        "q": "What content do you prefer to publish?",
        "options": ["Daily life records", "Emotion or rant content", "Knowledge content", "Challenge or growth content"],
    },
    {
        "q": "What is your main motivation for creating content?",
        "options": ["Record life", "Express emotion", "Show ability", "Gain followers and monetize"],
    },
    {
        "q": "What video style do you prefer?",
        "options": ["Authentic daily life", "Emotional resonance", "Structured explanation", "Fast-paced challenge"],
    },
    {
        "q": "What are you like in front of the camera?",
        "options": ["Natural sharer", "Emotion expresser", "Explainer", "Performer"],
    },
    {
        "q": "What do you care about most?",
        "options": ["Authenticity", "Resonance", "Professionalism", "Viral traffic"],
    },
    {
        "q": "What kind of content are you best at?",
        "options": ["Lifestyle vlog", "Emotion story", "Knowledge summary", "Challenge video"],
    },
    {
        "q": "What is your posting rhythm like?",
        "options": ["Post casually", "Emotion-driven", "Consistent output", "Chase hot trends"],
    },
    {
        "q": "What kind of creator do you want to become?",
        "options": ["Lifestyle creator", "Emotion creator", "Knowledge creator", "Growth creator"],
    },
]


def run_quiz():
    print("\n===== KOC Personality Quiz =====")

    answers = []

    for i, item in enumerate(QUESTIONS):
        print(f"\nQ{i + 1}: {item['q']}")
        for idx, opt in enumerate(item["options"]):
            print(f"{chr(65 + idx)}. {opt}")

        while True:
            answer = input("Choose A/B/C/D: ").strip().upper()
            if answer in {"A", "B", "C", "D"}:
                answers.append(answer)
                break
            print("Invalid input. Please try again.")

    desired_content = input(
        "\nWhat content do you want to create recently? You can describe the niche, topic, audience, or expression style.\n> "
    ).strip()
    if not desired_content:
        desired_content = "Find a suitable content direction and grow followers steadily."

    while True:
        duration_input = input("\nWhat is the target video duration in seconds? Example: 30 / 60 / 90\n> ").strip()
        if duration_input.isdigit() and int(duration_input) > 0:
            target_duration = int(duration_input)
            break
        print("Please enter an integer greater than 0.")

    persona = score_persona(answers, desired_content, target_duration)

    print("\n===== Quiz Result =====")
    print(persona["label"])
    return persona
