# AI Interview Simulator System

A full-stack interview practice system:

- AI asks interview questions
- User answers via text or voice
- AI returns feedback with:
  - Confidence score
  - Grammar score
  - Technical score

## Tech Stack

- Frontend: React + Tailwind (Vite)
- Backend: FastAPI
- AI: OpenAI API (with local fallback if key is missing)

## Project Structure

```text
backend/
  app/
    ai_service.py
    main.py
    schemas.py
  requirements.txt
frontend/
  src/
    components/
      ScoreCard.jsx
      VoiceInputButton.jsx
    App.jsx
    index.css
    main.jsx
  package.json
```

## Run Backend

```bash
cd backend
pip install -r requirements.txt
copy .env.example .env
# Add OPENAI_API_KEY in .env (optional for fallback mode)
uvicorn app.main:app --reload --port 8000
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:5173`

## API Endpoints

- `GET /health`
- `POST /api/interview/question`
- `POST /api/interview/feedback`
- `POST /api/ml/train`

## Train Your Own ML Feedback Model

You can train a local ML model to improve score accuracy for your interview domain.

1. Update dataset: `backend/data/interview_feedback_training.csv`
2. Train model:

```bash
cd backend
py -3.12 train_feedback_model.py
```

3. Start backend and use normal feedback endpoint.

When OpenAI is unavailable, backend uses the trained local model for confidence, grammar, and technical scores, plus targeted improvement suggestions.

## Notes

- If OpenAI key is not configured, backend uses heuristic question/score fallback.
- Voice input depends on browser support for Web Speech API.
