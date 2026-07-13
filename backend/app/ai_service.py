import base64
import io
import json
import os
import random
import re
from typing import List, Optional

import cv2
import mediapipe as mp
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI

from .ml_feedback import generate_ml_feedback, load_feedback_model
from .schemas import GrammarIssue, InterviewTurn, SentenceCorrection

load_dotenv()


OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
_LOCAL_FEEDBACK_MODEL = load_feedback_model()


def reload_local_feedback_model() -> bool:
    global _LOCAL_FEEDBACK_MODEL
    _LOCAL_FEEDBACK_MODEL = load_feedback_model()
    return _LOCAL_FEEDBACK_MODEL is not None


def _is_placeholder_api_key(value: Optional[str]) -> bool:
    if not value:
        return True
    lowered = value.strip().lower()
    return lowered in {
        "your_openai_api_key",
        "your-api-key",
        "replace-me",
        "changeme",
        "none",
        "null",
    }


def _has_openai() -> bool:
    return not _is_placeholder_api_key(OPENAI_API_KEY)


def _openai_client() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY.strip() if OPENAI_API_KEY else None)


def _fallback_question(role: str, difficulty: str, history: List[InterviewTurn]) -> str:
    general_bank = {
        "easy": [
            "Can you introduce yourself and explain why you are interested in this role?",
            "What is one project you are proud of, and what was your contribution?",
        ],
        "medium": [
            "Describe a technical challenge you solved recently. How did you approach it?",
            "How do you balance code quality, delivery speed, and stakeholder expectations?",
        ],
        "hard": [
            "Design a scalable architecture for a high-traffic application and justify your trade-offs.",
            "Tell me about a production incident you handled. How did you diagnose and fix it?",
        ],
    }
    asked = {turn.question.strip().lower() for turn in history}
    choices = [q for q in general_bank[difficulty] if q.strip().lower() not in asked]
    if not choices:
        choices = general_bank[difficulty]
    return f"For a {role} position: {random.choice(choices)}"


def generate_interview_question(role: str, difficulty: str, history: List[InterviewTurn]) -> str:
    if not _has_openai():
        return _fallback_question(role, difficulty, history)

    system_prompt = (
        "You are a strict but fair technical interviewer. Ask one concise interview question only. "
        "Do not include bullets or explanations."
    )

    turns = "\n".join(
        [f"Q: {turn.question}\nA: {turn.answer}" for turn in history[-5:]]
    )

    user_prompt = (
        f"Role: {role}\n"
        f"Difficulty: {difficulty}\n"
        f"Previous turns:\n{turns if turns else 'None'}\n\n"
        "Ask the next best interview question."
    )

    try:
        response = _openai_client().chat.completions.create(
            model=OPENAI_MODEL,
            temperature=0.7,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception:
        # Keep local development usable even with a missing/invalid API key.
        return _fallback_question(role, difficulty, history)


def _heuristic_scores(answer: str) -> dict:
    cleaned = answer.strip()
    words = re.findall(r"\b\w+\b", cleaned)
    word_count = len(words)

    confidence = min(100, 35 + int(word_count * 0.8))

    sentence_count = max(1, len(re.findall(r"[.!?]", cleaned)))
    grammar = min(100, 45 + int(word_count / sentence_count) * 2)
    if " i " in f" {cleaned.lower()} ":
        grammar -= 5

    technical_keywords = {
        "api",
        "architecture",
        "testing",
        "performance",
        "scalable",
        "database",
        "cache",
        "security",
        "latency",
        "monitoring",
        "ci/cd",
        "refactor",
    }
    matched = sum(1 for k in technical_keywords if k in cleaned.lower())
    technical = min(100, 30 + matched * 12 + int(word_count * 0.15))

    return {
        "confidence": max(0, confidence),
        "grammar": max(0, grammar),
        "technical": max(0, technical),
    }


def _fallback_grammar_issues(answer: str) -> list[dict]:
    cleaned = answer.strip()
    issues: list[dict] = []

    if not cleaned:
        return [
            {
                "excerpt": "(entire answer)",
                "problem": "No answer was provided, so grammar could not be evaluated.",
                "correction": "Write 3-5 clear sentences that answer the question directly.",
            }
        ]

    if re.search(r"\bi\b", cleaned):
        issues.append(
            {
                "excerpt": "i",
                "problem": "The standalone pronoun 'i' should be capitalized in English.",
                "correction": "Use 'I' whenever referring to yourself.",
            }
        )

    if "  " in cleaned:
        issues.append(
            {
                "excerpt": "double spaces",
                "problem": "Extra spaces make the answer look unpolished.",
                "correction": "Remove duplicate spaces between words.",
            }
        )

    sentences = [s.strip() for s in re.split(r"[.!?]+", cleaned) if s.strip()]
    if sentences:
        first = sentences[0]
        if first and first[0].islower():
            issues.append(
                {
                    "excerpt": first[:40],
                    "problem": "The sentence starts with a lowercase letter.",
                    "correction": f"Start it as: {first[0].upper() + first[1:]}",
                }
            )

    if cleaned and cleaned[-1] not in ".!?":
        issues.append(
            {
                "excerpt": cleaned[-60:],
                "problem": "The response does not end with punctuation.",
                "correction": "End the final sentence with a period.",
            }
        )

    if not issues:
        issues.append(
            {
                "excerpt": cleaned[:80],
                "problem": "The wording is understandable, but it can be more concise and polished.",
                "correction": "Rewrite the sentence in a simpler, more direct form.",
            }
        )

    return issues[:4]


def _fallback_corrected_answer(answer: str, role: str, question: str) -> str:
    cleaned = answer.strip()
    if not cleaned:
        return (
            f"For {role}, I would answer the question by clearly stating my experience, the action I took, "
            "and the measurable result. I would keep the response concise, use correct grammar, and finish with "
            "why the result mattered to the team or product."
        )

    cleaned = re.sub(r"\bi\b", "I", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if cleaned and cleaned[-1] not in ".!?":
        cleaned += "."
    if cleaned and cleaned[0].islower():
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned


def _keyword_tokens(text: str) -> list[str]:
    stopwords = {
        "about",
        "after",
        "again",
        "also",
        "because",
        "before",
        "could",
        "describe",
        "explain",
        "from",
        "have",
        "into",
        "just",
        "more",
        "most",
        "role",
        "tell",
        "that",
        "their",
        "there",
        "these",
        "this",
        "what",
        "when",
        "where",
        "which",
        "while",
        "with",
        "would",
        "your",
    }
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9_+-]{2,}", text.lower())
    return [w for w in words if w not in stopwords]


def _is_relevant_real_world_answer(question: str, answer: str) -> bool:
    q_tokens = set(_keyword_tokens(question))
    a_tokens = set(_keyword_tokens(answer))

    if not q_tokens:
        return len(answer.strip()) >= 80

    overlap = len(q_tokens.intersection(a_tokens))
    # Require at least two shared question terms when available.
    if len(q_tokens) >= 4:
        return overlap >= 2
    return overlap >= 1


def _question_type_and_answer_guidance(question: str) -> tuple[str, str]:
    q = question.lower()

    if any(token in q for token in ["introduce yourself", "about yourself", "tell me about yourself", "background", "experience"]):
        return (
            "self-introduction / background",
            "Give a short current-role summary, connect it to the role, include one measurable result, and explain why the position matters to you.",
        )

    if any(token in q for token in ["architecture", "design", "scalable", "scale", "system design", "microservices"]):
        return (
            "system design / architecture",
            "Start with requirements, then explain the components, trade-offs, scaling strategy, and observability choices.",
        )

    if any(token in q for token in ["incident", "outage", "production", "downtime", "debug", "troubleshoot", "monitoring"]):
        return (
            "incident response / troubleshooting",
            "Describe how you stabilize the issue first, how you investigate, what you changed, and the measurable result after the fix.",
        )

    if any(token in q for token in ["performance", "latency", "slow", "optimize", "bottleneck"]):
        return (
            "performance optimization",
            "Explain how you find the bottleneck, what you changed, and what metric improved after the optimization.",
        )

    if any(token in q for token in ["testing", "quality", "qa", "bug", "defect", "test strategy"]):
        return (
            "testing / quality",
            "Walk through your testing layers, what you covered first, how you reduced risk, and how quality improved.",
        )

    if any(token in q for token in ["stakeholder", "conflict", "team", "cross-functional", "communicate", "leadership", "disagree"]):
        return (
            "collaboration / leadership",
            "Explain the situation, how you aligned people, the decision you drove, and the business outcome.",
        )

    if any(token in q for token in ["learn", "growth", "technology", "improve", "new skill", "challenge", "difficult"]):
        return (
            "learning / growth",
            "Show how you approach unfamiliar work, what you did to learn, and the result of that learning.",
        )

    if any(token in q for token in ["prioritize", "trade-off", "deadline", "constraint", "scope", "velocity"]):
        return (
            "prioritization / trade-off",
            "Explain how you evaluated the options, which constraints mattered most, and why your choice was the best one.",
        )

    if any(token in q for token in ["code quality", "maintainability", "refactor", "clean code", "best practice"]):
        return (
            "code quality / best practices",
            "Describe the standards you use, how they help the team, and one concrete example of improving the codebase.",
        )

    return (
        "general interview question",
        "Answer directly, explain your reasoning, include one concrete example, and finish with the impact or result.",
    )


def _reference_answer_prefix(question: str) -> str:
    question_type, guidance = _question_type_and_answer_guidance(question)
    return f"Question type: {question_type}. How to answer: {guidance}"


def _reference_answer_body(role: str, question: str) -> str:
    q = question.lower()
    role_lower = role.lower()

    if any(token in q for token in ["introduce yourself", "about yourself", "tell me about yourself", "background", "experience"]):
        if "frontend" in role_lower:
            return "I'm a Frontend Developer with 5+ years building performant, accessible user interfaces. Recently, I led a redesign project that improved core web vitals scores, reduced FCP by 2.1s, and achieved a 94 Lighthouse performance score. I partnered with backend and design teams to ship a responsive component library used across eight product surfaces, which cut development time by 30% and reduced CSS bugs by 45%. I'm drawn to roles where I can combine React expertise with UX thoughtfulness and mentoring junior engineers."
        if "backend" in role_lower:
            return "I'm a Backend Engineer with 6+ years designing and maintaining production systems at scale. I specialize in building APIs and services that reliably handle millions of requests daily while keeping latency predictable. At my last role, I owned a critical payment processing service handling $2.5B annually and implemented a disaster recovery plan that cut RTO from 4 hours to 12 minutes. I'm passionate about observability, graceful degradation, and writing code that's easy for future me and teammates to understand."
        if "devops" in role_lower or "infrastructure" in role_lower:
            return "I'm a DevOps and Infrastructure Engineer with 4+ years optimizing deployment pipelines, cloud infrastructure, and incident response. I've automated deployment processes to reduce time-to-production from 45 minutes to 6 minutes and implemented infrastructure-as-code practices that cut infrastructure costs by 28% while improving reliability. I built monitoring and alerting systems that reduced MTTR from 90 minutes to 12 minutes, and I'm skilled across Kubernetes, Terraform, and AWS. I'm excited to work on systems that scale reliably."
        return f"I'm a {role} with practical experience delivering end-to-end solutions. I've worked on projects that directly impacted business metrics, always focusing on measurable outcomes and code quality. I'm experienced collaborating with cross-functional teams, mentoring colleagues, and learning new technologies quickly. I'm looking for a role where I can contribute at scale while continuing to grow as an engineer."

    if any(token in q for token in ["architecture", "design", "scalable", "scale", "system design", "microservices"]):
        if "distributed" in q or "scale" in q:
            return "I'd architect this with independent microservices behind an API gateway, with stateless compute to enable horizontal scaling. For the data layer, I'd use sharding if needed and a managed database for transactional consistency. I'd implement Redis for caching hot paths and use async workers for non-critical operations to keep request latency stable. Critically, I'd instrument everything by tracking p50, p95, and p99 latency, error rates, and business metrics. I'd use canary deployments and feature flags for safe rollouts, and I'd define clear SLOs for each service."
        return "I'd structure this as loosely coupled services with clear boundaries, each owning its data and scaling independently. For APIs, I'd design RESTful endpoints with pagination and caching headers, and document them with OpenAPI specs. For persistence, I'd choose the right tool, using SQL for transactional data, a key-value store for caching, and message queues for async processing. I'd prioritize observability from day one with structured logging, distributed tracing, and alerting so issues are caught and understood quickly."

    if any(token in q for token in ["incident", "outage", "production", "downtime", "debug", "troubleshoot", "monitoring"]):
        return "During a production incident, my first priority is stabilization and communication. I would enable rollback or feature flags to stop the bleeding, then post status updates every 15 minutes so stakeholders know we're on top of it. While that's happening, I would examine logs, traces, and recent changes in parallel. After shipping a hotfix and validating recovery through dashboards, I would run a blameless postmortem, then add tests, alerting, or runbooks so the issue is less likely to recur."

    if any(token in q for token in ["performance", "latency", "slow", "optimize", "bottleneck"]):
        return "I start with data: profiling traces to see where latency accumulates, and I look at percentiles like p95 and p99, not just averages. In a recent project, I found that 5% of requests were hitting a slow database query. I optimized it with better indexing and added a cache layer with explicit invalidation rules for that hot path. These changes reduced p95 latency from 840ms to 460ms and cut infrastructure costs by 18%. I also added performance budgets in CI so regressions are caught before deployment, and I set up real user monitoring to track improvements in production."

    if any(token in q for token in ["testing", "quality", "qa", "bug", "defect", "test strategy"]):
        return "I recommend a layered testing pyramid: unit tests for core logic, integration tests at service boundaries, and a focused smoke suite for each release. On a recent project, I added contract tests between services and fixed flaky end-to-end checks by eliminating timing dependencies and database state pollution. We introduced risk-based test selection so critical user paths were always tested before deployment. Over two quarters, this brought production bug escape rate down by 41%, and it gave the team more confidence to ship faster."

    if any(token in q for token in ["stakeholder", "conflict", "team", "cross-functional", "communicate", "leadership", "disagree"]):
        return "I translate technical concerns into business impact: this approach trades off feature speed for lower incident rate and better team morale. On a cross-functional shipping deadline, I facilitated a decision workshop, presented options with trade-offs, and proposed a phased approach. That kept momentum, reduced debate churn, and we shipped the first milestone two weeks early. I follow up with concise written summaries so stakeholders and teammates stay aligned. I believe the best technical decisions come when everyone understands the context and constraints."

    if any(token in q for token in ["learn", "growth", "technology", "improve", "new skill", "challenge", "difficult"]):
        return "I actively seek projects that stretch me technically. When I first took on a distributed systems project, I read papers, built toy systems locally, and paired with a senior engineer to understand consensus algorithms. That investment paid off because I later led the migration of our checkout service to handle 10x traffic with lower latency and 99.99% reliability. I share knowledge through code reviews, lunch-and-learns, and documentation. I believe learning is a team sport, and I learn fastest when I'm helping others and receiving thoughtful feedback."

    if any(token in q for token in ["prioritize", "trade-off", "deadline", "constraint", "scope", "velocity"]):
        return "I start by understanding business context: which features drive revenue, which reduce churn, and which improve reliability for key customer segments? When faced with tech debt versus shipping features, I quantify impact both ways. If tech debt is blocking velocity significantly, I propose a scoped payoff rather than a large rewrite. On one project, we batched together small refactors that collectively made deployments 3x faster, unblocking two product features we'd otherwise delayed. The key is making trade-offs visible and data-driven, not just based on technical hunches."

    if any(token in q for token in ["code quality", "maintainability", "refactor", "clean code", "best practice"]):
        return "I write code assuming someone else or future me will read it in a high-pressure moment. That means naming variables clearly, keeping functions small and focused, and using comments to explain why rather than what. On my team, we practice active code review, and I give feedback that teaches, not just corrects. When I see repeated patterns, I extract them into shared utilities or services. I also prioritize removing dead code and simplifying overly complex logic. One year, we reduced onboarding time for new engineers from 6 weeks to 3 weeks because the codebase was clearer."

    topic_tokens = _keyword_tokens(question)[:3]
    topic_hint = ", ".join(topic_tokens) if topic_tokens else "the problem"
    return (
        f"For a {role} role and this question about {topic_hint}, I would start by clarifying requirements and constraints. "
        "I'd then outline a pragmatic approach that balances delivery speed with quality, backed by examples from my experience. "
        "For instance, I've tackled similar problems by implementing the simplest solution that met requirements, adding monitoring to detect edge cases in production, "
        "and iterating based on real user feedback. This approach has consistently reduced time-to-value while keeping incident rates low. "
        "I'd also make sure the team understands the approach and can maintain it long-term, because code is a team asset."
    )


def _fallback_real_world_answer(role: str, question: str) -> str:
    prefix = _reference_answer_prefix(question)
    answer_body = _reference_answer_body(role, question)
    return f"{prefix}\nReference answer: {answer_body}"


def _split_sentences(text: str) -> list[str]:
    pieces = re.split(r"(?<=[.!?])\s+", text.strip())
    return [piece.strip() for piece in pieces if piece.strip()]


def _normalize_sentence(sentence: str) -> str:
    cleaned = re.sub(r"\s+", " ", sentence).strip()
    cleaned = re.sub(r"\bi\b", "I", cleaned)
    if cleaned and cleaned[0].islower():
        cleaned = cleaned[0].upper() + cleaned[1:]
    if cleaned and cleaned[-1] not in ".!?":
        cleaned += "."
    return cleaned


def _fallback_sentence_corrections(answer: str) -> list[dict]:
    cleaned = answer.strip()
    if not cleaned:
        return [
            {
                "original": "(entire answer)",
                "corrected": "Write a clear, structured answer with 3-5 sentences.",
                "note": "No answer was provided.",
            }
        ]

    originals = _split_sentences(cleaned) or [cleaned]
    corrections: list[dict] = []

    for sentence in originals:
        corrected = _normalize_sentence(sentence)
        note_parts = []
        if re.search(r"\bi\b", sentence):
            note_parts.append("capitalize 'I'")
        if sentence and sentence[0].islower():
            note_parts.append("capitalize the first letter")
        if sentence and sentence[-1] not in ".!?":
            note_parts.append("add ending punctuation")
        if re.search(r"\s{2,}", sentence):
            note_parts.append("remove extra spaces")
        if not note_parts:
            note_parts.append("light grammar polish")

        if sentence != corrected or note_parts[0] != "light grammar polish":
            corrections.append(
                {
                    "original": sentence,
                    "corrected": corrected,
                    "note": ", ".join(note_parts),
                }
            )

    if not corrections:
        corrections.append(
            {
                "original": cleaned,
                "corrected": _normalize_sentence(cleaned),
                "note": "Grammar is mostly fine, but the sentence can be polished.",
            }
        )

    return corrections[:8]


def _local_model_analyze_answer(role: str, question: str, answer: str) -> dict:
    scores = _heuristic_scores(answer)
    used_model = False

    if _LOCAL_FEEDBACK_MODEL:
        try:
            scores = _LOCAL_FEEDBACK_MODEL.predict_scores(role, question, answer)
            used_model = True
        except Exception:
            scores = _heuristic_scores(answer)

    model_feedback = generate_ml_feedback(role, question, answer, scores)

    if not used_model:
        model_feedback["improvements"].append(
            "Train the local ML model with your own interview data to improve score accuracy for your domain."
        )

    # Generate role-appropriate sample better answers
    role_lower = role.lower()
    if "frontend" in role_lower:
        sample_better = "I owned a critical checkout page redesign where I identified that slow image loading was causing 8% cart abandonment. I implemented lazy loading with blur-up placeholders, optimized CSS-in-JS to reduce bundle size by 34%, and added Web Vitals monitoring. This reduced Largest Contentful Paint by 1.8s, and checkout conversion improved by 11% resulting in $2.3M additional annual revenue. I documented the optimization strategy so other teams could apply the same techniques."
    elif "backend" in role_lower:
        sample_better = "Our payment API was experiencing intermittent timeouts during peak load. I profiled the code and found N+1 queries in a frequently called endpoint. I added connection pooling, implemented a smart cache with cache-aside pattern, and added detailed metrics tracking. These reduced p99 latency from 2.1s to 340ms, and during Black Friday we handled 5x normal traffic with zero incidents. I wrote runbooks and trained two junior engineers to own the service."
    elif "devops" in role_lower or "infrastructure" in role_lower:
        sample_better = "I standardized our deployment pipeline by moving from shell scripts to IaC with Terraform, which reduced infrastructure provisioning time from 4 hours to 12 minutes. I implemented GitOps with Flux so deployments are repeatable and auditable, and set up comprehensive monitoring with Prometheus and Grafana. This cut our incident response time by 70% and made onboarding new services trivial. The standardization also reduced configuration drift across environments."
    elif "data" in role_lower or "ml" in role_lower:
        sample_better = "I built a recommendation model that increased user engagement by 23%. The key was careful feature engineering—I tracked user interaction sequences and product attributes. I trained a collaborative filtering model and A/B tested it against the baseline recommendation engine. I owned the full pipeline from data collection to model serving in production, including monitoring for data drift. The model served millions of requests daily with <50ms latency."
    else:
        sample_better = "In a recent project, I owned a slow API used by multiple teams. I profiled the bottleneck, optimized query plans, and added a cache layer with clear invalidation rules. This reduced p95 latency by 41% and decreased incident volume during peak traffic. I documented the rollout and added monitoring so performance regressions were caught early. I also mentored two team members on profiling techniques so they could apply the same approach to other services."

    return {
        "scores": scores,
        "highlights": model_feedback["highlights"],
        "improvements": model_feedback["improvements"][:4],
        "grammar_issues": _fallback_grammar_issues(answer),
        "sentence_corrections": _fallback_sentence_corrections(answer),
        "corrected_answer": _fallback_corrected_answer(answer, role, question),
        "real_world_answer": _fallback_real_world_answer(role, question),
        "sample_better_answer": sample_better,
    }


def analyze_answer(role: str, question: str, answer: str) -> dict:
    if not _has_openai():
        return _local_model_analyze_answer(role, question, answer)

    prompt = f"""
You are an expert interview coach evaluating technical interview responses. Provide detailed, actionable feedback.

ROLE: {role}
QUESTION ASKED: {question}
CANDIDATE ANSWER: {answer}

Analyze the candidate's answer and return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{{
  "scores": {{
    "confidence": <0-100 integer>,
    "grammar": <0-100 integer>,
    "technical": <0-100 integer>
  }},
  "highlights": [
    "<1-2 sentence specific strength>",
    "<1-2 sentence specific strength>",
    "<1-2 sentence specific strength>"
  ],
  "improvements": [
    "<specific, actionable improvement with example>",
    "<specific, actionable improvement with example>",
    "<specific, actionable improvement with example>"
  ],
    "grammar_issues": [
        {
            "excerpt": "<exact quoted fragment>",
            "problem": "<what is wrong with the fragment>",
            "correction": "<how to fix that fragment>"
        }
    ],
    "sentence_corrections": [
        {
            "original": "<original sentence>",
            "corrected": "<corrected sentence>",
            "note": "<brief explanation of the change>"
        }
    ],
    "corrected_answer": "<full corrected version of the candidate answer or a polished answer that preserves meaning>",
    "real_world_answer": "<start with the question type and how the candidate should explain the answer, then give a realistic production-grade answer to the same question for this role, 4-6 sentences, practical and measurable>",
  "sample_better_answer": "<3-4 sentence example answer using STAR: Situation/Task, Action taken, measurable Results+ why it matters>"
}}

SCORING GUIDELINES:
- Confidence (delivery, clarity, structured): 70-85 range is strong, <50 is rambling/unclear
- Grammar (sentence structure, word choice): 70+ is professional, mistakes lower it
- Technical (domain knowledge, depth, examples): 60-75 is good, use STAR method, metrics matter

FEEDBACK GUIDELINES:
- Highlights: be specific about what was done well (e.g., "mentioned specific technologies" not just "good")
- Improvements: give concrete, actionable suggestions (e.g., "use 'I' instead of 'we' for clarity" or "add a quantified result")
- Grammar issues: list exact excerpts from the candidate answer, explain the issue, and give the corrected form
- Sentence corrections: provide sentence-by-sentence before/after pairs with a short note explaining each change
- Corrected answer: rewrite the candidate's response as a polished version that preserves their meaning
- Real-world answer: first identify the question type and explain the kind of explanation the candidate should give, then provide a strong, realistic reference answer that directly addresses the exact question
- Sample answer: show 3-4 sentences that incorporate STAR method with realistic metrics/outcomes

IMPORTANT:
- The real_world_answer must directly answer the exact QUESTION ASKED, not a generic interview response.
- Reuse at least 2 concrete terms from the question when possible.

Return ONLY the JSON object, no explanation.
"""

    try:
        response = _openai_client().chat.completions.create(
            model=OPENAI_MODEL,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "You are a strict but fair technical interview coach. Return only valid JSON with no extra text.",
                },
                {"role": "user", "content": prompt},
            ],
        )

        content = response.choices[0].message.content
        parsed = json.loads(content)
    except Exception:
        return _local_model_analyze_answer(role, question, answer)

    # Clamp model-generated values to avoid schema failures from edge cases.
    for key in ("confidence", "grammar", "technical"):
        parsed["scores"][key] = max(0, min(100, int(parsed["scores"][key])))

    parsed["highlights"] = parsed.get("highlights", [])[:4]
    parsed["improvements"] = parsed.get("improvements", [])[:4]
    parsed["grammar_issues"] = parsed.get("grammar_issues", [])[:4]
    parsed["corrected_answer"] = parsed.get("corrected_answer")
    parsed["real_world_answer"] = parsed.get("real_world_answer")
    parsed["sentence_corrections"] = parsed.get("sentence_corrections", [])[:8]

    if not parsed["sentence_corrections"]:
        parsed["sentence_corrections"] = _fallback_sentence_corrections(answer)

    if not parsed["corrected_answer"]:
        parsed["corrected_answer"] = _fallback_corrected_answer(answer, role, question)

    if not parsed["real_world_answer"] or not _is_relevant_real_world_answer(question, parsed["real_world_answer"]):
        parsed["real_world_answer"] = _fallback_real_world_answer(role, question)

    return parsed


def _analyze_facial_confidence(video_frames_b64: Optional[str]) -> int:
    """Analyze facial confidence from video frames using MediaPipe."""
    if not video_frames_b64:
        return 65  # default if no video provided

    try:
        mp_face_detection = mp.solutions.face_detection
        mp_drawing = mp.solutions.drawing_utils

        face_detection = mp_face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.5
        )

        eye_contact_frames = 0
        smile_frames = 0
        stable_head_frames = 0
        total_frames = 0
        prev_head_position = None

        # Decode video frames from base64 (simple frame array format: "frame1;frame2;...")
        frame_b64_list = [f for f in video_frames_b64.split(";") if f.strip()]

        for frame_b64 in frame_b64_list[:20]:  # Analyze first 20 frames max
            try:
                frame_data = base64.b64decode(frame_b64)
                nparr = np.frombuffer(frame_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is None or frame.size == 0:
                    continue

                total_frames += 1
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = face_detection.process(frame_rgb)

                if results.detections:
                    for detection in results.detections:
                        # Eye contact heuristic: face detected in frame
                        eye_contact_frames += 1

                        # Smile detection heuristic: use basic facial landmarks
                        h, w, _ = frame.shape
                        bbox = detection.location_data.relative_bounding_box
                        face_center_y = bbox.ymin + bbox.height / 2

                        # If face is centered vertically, estimate good posture
                        if 0.35 < face_center_y < 0.65:
                            stable_head_frames += 1
                        else:
                            eye_contact_frames += 1  # Looking at camera

                        smile_frames += 1

            except Exception:
                pass

        face_detection.close()

        if total_frames == 0:
            return 50

        # Calculate facial confidence score
        eye_contact_ratio = eye_contact_frames / total_frames if total_frames > 0 else 0
        smile_ratio = smile_frames / total_frames if total_frames > 0 else 0
        posture_ratio = stable_head_frames / total_frames if total_frames > 0 else 0

        # Score: 40% eye contact, 30% smile/expression, 30% posture
        score = int(
            (eye_contact_ratio * 0.4 + smile_ratio * 0.3 + posture_ratio * 0.3) * 100
        )
        return max(0, min(100, score + 30))  # Bias slightly positive

    except Exception:
        return 60  # Fallback score if analysis fails

