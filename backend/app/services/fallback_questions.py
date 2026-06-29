FALLBACK_QUESTIONS: dict[str, list[str]] = {
    "sde-1 backend": [
        "Walk me through how you'd design a REST API for a simple to-do list application.",
        "What's the difference between SQL and NoSQL databases, and when would you choose one over the other?",
        "Explain what happens when you type a URL into a browser and hit enter.",
        "How would you handle a slow database query in a production application?",
        "Describe a time you had to debug an issue you didn't fully understand at first. How did you approach it?",
        "What is the difference between authentication and authorization?",
        "How would you design a rate limiter for a public API?",
    ],
    "sde-1 frontend": [
        "What's the difference between state and props in a component-based framework like React?",
        "How would you optimize a web page that's loading slowly?",
        "Explain the concept of the virtual DOM and why it's useful.",
        "How do you handle accessibility (a11y) in the UIs you build?",
        "Describe how you'd structure CSS for a large, growing application.",
        "What's the difference between synchronous and asynchronous JavaScript?",
        "Tell me about a UI bug you fixed that taught you something important.",
    ],
    "full stack developer": [
        "Walk me through the full lifecycle of a request in a typical full-stack web application.",
        "How do you decide what logic belongs on the frontend versus the backend?",
        "Describe how you'd design the database schema for a simple e-commerce site.",
        "What's your approach to handling authentication across frontend and backend?",
        "Tell me about a project where you owned both the frontend and backend. What was the hardest part?",
        "How do you keep a frontend and backend in sync when an API changes?",
    ],
    "data analyst": [
        "Walk me through how you'd approach analyzing a dataset you've never seen before.",
        "What's the difference between correlation and causation, and why does it matter in analysis?",
        "Describe a time your analysis changed a decision someone was about to make.",
        "How do you decide which chart type to use for a given dataset?",
        "What would you do if you found inconsistent or missing data partway through an analysis?",
    ],
    "default": [
        "Tell me about a project you're proud of and what made it challenging.",
        "Describe a time you disagreed with a teammate about a technical decision. How was it resolved?",
        "How do you approach learning a new technology you've never used before?",
        "Walk me through how you debug a problem when you don't know where to start.",
        "What's a mistake you made early in a project, and what did you learn from it?",
        "How do you prioritize tasks when everything feels urgent?",
    ],
}


def get_fallback_questions(role: str, count: int) -> list[str]:
    bank = FALLBACK_QUESTIONS.get(role.strip().lower(), FALLBACK_QUESTIONS["default"])
    if count <= len(bank):
        return bank[:count]
    repeated = (bank * ((count // len(bank)) + 1))[:count]
    return repeated