from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ai_service import (
    _analyze_facial_confidence,
    analyze_answer,
    generate_interview_question,
    reload_local_feedback_model,
)
from .ml_feedback import train_feedback_model
from .schemas import (
    AnalyzeAnswerRequest,
    AnalyzeAnswerResponse,
    GenerateQuestionRequest,
    GenerateQuestionResponse,
    TrainModelRequest,
    TrainModelResponse,
)



app = FastAPI(title="AI Interview Simulator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/interview/question", response_model=GenerateQuestionResponse)
def interview_question(payload: GenerateQuestionRequest) -> GenerateQuestionResponse:
    try:
        question = generate_interview_question(
            role=payload.role,
            difficulty=payload.difficulty,
            history=payload.history,
        )
        return GenerateQuestionResponse(question=question)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to generate question: {exc}")


@app.post("/api/interview/feedback", response_model=AnalyzeAnswerResponse)
def interview_feedback(payload: AnalyzeAnswerRequest) -> AnalyzeAnswerResponse:
    try:
        result = analyze_answer(
            role=payload.role,
            question=payload.question,
            answer=payload.answer,
        )
        facial_confidence = _analyze_facial_confidence(payload.video_frames)
        result["scores"]["facial_confidence"] = facial_confidence
        return AnalyzeAnswerResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to analyze answer: {exc}")


@app.post("/api/ml/train", response_model=TrainModelResponse)
def train_ml_model(payload: TrainModelRequest) -> TrainModelResponse:
    try:
        metrics = train_feedback_model(payload.dataset_path)
        reload_local_feedback_model()
        return TrainModelResponse(
            status="trained",
            dataset_path=metrics["dataset_path"],
            rows=metrics["rows"],
            mae=metrics["mae"],
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to train ML model: {exc}")

