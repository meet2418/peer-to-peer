import json
from typing import Any

import requests

from config import settings


SYSTEM_PROMPT = (
    "You are an assignment evaluator. Return strict JSON with keys: "
    "score (number 0-100), feedback (string), strengths (string), improvements (string)."
)


def _fallback_evaluation() -> dict[str, Any]:
    return {
        "score": 0,
        "feedback": "AI evaluation unavailable. Please review manually.",
        "strengths": "No AI strengths available.",
        "improvements": "No AI improvement notes available.",
    }


def evaluate_submission(topic: str, assignment_description: str, submission_text: str) -> dict[str, Any]:
    if not settings.groq_api_key:
        return {
            "score": 65,
            "feedback": "Groq API key is not configured. This is a placeholder score.",
            "strengths": "Submission received successfully.",
            "improvements": "Configure GROQ_API_KEY for real AI evaluation.",
        }

    payload = {
        "model": settings.groq_model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Topic: {topic}\n"
                    f"Assignment: {assignment_description}\n"
                    f"Submission:\n{submission_text}\n\n"
                    "Evaluate quality, accuracy, and completeness."
                ),
            },
        ],
        "response_format": {"type": "json_object"},
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)

        score = float(parsed.get("score", 0))
        score = max(0.0, min(100.0, score))

        return {
            "score": score,
            "feedback": str(parsed.get("feedback", "No feedback generated.")),
            "strengths": str(parsed.get("strengths", "No strengths generated.")),
            "improvements": str(parsed.get("improvements", "No improvements generated.")),
        }
    except Exception:
        return _fallback_evaluation()
