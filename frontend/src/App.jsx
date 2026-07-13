import { useCallback, useMemo, useState } from "react";
import ScoreCard from "./components/ScoreCard";
import VoiceInputButton from "./components/VoiceInputButton";
import VideoCapture from "./components/VideoCapture";
import AIAvatar from "./components/AIAvatar";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const ROLE_PRESETS = [
  "Frontend Developer",
  "Backend Engineer",
  "Full Stack Developer",
  "DevOps Engineer",
  "QA Automation Engineer",
  "Data Analyst",
  "ML Engineer",
  "Product Manager",
];

function getOverallScore(scores) {
  if (!scores) return 0;
  const total = scores.confidence + scores.grammar + scores.technical + scores.facial_confidence;
  return Math.round(total / 4);
}

function Stat({ label, value, tone = "slate" }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState("Frontend Developer");
  const [difficulty, setDifficulty] = useState("medium");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]);
  const [sessionReviews, setSessionReviews] = useState([]);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [error, setError] = useState("");
  const [videoFrames, setVideoFrames] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [hasVideoRecording, setHasVideoRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStatusMessage, setCameraStatusMessage] = useState("Checking camera access...");

  const canSubmit = useMemo(
    () => question.trim().length > 0 && answer.trim().length > 0,
    [question, answer]
  );

  const progressValue = useMemo(() => Math.min(100, Math.round((history.length / 5) * 100)), [history.length]);
  const latestOverallScore = useMemo(() => getOverallScore(feedback?.scores), [feedback]);
  const averageSessionScore = useMemo(() => {
    if (!sessionReviews.length) return 0;
    const total = sessionReviews.reduce((sum, review) => sum + review.overallScore, 0);
    return Math.round(total / sessionReviews.length);
  }, [sessionReviews]);
  const bestSessionScore = useMemo(() => {
    if (!sessionReviews.length) return 0;
    return Math.max(...sessionReviews.map((review) => review.overallScore));
  }, [sessionReviews]);
  const sessionStatus = feedback ? "Review complete" : question ? "Answer in progress" : "Ready to begin";

  const fetchQuestion = async () => {
    setError("");
    setFeedback(null);
    setHasVideoRecording(false);
    setLoadingQuestion(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/interview/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, difficulty, history }),
      });
      if (!res.ok) throw new Error("Question generation failed");
      const data = await res.json();
      setQuestion(data.question || "");
      setAnswer("");
      setVideoFrames("");
      setIsRecording(false);
      setQuestionCount((prev) => prev + 1);
    } catch (e) {
      setError("Could not get a question. Is the backend running on port 8000?");
    } finally {
      setLoadingQuestion(false);
    }
  };

  const submitAnswer = async () => {
    if (!canSubmit) return;
    setError("");
    setLoadingFeedback(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/interview/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, question, answer, video_frames: videoFrames || null }),
      });
      if (!res.ok) throw new Error("Feedback generation failed");

      const data = await res.json();
      setFeedback(data);
      setSessionReviews((prev) => [
        ...prev,
        { question, answer, overallScore: getOverallScore(data.scores) },
      ]);
      setHistory((prev) => [...prev, { question, answer }]);
    } catch (e) {
      setError("Could not analyze your answer. Check backend logs for details.");
    } finally {
      setLoadingFeedback(false);
      setIsRecording(false);
    }
  };

  const handleVideoRecorded = useCallback((videoBlob) => {
    setHasVideoRecording(true);
    console.log("Video recorded, blob size:", videoBlob.size);
  }, []);

  const handleCameraStatusChange = useCallback((isAvailable, message) => {
    setCameraReady(isAvailable);
    setCameraStatusMessage(message || "");
    if (!isAvailable) {
      setIsRecording(false);
      setHasVideoRecording(false);
    }
  }, []);

  const resetSession = useCallback(() => {
    setQuestion("");
    setAnswer("");
    setFeedback(null);
    setVideoFrames("");
    setHasVideoRecording(false);
    setIsRecording(false);
    setQuestionCount(0);
    setHistory([]);
    setSessionReviews([]);
    setError("");
  }, []);

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <nav className="premium-nav">
          <div className="flex items-center gap-3">
            <div className="brand-mark">IS</div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Interview Studio</p>
              <p className="text-xs text-slate-500">AI practice command center</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-pill">{cameraReady ? "Camera ready" : "Camera pending"}</span>
            <span className="status-pill status-pill-dark">{sessionStatus}</span>
          </div>
        </nav>

        <section className="hero-shell">
          <div className="hero-copy">
            <span className="eyebrow">Premium interview rehearsal</span>
            <h1>Sharpen every answer before the real call.</h1>
            <p>
              Practice with role-specific prompts, voice capture, camera review, and a precise scorecard that shows what to improve next.
            </p>
            <div className="hero-actions">
              <button type="button" onClick={fetchQuestion} disabled={loadingQuestion} className="btn-primary">
                {loadingQuestion ? "Preparing round..." : questionCount ? "Generate next prompt" : "Start interview"}
              </button>
              <button type="button" onClick={resetSession} className="btn-secondary">
                Reset
              </button>
            </div>
          </div>

          <div className="hero-insight">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="eyebrow">Live readiness</span>
                <h2>{progressValue}%</h2>
              </div>
              <AIAvatar isActive={!!question} score={latestOverallScore} />
            </div>
            <div className="progress-track">
              <div style={{ width: `${progressValue}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Stat label="Average" value={averageSessionScore || "--"} tone="sage" />
              <Stat label="Best" value={bestSessionScore || "--"} tone="gold" />
              <Stat label="Rounds" value={history.length} tone="slate" />
              <Stat label="Latest" value={latestOverallScore || "--"} tone="rose" />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <div className="panel">
              <div className="panel-head">
                <span className="eyebrow">Session setup</span>
                <h2>{role}</h2>
              </div>

              <label className="form-field">
                <span>Target role</span>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={questionCount > 0}
                  placeholder="Ex: Backend Engineer"
                />
              </label>

              <div className="form-field">
                <span>Popular interview fields</span>
                <div className="flex flex-wrap gap-2">
                  {ROLE_PRESETS.map((preset) => {
                    const active = role.toLowerCase() === preset.toLowerCase();
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRole(preset)}
                        disabled={questionCount > 0}
                        className={active ? "btn-primary text-sm" : "btn-secondary text-sm"}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Pick a common interview track or type any custom role above.
                </p>
              </div>

              <label className="form-field">
                <span>Difficulty</span>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={questionCount > 0}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Question" value={questionCount || 0} />
                <Stat label="Video" value={hasVideoRecording ? "Saved" : "Open"} tone="sage" />
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <span className="eyebrow">Workflow</span>
                <h2>Round progress</h2>
              </div>
              <div className="timeline">
                <div className={questionCount > 0 ? "active" : ""}>Setup locked</div>
                <div className={question ? "active" : ""}>Prompt issued</div>
                <div className={answer.trim() ? "active" : ""}>Response drafted</div>
                <div className={feedback ? "active" : ""}>Review delivered</div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <span className="eyebrow">Recent rounds</span>
                <h2>Session record</h2>
              </div>
              <div className="space-y-3">
                {sessionReviews.length ? (
                  sessionReviews.slice(-3).map((review, index) => (
                    <div key={`${review.question}-${index}`} className="history-item">
                      <div>
                        <strong>Round {sessionReviews.length - sessionReviews.slice(-3).length + index + 1}</strong>
                        <p>{review.question}</p>
                      </div>
                      <span>{review.overallScore}</span>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">Completed rounds will appear here with score snapshots.</p>
                )}
              </div>
            </div>
          </aside>

          <div className="space-y-5">
            <section className="panel workbench">
              <div className="workbench-header">
                <div>
                  <span className="eyebrow">Current round</span>
                  <h2>{question ? `Round ${questionCount}` : "No active prompt"}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={fetchQuestion}
                    disabled={loadingQuestion || (questionCount > 0 && !!feedback)}
                    className="btn-secondary"
                  >
                    {loadingQuestion ? "Generating..." : questionCount ? "New prompt" : "Start"}
                  </button>
                  <button type="button" onClick={resetSession} className="btn-ghost">
                    Clear
                  </button>
                </div>
              </div>

              <div className={question ? "prompt-card" : "prompt-card prompt-empty"}>
                <span>Interview prompt</span>
                <p>{question || "Generate a prompt to begin a role-specific round."}</p>
              </div>

              {!feedback && question ? (
                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="answer-panel">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="eyebrow">Candidate answer</span>
                        <h3>Draft your response</h3>
                      </div>
                      <VoiceInputButton onTranscript={setAnswer} currentText={answer} />
                    </div>
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={10}
                      placeholder="Write a clear interview answer with context, actions, and measurable outcomes."
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" onClick={submitAnswer} disabled={!canSubmit || loadingFeedback} className="btn-primary">
                        {loadingFeedback ? "Reviewing..." : "Submit for review"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnswer("");
                          setIsRecording(false);
                          setVideoFrames("");
                          setHasVideoRecording(false);
                        }}
                        className="btn-ghost"
                      >
                        Clear draft
                      </button>
                    </div>
                  </div>

                  <div className="camera-panel">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="eyebrow">Camera review</span>
                        <h3>Delivery capture</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => cameraReady && setIsRecording((prev) => !prev)}
                        disabled={!cameraReady && !isRecording}
                        className={isRecording ? "btn-danger" : "btn-secondary"}
                      >
                        {isRecording ? "Stop" : cameraReady ? "Record" : "Unavailable"}
                      </button>
                    </div>
                    {!cameraReady && cameraStatusMessage ? <p className="notice">{cameraStatusMessage}</p> : null}
                    <VideoCapture
                      onFramesCapture={setVideoFrames}
                      isRecording={isRecording}
                      onVideoRecorded={handleVideoRecorded}
                      onCameraStatusChange={handleCameraStatusChange}
                    />
                  </div>
                </div>
              ) : null}

              {feedback ? (
                <div className="mt-5">
                  <ScoreCard feedback={feedback} originalAnswer={answer} />
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={fetchQuestion} disabled={loadingQuestion} className="btn-primary">
                      {loadingQuestion ? "Loading..." : "Next round"}
                    </button>
                    <button type="button" onClick={resetSession} className="btn-secondary">
                      Reset session
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? <p className="error-banner">{error}</p> : null}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
