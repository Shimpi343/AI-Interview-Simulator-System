import csv
import json
import re
from pathlib import Path
from typing import Any, Optional

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET_PATH = PROJECT_ROOT / "data" / "interview_feedback_training.csv"
MODEL_DIR = PROJECT_ROOT / "models"
MODEL_PATH = MODEL_DIR / "feedback_regressor.json"
METADATA_PATH = MODEL_DIR / "feedback_regressor.meta.json"

REQUIRED_COLUMNS = {
    "role",
    "question",
    "answer",
    "confidence",
    "grammar",
    "technical",
}

TECHNICAL_KEYWORDS = {
    "api",
    "architecture",
    "database",
    "cache",
    "latency",
    "performance",
    "monitoring",
    "ci/cd",
    "testing",
    "microservice",
    "security",
    "scalability",
    "incident",
    "optimization",
    "refactor",
    "query",
    "pipeline",
}
STAR_KEYWORDS = {
    "situation",
    "task",
    "action",
    "result",
    "impact",
    "improved",
    "reduced",
    "increased",
    "delivered",
    "led",
}
FILLER_WORDS = {
    "um",
    "uh",
    "like",
    "basically",
    "actually",
    "you know",
    "sort of",
    "kind of",
}

FEATURE_NAMES = [
    "word_count",
    "unique_ratio",
    "sentence_count",
    "avg_sentence_len",
    "technical_keyword_hits",
    "star_keyword_hits",
    "metric_mentions",
    "filler_hits",
    "question_overlap_ratio",
    "first_person_ratio",
    "lowercase_i_hits",
    "punctuation_end",
]


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\b\w+\b", text.lower())


def _safe_div(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def extract_features(role: str, question: str, answer: str) -> dict[str, float]:
    words = _tokenize(answer)
    question_words = set(_tokenize(question))

    word_count = len(words)
    unique_ratio = _safe_div(len(set(words)), word_count)

    sentences = [s.strip() for s in re.split(r"[.!?]+", answer) if s.strip()]
    sentence_count = max(1, len(sentences))
    avg_sentence_len = _safe_div(word_count, sentence_count)

    technical_keyword_hits = sum(1 for keyword in TECHNICAL_KEYWORDS if keyword in answer.lower())
    star_keyword_hits = sum(1 for keyword in STAR_KEYWORDS if keyword in answer.lower())

    metric_mentions = len(
        re.findall(
            r"\b\d+(?:\.\d+)?\s*(?:%|ms|s|x|k|m|million|billion)?\b",
            answer.lower(),
        )
    )

    filler_hits = 0
    lowered_answer = answer.lower()
    for filler in FILLER_WORDS:
        filler_hits += len(re.findall(rf"\b{re.escape(filler)}\b", lowered_answer))

    overlap_count = sum(1 for word in words if word in question_words)
    first_person_hits = len(re.findall(r"\b(i|my|me)\b", lowered_answer))
    lowercase_i_hits = len(re.findall(r"\bi\b", answer))
    punctuation_end = 1.0 if answer.strip().endswith((".", "!", "?")) else 0.0

    return {
        "word_count": float(word_count),
        "unique_ratio": float(unique_ratio),
        "sentence_count": float(sentence_count),
        "avg_sentence_len": float(avg_sentence_len),
        "technical_keyword_hits": float(technical_keyword_hits),
        "star_keyword_hits": float(star_keyword_hits),
        "metric_mentions": float(metric_mentions),
        "filler_hits": float(filler_hits),
        "question_overlap_ratio": float(_safe_div(overlap_count, word_count)),
        "first_person_ratio": float(_safe_div(first_person_hits, max(1, word_count))),
        "lowercase_i_hits": float(lowercase_i_hits),
        "punctuation_end": float(punctuation_end),
    }


def _build_matrix(rows: list[dict[str, str]]) -> tuple[np.ndarray, np.ndarray]:
    x_rows: list[list[float]] = []
    y_rows: list[list[float]] = []

    for row in rows:
        features = extract_features(
            row["role"].strip(),
            row["question"].strip(),
            row["answer"].strip(),
        )

        x_rows.append([features[name] for name in FEATURE_NAMES])
        y_rows.append(
            [
                float(row["confidence"]),
                float(row["grammar"]),
                float(row["technical"]),
            ]
        )

    return np.array(x_rows, dtype=np.float64), np.array(y_rows, dtype=np.float64)


def _fit_ridge_multi_output(
    x: np.ndarray,
    y: np.ndarray,
    alpha: float = 0.8,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    x_mean = x.mean(axis=0)
    x_std = x.std(axis=0)
    x_std[x_std == 0] = 1.0

    x_scaled = (x - x_mean) / x_std
    bias = np.ones((x_scaled.shape[0], 1), dtype=np.float64)
    x_aug = np.hstack([bias, x_scaled])

    # Closed-form ridge regression: W = (X^T X + aI)^-1 X^T Y
    reg = alpha * np.eye(x_aug.shape[1], dtype=np.float64)
    reg[0, 0] = 0.0  # Do not regularize bias term.

    weights = np.linalg.pinv(x_aug.T @ x_aug + reg) @ x_aug.T @ y
    return weights, x_mean, x_std


def _predict_scores_matrix(
    x: np.ndarray,
    weights: np.ndarray,
    x_mean: np.ndarray,
    x_std: np.ndarray,
) -> np.ndarray:
    x_scaled = (x - x_mean) / x_std
    bias = np.ones((x_scaled.shape[0], 1), dtype=np.float64)
    x_aug = np.hstack([bias, x_scaled])
    return x_aug @ weights


def _mae(y_true: np.ndarray, y_pred: np.ndarray, idx: int) -> float:
    return float(np.mean(np.abs(y_true[:, idx] - y_pred[:, idx])))


def train_feedback_model(dataset_path: Path | str = DEFAULT_DATASET_PATH) -> dict[str, Any]:
    dataset = Path(dataset_path)
    if not dataset.exists():
        raise FileNotFoundError(f"Dataset not found at: {dataset}")

    with dataset.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = set(reader.fieldnames or [])
        missing = REQUIRED_COLUMNS - fieldnames
        if missing:
            raise ValueError(
                f"Dataset missing required columns: {', '.join(sorted(missing))}"
            )

        rows = [row for row in reader if (row.get("answer") or "").strip()]

    if len(rows) < 8:
        raise ValueError("Need at least 8 rows to train a useful baseline model.")

    x, y = _build_matrix(rows)
    indices = np.arange(len(rows))
    rng = np.random.default_rng(seed=42)
    rng.shuffle(indices)

    split_at = max(1, int(len(indices) * 0.75))
    train_idx = indices[:split_at]
    test_idx = indices[split_at:]

    x_train = x[train_idx]
    y_train = y[train_idx]

    weights, x_mean, x_std = _fit_ridge_multi_output(x_train, y_train)

    if len(test_idx) > 0:
        x_test = x[test_idx]
        y_test = y[test_idx]
    else:
        x_test = x_train
        y_test = y_train

    predictions = _predict_scores_matrix(x_test, weights, x_mean, x_std)

    mae_confidence = _mae(y_test, predictions, 0)
    mae_grammar = _mae(y_test, predictions, 1)
    mae_technical = _mae(y_test, predictions, 2)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    model_payload = {
        "feature_names": FEATURE_NAMES,
        "weights": weights.tolist(),
        "x_mean": x_mean.tolist(),
        "x_std": x_std.tolist(),
    }
    MODEL_PATH.write_text(json.dumps(model_payload), encoding="utf-8")

    metadata = {
        "dataset_path": str(dataset),
        "rows": len(rows),
        "mae": {
            "confidence": round(mae_confidence, 3),
            "grammar": round(mae_grammar, 3),
            "technical": round(mae_technical, 3),
        },
        "features": FEATURE_NAMES,
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    return metadata


class LocalFeedbackRegressor:
    def __init__(
        self,
        feature_names: list[str],
        weights: np.ndarray,
        x_mean: np.ndarray,
        x_std: np.ndarray,
    ):
        self.feature_names = feature_names
        self.weights = weights
        self.x_mean = x_mean
        self.x_std = x_std

    def predict_scores(self, role: str, question: str, answer: str) -> dict[str, int]:
        features = extract_features(role, question, answer)
        x = np.array(
            [[features[name] for name in self.feature_names]],
            dtype=np.float64,
        )

        raw = _predict_scores_matrix(x, self.weights, self.x_mean, self.x_std)[0]

        return {
            "confidence": int(max(0, min(100, round(float(raw[0]))))),
            "grammar": int(max(0, min(100, round(float(raw[1]))))),
            "technical": int(max(0, min(100, round(float(raw[2]))))),
        }


def load_feedback_model(model_path: Path | str = MODEL_PATH) -> Optional[LocalFeedbackRegressor]:
    path = Path(model_path)
    if not path.exists():
        return None

    payload = json.loads(path.read_text(encoding="utf-8"))
    feature_names = payload.get("feature_names")
    weights = payload.get("weights")
    x_mean = payload.get("x_mean")
    x_std = payload.get("x_std")

    if not feature_names or not weights or not x_mean or not x_std:
        return None

    return LocalFeedbackRegressor(
        feature_names=list(feature_names),
        weights=np.array(weights, dtype=np.float64),
        x_mean=np.array(x_mean, dtype=np.float64),
        x_std=np.array(x_std, dtype=np.float64),
    )


def _question_pattern(question: str) -> str:
    q = question.lower()

    if any(token in q for token in ["tell me about yourself", "introduce yourself", "background", "fit for your background"]):
        return "intro"
    if any(token in q for token in ["time you", "tell me about a time", "describe a time", "behavioral", "conflict", "stakeholder", "team"]):
        return "behavioral"
    if any(token in q for token in ["design", "architecture", "scalable", "system", "trade-offs", "monitor"]):
        return "system_design"
    if any(token in q for token in ["incident", "production", "debug", "troubleshoot", "latency", "error rate", "outage"]):
        return "incident"
    if any(token in q for token in ["testing", "test strategy", "qa", "bug", "release"]):
        return "testing"
    if any(token in q for token in ["performance", "optimize", "slow", "bottleneck"]):
        return "performance"
    if any(token in q for token in ["prioritize", "deadline", "trade-off", "constraint", "scope"]):
        return "prioritization"
    return "general"


def generate_ml_feedback(role: str, question: str, answer: str, scores: dict[str, int]) -> dict[str, list[str]]:
    features = extract_features(role, question, answer)
    pattern = _question_pattern(question)

    highlights: list[str] = []
    improvements: list[str] = []

    if features["technical_keyword_hits"] >= 3:
        highlights.append("You used concrete technical terms, which improves credibility.")
    if features["metric_mentions"] >= 1:
        highlights.append("You included measurable data, which helps demonstrate impact.")
    if features["star_keyword_hits"] >= 2:
        highlights.append("Your response shows elements of STAR structure.")
    if features["word_count"] >= 70:
        highlights.append("Your answer has enough detail to show reasoning depth.")

    if scores["confidence"] < 65:
        improvements.append("Improve structure by answering in STAR format: situation, action, and measurable result.")
    if scores["grammar"] < 70:
        improvements.append("Use shorter sentences and end each sentence with punctuation for clearer delivery.")
    if scores["technical"] < 70:
        improvements.append("Add implementation details such as tools used, trade-offs, and system constraints.")
    if features["metric_mentions"] == 0:
        improvements.append("Add at least one metric (for example, latency reduction or reliability increase) to prove impact.")
    if features["filler_hits"] >= 2:
        improvements.append("Reduce filler words such as 'um' or 'like' to sound more confident.")

    if not highlights:
        highlights = [
            "You stayed on topic and made an effort to answer the interviewer directly.",
            "Your response is a good base for a STAR-style interview answer with clearer structure.",
        ]

    if not improvements:
        improvements = [
            "Lead with the outcome, then explain the action you took so the interviewer can follow your reasoning.",
            "Add one measurable result, such as latency, revenue, bug reduction, or time saved.",
        ]

    pattern_tips = {
        "intro": "For intro questions, keep it to your current role, one strong result, and why this role fits your next step.",
        "behavioral": "For behavioral questions, use STAR: situation, task, action, and result. Keep the result measurable.",
        "system_design": "For design questions, start with requirements and constraints, then explain architecture, trade-offs, and monitoring.",
        "incident": "For incident questions, say how you stabilized the issue first, then how you diagnosed it, fixed it, and prevented a repeat.",
        "testing": "For testing questions, explain what you covered first, why those cases mattered, and how quality improved.",
        "performance": "For performance questions, name the bottleneck, the metric you improved, and the change that moved the metric.",
        "prioritization": "For prioritization questions, explain the business constraint, the options you compared, and why you chose one path.",
        "general": "In a real interview, answer directly first, then add one example and one result.",
    }

    improvements.insert(0, pattern_tips.get(pattern, pattern_tips["general"]))

    return {
        "highlights": highlights[:4],
        "improvements": improvements[:4],
    }
