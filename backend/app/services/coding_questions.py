"""
LLM-based coding problem generation and Aira follow-up questions.

Two public functions:
  generate_coding_problem() → CodingProblemData
  generate_followup_question() → str
"""

import json
import logging
from dataclasses import dataclass, field

from app.services.groq_client import generate_chat_completion

logger = logging.getLogger(__name__)


@dataclass
class CodingProblemData:
    title: str
    difficulty: str
    description: str
    examples: list[dict] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    test_cases: list[dict] = field(default_factory=list)
    starter_code: dict[str, str] = field(default_factory=dict)
    solution_hint: str = ""


def _build_problem_prompt(role: str, difficulty: str, index: int) -> str:
    diff_guide = {
        "easy":   "Array/string manipulation, basic loops, O(n) solutions, solvable in 10–15 min",
        "medium": "Hash maps, two pointers, sliding window, binary search, solvable in 20–25 min",
        "hard":   "Dynamic programming, graphs, advanced data structures, solvable in 30–40 min",
    }
    return (
        f"You are an expert technical interviewer creating problem #{index+1} for a "
        f"'{role}' candidate at '{difficulty}' difficulty.\n\n"
        f"Difficulty guide: {diff_guide.get(difficulty, diff_guide['medium'])}\n\n"
        f"RULES:\n"
        f"- The solution reads from stdin and prints to stdout (competitive programming style)\n"
        f"- Create EXACTLY 4 test cases: first 2 marked is_sample=true (visible), last 2 is_sample=false (hidden)\n"
        f"- Each test case input/output must be a raw string matching stdin/stdout format\n"
        f"- Provide complete, runnable starter code for all 4 languages that correctly reads the input format\n"
        f"- Java starter code MUST use 'class Main' (Piston requires this)\n"
        f"- Do NOT include solution logic in starter code — only input reading boilerplate + TODO comment\n\n"
        f"Respond with ONLY valid JSON (no markdown fences, no extra text):\n"
        f"{{\n"
        f'  "title": "Problem Title",\n'
        f'  "difficulty": "{difficulty}",\n'
        f'  "description": "Full problem statement with clear input/output format description",\n'
        f'  "examples": [\n'
        f'    {{"input": "raw stdin string", "output": "raw stdout string", "explanation": "brief"}}\n'
        f'  ],\n'
        f'  "constraints": ["1 <= n <= 10^5", "other constraints"],\n'
        f'  "test_cases": [\n'
        f'    {{"input": "raw stdin", "expected_output": "raw stdout", "is_sample": true}},\n'
        f'    {{"input": "raw stdin", "expected_output": "raw stdout", "is_sample": true}},\n'
        f'    {{"input": "raw stdin", "expected_output": "raw stdout", "is_sample": false}},\n'
        f'    {{"input": "raw stdin", "expected_output": "raw stdout", "is_sample": false}}\n'
        f'  ],\n'
        f'  "starter_code": {{\n'
        f'    "python": "import sys\\n\\ndef solve():\\n    data = sys.stdin.read().split()\\n    # TODO: parse input and solve\\n    pass\\n\\nsolve()",\n'
        f'    "javascript": "const lines = require(\'fs\').readFileSync(\'/dev/stdin\',\'utf8\').trim().split(\'\\\\n\');\\n// TODO: parse and solve\\n",\n'
        f'    "java": "import java.util.*;\\npublic class Main {{\\n    public static void main(String[] args) {{\\n        Scanner sc = new Scanner(System.in);\\n        // TODO: parse and solve\\n    }}\\n}}",\n'
        f'    "cpp": "#include <bits/stdc++.h>\\nusing namespace std;\\nint main() {{\\n    ios_base::sync_with_stdio(false);\\n    cin.tie(NULL);\\n    // TODO: parse and solve\\n    return 0;\\n}}"\n'
        f'  }},\n'
        f'  "solution_hint": "Brief approach hint (e.g.: Use a hash map to achieve O(n) time)"\n'
        f"}}"
    )


def _parse_problem_json(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").removeprefix("json").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object in response")
    return json.loads(cleaned[start:end + 1])


async def generate_coding_problem(role: str, difficulty: str, index: int = 0) -> CodingProblemData:
    """Generate one coding problem via Groq LLM. Raises on failure."""
    prompt = _build_problem_prompt(role, difficulty, index)
    raw = await generate_chat_completion(prompt)
    data = _parse_problem_json(raw)

    required = {"title", "description", "test_cases", "starter_code"}
    missing = required - data.keys()
    if missing:
        raise ValueError(f"Generated problem missing fields: {missing}")

    test_cases = data.get("test_cases", [])
    if len(test_cases) < 2:
        raise ValueError("Problem must have at least 2 test cases")

    for i, tc in enumerate(test_cases):
        if "is_sample" not in tc:
            tc["is_sample"] = i < 2

    return CodingProblemData(
        title=str(data.get("title", "Untitled Problem")),
        difficulty=str(data.get("difficulty", difficulty)),
        description=str(data.get("description", "")),
        examples=data.get("examples", []),
        constraints=data.get("constraints", []),
        test_cases=test_cases,
        starter_code=data.get("starter_code", {}),
        solution_hint=str(data.get("solution_hint", "")),
    )


async def generate_followup_question(
    problem_title: str,
    problem_description: str,
    code: str,
    language: str,
    role: str,
    test_cases_passed: int,
    test_cases_total: int,
    followup_index: int = 0,
) -> str:
    """Generate a contextual Aira follow-up question after the candidate submits code."""
    pass_rate = f"{test_cases_passed}/{test_cases_total}"
    followup_types = [
        "time and space complexity of their specific implementation",
        "why they chose this approach over alternatives, and any trade-offs",
        "how they would handle the problem at 100x scale (larger inputs / distributed system)",
        "an edge case they may not have considered",
        "how they would optimize the code further if needed",
    ]
    focus = followup_types[followup_index % len(followup_types)]

    prompt = (
        f"You are Aira, an AI interview coach conducting a coding interview for a '{role}' role.\n\n"
        f"Problem: {problem_title}\n"
        f"Description (brief): {problem_description[:300]}...\n\n"
        f"Candidate's {language} solution:\n```{language}\n{code[:1500]}\n```\n\n"
        f"Test result: {pass_rate} test cases passed.\n\n"
        f"Ask ONE specific follow-up question focused on: {focus}.\n"
        f"Rules:\n"
        f"- Reference specific parts of their actual code (variable names, logic they wrote)\n"
        f"- Be conversational and direct, like a real interviewer\n"
        f"- Keep it to 1-2 sentences maximum\n"
        f"- Do NOT reveal the answer in your question\n\n"
        f"Respond with ONLY the question text, nothing else."
    )

    raw = await generate_chat_completion(prompt)
    question = raw.strip().strip('"').strip("'")
    if not question:
        raise ValueError("Empty follow-up question from LLM")
    return question