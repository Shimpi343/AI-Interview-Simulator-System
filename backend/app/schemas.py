from pydantic import BaseModel, Field
from typing import List, Literal, Optional


Difficulty = Literal["easy", "medium", "hard"]


class InterviewTurn(BaseModel):
    question: str
    answer: str


class GenerateQuestionRequest(BaseModel):
    role: str = Field(..., min_length=2, max_length=80)
    difficulty: Difficulty = "medium"
    history: List[InterviewTurn] = Field(default_factory=list)


class GenerateQuestionResponse(BaseModel):
    question: str


class AnalyzeAnswerRequest(BaseModel):
    role: str = Field(..., min_length=2, max_length=80)
    question: str = Field(..., min_length=5, max_length=400)
    answer: str = Field(..., min_length=1, max_length=6000)
    video_frames: Optional[str] = None


class ScoreCard(BaseModel):
    confidence: int = Field(..., ge=0, le=100)
    grammar: int = Field(..., ge=0, le=100)
    technical: int = Field(..., ge=0, le=100)
    facial_confidence: int = Field(..., ge=0, le=100)


class GrammarIssue(BaseModel):
    excerpt: str = Field(..., description="Exact text fragment that contains the issue")
    problem: str = Field(..., description="What is wrong with the excerpt")
    correction: str = Field(..., description="Suggested fix for the excerpt")


class SentenceCorrection(BaseModel):
    original: str = Field(..., description="Original sentence or fragment from the answer")
    corrected: str = Field(..., description="Corrected version of the sentence or fragment")
    note: str = Field(..., description="Short explanation of the change")


class AnalyzeAnswerResponse(BaseModel):
    scores: ScoreCard
    highlights: List[str]
    improvements: List[str]
    grammar_issues: List[GrammarIssue] = Field(default_factory=list)
    sentence_corrections: List[SentenceCorrection] = Field(default_factory=list)
    corrected_answer: Optional[str] = None
    real_world_answer: Optional[str] = None
    sample_better_answer: Optional[str] = None


class TrainModelRequest(BaseModel):
    dataset_path: str = "backend/data/interview_feedback_training.csv"


class TrainModelResponse(BaseModel):
    status: str
    dataset_path: str
    rows: int
    mae: dict

