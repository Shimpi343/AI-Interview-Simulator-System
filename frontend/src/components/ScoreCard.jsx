function ScoreBar({ label, value, delay }) {
  const colorClass =
    value >= 80
      ? "bg-emerald-400"
      : value >= 60
      ? "bg-amber-300"
      : "bg-rose-400";

  return (
    <div className="space-y-2 reveal" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between text-sm text-slate-100">
        <span className="tracking-wide text-slate-300 font-semibold">{label}</span>
        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 font-semibold text-cyan-300">{value}/100</span>
      </div>
      <div className="h-3 rounded-full border border-cyan-500/30 bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${colorClass}`} style={{ width: `${value}%` }} />
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

function DiffText({ original, corrected, tone = "rose" }) {
  const diff = getWordDiff(original, corrected);

  const originalChangedClass =
    tone === "rose"
      ? "bg-rose-400/20 text-rose-100 line-through decoration-rose-400/80"
      : "bg-slate-400/20 text-slate-100 line-through decoration-slate-400/80";
  const correctedChangedClass =
    tone === "emerald"
      ? "bg-emerald-400/20 text-emerald-100"
      : "bg-emerald-400/20 text-emerald-100";

  return (
    <div className="space-y-2">
      <p className="leading-relaxed text-rose-200">
        {diff.originalPrefix.join(" ")}
        {diff.originalPrefix.length > 0 && diff.originalChanged.length > 0 ? " " : ""}
        {diff.originalChanged.length > 0 ? (
          <span className={`rounded px-1 py-0.5 ${originalChangedClass}`}>
            {diff.originalChanged.join(" ")}
          </span>
        ) : null}
        {(diff.originalPrefix.length > 0 || diff.originalChanged.length > 0) && diff.originalSuffix.length > 0 ? " " : ""}
        {diff.originalSuffix.join(" ")}
      </p>
      <p className="leading-relaxed text-emerald-200">
        {diff.correctedPrefix.join(" ")}
        {diff.correctedPrefix.length > 0 && diff.correctedChanged.length > 0 ? " " : ""}
        {diff.correctedChanged.length > 0 ? (
          <span className={`rounded px-1 py-0.5 ${correctedChangedClass}`}>
            {diff.correctedChanged.join(" ")}
          </span>
        ) : null}
        {(diff.correctedPrefix.length > 0 || diff.correctedChanged.length > 0) && diff.correctedSuffix.length > 0 ? " " : ""}
        {diff.correctedSuffix.join(" ")}
      </p>
    </div>
  );
}

function DiffRow({ original, corrected, note, index }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 text-sm text-slate-100">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Sentence {index + 1}</p>
        <p className="text-xs text-slate-400">{note}</p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3">
          <p className="text-xs uppercase tracking-wider text-rose-400">Original</p>
          <div className="mt-2 whitespace-pre-wrap">
            <DiffText original={original} corrected={corrected} tone="rose" />
          </div>
        </div>
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="text-xs uppercase tracking-wider text-emerald-400">Corrected</p>
          <div className="mt-2 whitespace-pre-wrap">
            <DiffText original={original} corrected={corrected} tone="emerald" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScoreCard({ feedback, originalAnswer = "" }) {
  if (!feedback) return null;

  const overallScore =
    Math.round(
      (feedback.scores.confidence +
        feedback.scores.grammar +
        feedback.scores.technical +
        feedback.scores.facial_confidence) /
        4
    );

  return (
    <section className="surface-panel mt-6 rounded-[2rem] p-5 md:p-6 backdrop-blur-xl reveal">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="panel-kicker text-cyan-400">Assessment summary</p>
          <h3 className="mt-2 font-display text-2xl text-white">AI Feedback</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            The scorecard blends response quality, technical depth, grammar, and on-camera confidence into one concise review.
          </p>
        </div>
        <span className="chip rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Detailed review</span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
        <div className="rounded-[1.5rem] border border-cyan-500/40 bg-gradient-to-br from-slate-900 to-slate-950 p-5 text-white shadow-lg shadow-cyan-500/20">
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Latest round</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="font-display text-5xl leading-none">{overallScore}</span>
            <span className="pb-1 text-sm text-slate-400">/100</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-300">
            Based on confidence, grammar, technical depth, and facial analysis.
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-slate-700/50 bg-slate-900/40 p-5 shadow-md shadow-slate-900/30">
          <div className="grid gap-4 sm:grid-cols-2">
            <ScoreBar label="Confidence" value={feedback.scores.confidence} delay={50} />
            <ScoreBar label="Grammar" value={feedback.scores.grammar} delay={120} />
            <ScoreBar label="Technical" value={feedback.scores.technical} delay={200} />
            <ScoreBar label="Facial Confidence" value={feedback.scores.facial_confidence} delay={270} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-md">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Highlights</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-emerald-100 space-y-1">
            {feedback.highlights.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.5rem] border border-orange-500/30 bg-orange-500/10 p-5 shadow-md">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-400">Improvements</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-orange-100 space-y-1">
            {feedback.improvements.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {feedback.grammar_issues?.length ? (
        <div className="mt-4 rounded-[1.5rem] border border-rose-500/30 bg-rose-500/10 p-5 shadow-md">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-400">Grammar issues with exact fixes</p>
          <div className="mt-3 space-y-3">
            {feedback.grammar_issues.map((issue, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 text-sm text-slate-100">
                <p className="text-xs uppercase tracking-wider text-rose-400">Excerpt</p>
                <p className="mt-1 rounded bg-rose-900/30 px-2 py-1 font-mono text-rose-200">{issue.excerpt}</p>
                <p className="mt-2"><span className="font-semibold text-rose-300">Problem:</span> <span className="text-rose-100">{issue.problem}</span></p>
                <p className="mt-1"><span className="font-semibold text-emerald-300">Fix:</span> <span className="text-emerald-100">{issue.correction}</span></p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {feedback.sentence_corrections?.length ? (
        <div className="mt-4 rounded-[1.5rem] border border-cyan-500/30 bg-cyan-500/10 p-5 shadow-md">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Sentence-by-sentence corrections</p>
          <p className="mt-1 text-xs text-cyan-300">The rows below show what changed in each sentence so you can see the exact grammar fix.</p>
          <div className="mt-3 space-y-3">
            {feedback.sentence_corrections.map((item, idx) => (
              <DiffRow
                key={idx}
                index={idx}
                original={item.original}
                corrected={item.corrected}
                note={item.note}
              />
            ))}
          </div>
        </div>
      ) : null}

      {feedback.corrected_answer ? (
        <div className="mt-4 rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-100 shadow-md">
          <p className="font-semibold text-emerald-300">Corrected answer</p>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap text-emerald-50">{feedback.corrected_answer}</p>
        </div>
      ) : null}

      {feedback.real_world_answer ? (
        <div className="mt-4 rounded-[1.5rem] border border-cyan-500/30 bg-cyan-500/10 p-5 text-sm text-cyan-100 shadow-md">
          <p className="font-semibold text-cyan-300">Real-world reference answer</p>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-cyan-50">{feedback.real_world_answer}</p>
          <p className="mt-3 text-xs text-cyan-300/70">Use this as a strong answer pattern you can adapt to your own experiences.</p>
        </div>
      ) : null}

      {originalAnswer ? (
        <div className="mt-4 rounded-[1.5rem] border border-slate-500/30 bg-slate-500/10 p-5 text-sm text-slate-100 shadow-md">
          <p className="font-semibold text-slate-300">Your original answer</p>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-200">{originalAnswer}</p>
        </div>
      ) : null}

      {feedback.sample_better_answer ? (
        <div className="mt-4 rounded-[1.5rem] border border-orange-500/30 bg-orange-500/10 p-5 text-sm text-orange-100 shadow-md">
          <p className="font-semibold text-orange-300">Suggested stronger answer using STAR method</p>
          <p className="mt-2 leading-relaxed text-orange-50">{feedback.sample_better_answer}</p>
          <p className="mt-3 text-xs text-orange-300/70">Notice how this answer includes: Situation/Task, specific Action, measurable Results, and why it mattered.</p>
        </div>
      ) : null}
    </section>
  );
}
