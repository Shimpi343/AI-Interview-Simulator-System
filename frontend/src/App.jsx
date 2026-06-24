import { useCallback, useMemo, useState, useEffect } from "react";
import ScoreCard from "./components/ScoreCard";
import VoiceInputButton from "./components/VoiceInputButton";
import VideoCapture from "./components/VideoCapture";
import AIAvatar from "./components/AIAvatar";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function getOverallScore(scores) {
  if (!scores) return 0;

  const total = scores.confidence + scores.grammar + scores.technical + scores.facial_confidence;
  return Math.round(total / 4);
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
  const sessionStatus = feedback ? "Review complete" : question ? "Awaiting submission" : "Not started";

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
      if (!res.ok) {
        throw new Error("Question generation failed");
      }
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
      if (!res.ok) {
        throw new Error("Feedback generation failed");
      }

      const data = await res.json();
      setFeedback(data);
      setSessionReviews((prev) => [
        ...prev,
        {
          question,
          answer,
          overallScore: getOverallScore(data.scores),
        },
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

  // Initialize particle system
  useEffect(() => {
    const particlesContainer = document.getElementById("particles-bg");
    if (!particlesContainer) return;

    // Reduced particle count to improve performance on lower-end machines
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = `particle ${["accent", "energy"][Math.floor(Math.random() * 2)]}`;
      particle.style.left = Math.random() * 100 + "%";
      particle.style.top = Math.random() * 100 + "%";
      particle.style.animationDuration = 15 + Math.random() * 20 + "s";
      particle.style.animationDelay = Math.random() * 5 + "s";
      particlesContainer.appendChild(particle);
    }
  }, []);

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 relative">
      <div id="particles-bg" className="particles" />
      <div className="grid-overlay" />
      <div className="ambient-glow" />

      <main className="mx-auto max-w-7xl">
        <header className="hero-panel reveal overflow-hidden rounded-[1.75rem] p-5 md:p-7 lg:p-8 backdrop-blur-2xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-stretch">
            <div className="relative z-10 flex flex-col justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <p className="chip rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em]">AI Interview Studio</p>
                <p className="chip rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">Practice desk</p>
                <p className="chip rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">Live scoring</p>
              </div>

              <div className="mt-7 max-w-3xl">
                <p className="panel-kicker text-emerald-200/80">Interview practice workspace</p>
                <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight tracking-tight text-white md:text-6xl">
                  Practice answers, record your delivery, and improve faster.
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                  Run role-specific rounds with voice input, laptop camera recording, and a clear scorecard that helps you see exactly what to improve next.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={fetchQuestion}
                  disabled={loadingQuestion}
                  className="rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingQuestion ? "Launching..." : "Launch session"}
                </button>
                <button
                  type="button"
                  onClick={resetSession}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Reset session
                </button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-cyan-500/20 bg-cyan-500/8 p-4 backdrop-blur-xl transition hover:border-cyan-500/40 hover:bg-cyan-500/12">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Round mode</p>
                  <p className="mt-2 text-base font-semibold text-white">{difficulty} difficulty</p>
                </div>
                <div className="rounded-[1.4rem] border border-sky-500/20 bg-sky-500/8 p-4 backdrop-blur-xl transition hover:border-sky-500/40 hover:bg-sky-500/12">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-sky-300">Session status</p>
                  <p className="mt-2 text-base font-semibold text-white">{sessionStatus}</p>
                </div>
                <div className="rounded-[1.4rem] border border-emerald-500/20 bg-emerald-500/8 p-4 backdrop-blur-xl transition hover:border-emerald-500/40 hover:bg-emerald-500/12">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">Completion</p>
                  <p className="mt-2 text-base font-semibold text-white">{history.length} rounds</p>
                </div>
              </div>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.2rem] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-4 transition hover:border-cyan-500/40 hover:bg-gradient-to-br hover:from-cyan-500/15 hover:to-blue-500/10">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-semibold">01</span>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Generate</p>
                      <p className="mt-1 text-sm text-slate-300">Role-aware prompts</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.2rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-rose-500/5 p-4 transition hover:border-amber-500/40 hover:bg-gradient-to-br hover:from-amber-500/15 hover:to-rose-500/10">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-semibold">02</span>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Record</p>
                      <p className="mt-1 text-sm text-slate-300">Voice and video evidence</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-4 transition hover:border-emerald-500/40 hover:bg-gradient-to-br hover:from-emerald-500/15 hover:to-teal-500/10">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">03</span>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Review</p>
                      <p className="mt-1 text-sm text-slate-300">Scored feedback loop</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[1.5rem] border border-cyan-500/25 bg-slate-950/75 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-emerald-400 to-cyan-400" />
              <div className="absolute -right-10 top-10 h-48 w-48 rounded-full bg-cyan-400/8 blur-3xl" />
              <div className="absolute -left-8 bottom-0 h-52 w-52 rounded-full bg-orange-400/8 blur-3xl" />

              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Mission control</p>
                    <h2 className="mt-2 font-display text-2xl text-white">Session snapshot</h2>
                  </div>
                  <div className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                    {cameraReady ? "Camera live" : "Camera idle"}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-center">
                  <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-transparent shadow-[0_0_40px_rgba(0,217,255,0.2)]">
                    <AIAvatar isActive={!!question} score={latestOverallScore} />
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-cyan-500/20 bg-cyan-500/6 p-4 transition hover:border-cyan-500/40 hover:bg-cyan-500/10">
                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-400">Average score</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{averageSessionScore || "--"}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-emerald-500/20 bg-emerald-500/6 p-4 transition hover:border-emerald-500/40 hover:bg-emerald-500/10">
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Best score</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{bestSessionScore || "--"}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-orange-500/20 bg-orange-500/6 p-4 transition hover:border-orange-500/40 hover:bg-orange-500/10">
                    <p className="text-xs uppercase tracking-[0.18em] text-orange-400">Rounds completed</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{history.length}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-purple-500/20 bg-purple-500/6 p-4 transition hover:border-purple-500/40 hover:bg-purple-500/10">
                    <p className="text-xs uppercase tracking-[0.18em] text-purple-400">Readiness</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{progressValue}%</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/12 via-sky-500/8 to-amber-500/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">What this workspace does</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    It combines prompt generation, answer capture, optional voice input, camera evidence, and AI feedback in one high-end flow.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-5 reveal" style={{ animationDelay: "120ms" }}>
            <div className="job-card rounded-[1.75rem] p-5">
              <p className="panel-kicker">Session console</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{role}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Tune the interview target, launch a round, and review the resulting assessment in the same workspace.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="mini-box rounded-2xl p-3">
                  <p className="text-slate-400">Difficulty</p>
                  <p className="mt-1 font-semibold text-white capitalize">{difficulty}</p>
                </div>
                <div className="mini-box rounded-2xl p-3">
                  <p className="text-slate-400">Question #</p>
                  <p className="mt-1 font-semibold text-white">{questionCount || 0}</p>
                </div>
                <div className="mini-box rounded-2xl p-3">
                  <p className="text-slate-400">Latest score</p>
                  <p className="mt-1 font-semibold text-white">{latestOverallScore || "--"}</p>
                </div>
                <div className="mini-box rounded-2xl p-3">
                  <p className="text-slate-400">Average score</p>
                  <p className="mt-1 font-semibold text-white">{averageSessionScore || "--"}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
                  <span>Readiness</span>
                  <span>{progressValue}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full border border-cyan-500/30 bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-500"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="job-card rounded-[1.75rem] p-5">
              <p className="panel-kicker">Pipeline status</p>
              <div className="mt-4 space-y-2">
                <div className={`stage-pill ${questionCount > 0 ? "stage-pill-active" : ""}`}>1. Job setup configured</div>
                <div className={`stage-pill ${question ? "stage-pill-active" : ""}`}>2. Question generated</div>
                <div className={`stage-pill ${answer.trim() ? "stage-pill-active" : ""}`}>3. Response drafted</div>
                <div className={`stage-pill ${feedback ? "stage-pill-active" : ""}`}>4. Recruiter review ready</div>
              </div>
            </div>

            <div className="job-card rounded-[1.75rem] p-5">
              <p className="panel-kicker">Live signals</p>
              <div className="mt-4 grid gap-2 text-sm">
                <div className="mini-box rounded-2xl p-3">
                  <p className="text-slate-400">Recorded video</p>
                  <p className="mt-1 font-semibold text-white">{hasVideoRecording ? "Recorded" : "Not yet"}</p>
                </div>
                <div className="mini-box rounded-2xl p-3">
                  <p className="text-slate-400">Camera status</p>
                  <p className="mt-1 font-semibold text-white">{cameraReady ? "Ready" : "Unavailable"}</p>
                </div>
                <div className="mini-box rounded-2xl p-3">
                  <p className="text-slate-400">Best score</p>
                  <p className="mt-1 font-semibold text-white">{bestSessionScore || "--"}</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-5 reveal" style={{ animationDelay: "180ms" }}>
            <section className="surface-panel rounded-[2rem] p-5 md:p-6 lg:p-7">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.5rem] border border-cyan-500/20 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Interview setup</p>
                      <h3 className="mt-2 font-display text-2xl text-white">Control the next round</h3>
                    </div>
                    <span className="chip rounded-full px-3 py-1 text-xs">Round {questionCount || 0}</span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <label className="space-y-1 md:col-span-2">
                      <span className="text-sm text-cyan-300">Target Role</span>
                      <div className="field-shell rounded-2xl px-3 py-3">
                        <input
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          disabled={questionCount > 0}
                          className="w-full bg-transparent text-sm text-white outline-none placeholder-slate-500 disabled:opacity-60"
                          placeholder="Ex: Backend Engineer"
                        />
                      </div>
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm text-cyan-300">Difficulty</span>
                      <div className="field-shell rounded-2xl px-3 py-3">
                        <select
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value)}
                          disabled={questionCount > 0}
                          className="w-full bg-transparent text-sm text-white outline-none disabled:opacity-60"
                        >
                          <option value="easy" style={{backgroundColor: '#1e293b', color: '#fff'}}>Easy</option>
                          <option value="medium" style={{backgroundColor: '#1e293b', color: '#fff'}}>Medium</option>
                          <option value="hard" style={{backgroundColor: '#1e293b', color: '#fff'}}>Hard</option>
                        </select>
                      </div>
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={fetchQuestion}
                      disabled={loadingQuestion || (questionCount === 0 ? false : !!feedback)}
                      className="btn-primary rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingQuestion ? "Generating..." : questionCount === 0 ? "Start Interview" : "Generate Question"}
                    </button>
                    <button
                      type="button"
                      onClick={resetSession}
                      className="btn-secondary rounded-full px-5 py-3 text-sm font-semibold transition"
                    >
                      Reset Session
                    </button>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-cyan-500/20 bg-slate-900/80 p-5 text-white shadow-[0_0_30px_rgba(0,217,255,0.1),0_16px_48px_rgba(15,23,42,0.3)]">
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-400">Assessment preview</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-400">Session status</p>
                      <p className="mt-2 text-lg font-semibold text-white">{sessionStatus}</p>
                    </div>
                    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/8 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-purple-400">Submission state</p>
                      <p className="mt-2 text-lg font-semibold text-white">{canSubmit ? "Ready" : "Draft required"}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/12 to-cyan-500/8 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">What this workspace does</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      It combines prompt generation, answer capture, optional voice input, camera evidence, and AI feedback in one polished flow.
                    </p>
                  </div>
                </div>
              </div>

              {question ? (
                <div className="mt-5 rounded-[1.5rem] border border-cyan-500/20 bg-slate-900/60 p-5 shadow-md reveal">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Interview prompt</p>
                    <span className="chip rounded-full px-3 py-1 text-[10px]">Round {questionCount}</span>
                  </div>
                  <p className="mt-3 text-xl leading-relaxed text-white">{question}</p>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-cyan-500/20 bg-slate-900/40 p-5">
                  <p className="text-sm text-slate-400">Generate a question to begin the next role-specific round.</p>
                </div>
              )}

              {!feedback && question ? (
                <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_340px]">
                  <div className="rounded-[1.5rem] border border-cyan-500/20 bg-slate-900/60 p-5 shadow-md">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Candidate response</p>
                        <p className="mt-1 text-sm text-slate-300">Write your answer or dictate it with voice input.</p>
                      </div>
                      <VoiceInputButton onTranscript={setAnswer} currentText={answer} />
                    </div>

                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={9}
                      className="field-shell w-full rounded-[1.25rem] p-4 text-sm text-white outline-none placeholder-slate-500"
                      placeholder="Write your response like a thoughtful interview answer..."
                    />

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={submitAnswer}
                        disabled={!canSubmit || loadingFeedback}
                        className="btn-primary rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loadingFeedback ? "Analyzing..." : "Submit for review"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnswer("");
                          setIsRecording(false);
                          setVideoFrames("");
                          setHasVideoRecording(false);
                        }}
                        className="btn-secondary rounded-full px-5 py-3 text-sm font-semibold transition"
                      >
                        Clear draft
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-purple-500/20 bg-slate-900/60 p-5 shadow-md">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-purple-400">Camera evidence</p>
                        <p className="mt-1 text-sm text-slate-300">Laptop camera recording is used for facial confidence analysis.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!cameraReady) return;
                          setIsRecording((prev) => !prev);
                        }}
                        disabled={!cameraReady && !isRecording}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                          isRecording ? "bg-rose-500 text-white hover:bg-rose-400" : "btn-secondary"
                        }`}
                      >
                        {isRecording ? "Stop Recording" : cameraReady ? "Start Recording" : "Camera Unavailable"}
                      </button>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                        <p className="text-slate-400">Source</p>
                        <p className="mt-1 font-semibold text-cyan-100">Laptop preferred</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                        <p className="text-slate-400">Recording</p>
                        <p className="mt-1 font-semibold text-emerald-100">{hasVideoRecording ? "Saved" : isRecording ? "In progress" : "Ready"}</p>
                      </div>
                    </div>

                    {!cameraReady && cameraStatusMessage ? (
                      <p className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {cameraStatusMessage}
                      </p>
                    ) : null}

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

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={fetchQuestion}
                      disabled={loadingQuestion}
                      className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingQuestion ? "Loading next question..." : "Next Round"}
                    </button>
                    <button
                      type="button"
                      onClick={resetSession}
                      className="btn-secondary rounded-full px-5 py-3 text-sm font-semibold transition"
                    >
                      Reset Session
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {error}
                </p>
              ) : null}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
