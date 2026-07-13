function ScoreBar({ label, value }) {
  const color =
    value >= 80
      ? "linear-gradient(90deg, #177e63, #36b37e)"
      : value >= 60
      ? "linear-gradient(90deg, #b7791f, #d99a2b)"
      : "linear-gradient(90deg, #b42318, #e0665c)";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <span className="text-sm font-extrabold text-slate-950">{value}/100</span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function splitWords(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function getWordDiff(original, corrected) {
  const originalWords = splitWords(original);
  const correctedWords = splitWords(corrected);

  let prefix = 0;
  while (
    prefix < originalWords.length &&
    prefix < correctedWords.length &&
    originalWords[prefix] === correctedWords[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < originalWords.length - prefix &&
    suffix < correctedWords.length - prefix &&
    originalWords[originalWords.length - 1 - suffix] === correctedWords[correctedWords.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    originalPrefix: originalWords.slice(0, prefix),
    originalChanged: originalWords.slice(prefix, originalWords.length - suffix),
    originalSuffix: originalWords.slice(originalWords.length - suffix),
    correctedPrefix: correctedWords.slice(0, prefix),
    correctedChanged: correctedWords.slice(prefix, correctedWords.length - suffix),
    correctedSuffix: correctedWords.slice(correctedWords.length - suffix),
  };
}

function DiffText({ original, corrected, type }) {
  const diff = getWordDiff(original, corrected);
  const changedClass =
    type === "original"
      ? "rounded bg-red-50 px-1 py-0.5 text-red-800 line-through decoration-red-500"
      : "rounded bg-green-50 px-1 py-0.5 text-green-800";
  const parts = type === "original"
    ? [diff.originalPrefix, diff.originalChanged, diff.originalSuffix]
    : [diff.correctedPrefix, diff.correctedChanged, diff.correctedSuffix];

  return (
    <p className="leading-relaxed text-slate-700">
      {parts[0].join(" ")}
      {parts[0].length > 0 && parts[1].length > 0 ? " " : ""}
      {parts[1].length > 0 ? <span className={changedClass}>{parts[1].join(" ")}</span> : null}
      {(parts[0].length > 0 || parts[1].length > 0) && parts[2].length > 0 ? " " : ""}
      {parts[2].join(" ")}
    </p>
  );
}

function DiffRow({ original, corrected, note, index }) {
  return (
    <div className="review-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm text-slate-950">Sentence {index + 1}</strong>
        <span className="text-xs font-semibold text-slate-500">{note}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
          <span className="text-xs font-extrabold uppercase tracking-wide text-red-700">Original</span>
          <div className="mt-2 whitespace-pre-wrap">
            <DiffText original={original} corrected={corrected} type="original" />
          </div>
        </div>
        <div className="rounded-lg border border-green-100 bg-green-50/50 p-3">
          <span className="text-xs font-extrabold uppercase tracking-wide text-green-700">Corrected</span>
          <div className="mt-2 whitespace-pre-wrap">
            <DiffText original={original} corrected={corrected} type="corrected" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScoreCard({ feedback, originalAnswer = "" }) {
  if (!feedback) return null;

  const overallScore = Math.round(
    (feedback.scores.confidence +
      feedback.scores.grammar +
      feedback.scores.technical +
      feedback.scores.facial_confidence) /
      4
  );

  return (
    <section className="score-section">
      <div className="score-header">
        <div>
          <span className="eyebrow">Assessment summary</span>
          <h3 className="mt-2 text-2xl font-extrabold text-slate-950">AI feedback</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            A concise review across answer quality, grammar, technical depth, and on-camera confidence.
          </p>
        </div>
        <div className="score-badge">
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-300">Overall</span>
          <strong className="text-3xl leading-none">{overallScore}</strong>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <ScoreBar label="Confidence" value={feedback.scores.confidence} />
        <ScoreBar label="Grammar" value={feedback.scores.grammar} />
        <ScoreBar label="Technical" value={feedback.scores.technical} />
        <ScoreBar label="Facial confidence" value={feedback.scores.facial_confidence} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="review-card">
          <span className="eyebrow">Highlights</span>
          <ul>
            {feedback.highlights.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="review-card">
          <span className="eyebrow">Improvements</span>
          <ul>
            {feedback.improvements.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {feedback.grammar_issues?.length ? (
          <details className="review-toggle" open={false}>
            <summary>Grammar fixes</summary>
            <div className="mt-3 space-y-3">
              {feedback.grammar_issues.map((issue, idx) => (
                <div key={idx} className="review-card review-card-soft">
                  <p><strong className="text-slate-950">Excerpt:</strong> {issue.excerpt}</p>
                  <p className="mt-2"><strong className="text-red-700">Problem:</strong> {issue.problem}</p>
                  <p className="mt-2"><strong className="text-green-700">Fix:</strong> {issue.correction}</p>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {feedback.sentence_corrections?.length ? (
          <details className="review-toggle">
            <summary>Sentence corrections</summary>
            <div className="mt-3 space-y-3">
              {feedback.sentence_corrections.map((item, idx) => (
                <DiffRow key={idx} index={idx} original={item.original} corrected={item.corrected} note={item.note} />
              ))}
            </div>
          </details>
        ) : null}

        {feedback.corrected_answer ? (
          <details className="review-toggle">
            <summary>Corrected answer</summary>
            <p className="mt-3 whitespace-pre-wrap text-slate-700">{feedback.corrected_answer}</p>
          </details>
        ) : null}

        {feedback.real_world_answer ? (
          <details className="review-toggle">
            <summary>Reference answer</summary>
            <p className="mt-3 whitespace-pre-wrap text-slate-700">{feedback.real_world_answer}</p>
          </details>
        ) : null}

        {originalAnswer ? (
          <details className="review-toggle">
            <summary>Your original answer</summary>
            <p className="mt-3 whitespace-pre-wrap text-slate-700">{originalAnswer}</p>
          </details>
        ) : null}

        {feedback.sample_better_answer ? (
          <details className="review-toggle">
            <summary>Stronger STAR answer</summary>
            <p className="mt-3 text-slate-700">{feedback.sample_better_answer}</p>
          </details>
        ) : null}
      </div>
    </section>
  );
}
