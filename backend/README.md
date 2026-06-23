# Backend - AI Interview Simulator

## Setup

1. Install dependencies:

```bash
py -3.12 -m pip install -r requirements.txt
```

2. Copy env file and add your key:

```powershell
Copy-Item .env.example .env
```

CMD alternative:

```bat
copy .env.example .env
```

3. Run server:

```bash
py -3.12 -m uvicorn app.main:app --reload --port 8000
```

API base URL: `http://localhost:8000`

- `POST /api/interview/question`
- `POST /api/interview/feedback`
- `POST /api/ml/train`
- `GET /health`

## Train Local ML Feedback Model

This project supports a trainable local model for interview feedback scores.

1. Add or edit training rows in `backend/data/interview_feedback_training.csv`.
2. Train the model:

```bash
py -3.12 train_feedback_model.py
```

3. Restart backend (or call the training API below) so latest model is used.

Alternative: train via API

```http
POST /api/ml/train
Content-Type: application/json

{
	"dataset_path": "backend/data/interview_feedback_training.csv"
}
```

Response includes model quality metrics (MAE for confidence/grammar/technical).
