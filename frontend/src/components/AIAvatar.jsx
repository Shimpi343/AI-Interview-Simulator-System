export default function AIAvatar({ isActive = false, score = null }) {
  return (
    <div className="avatar-frame">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
        <svg viewBox="0 0 160 120" className="h-24 w-full" role="img" aria-label="AI interviewer status">
          <defs>
            <linearGradient id="avatarFace" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#d9e2ec" />
            </linearGradient>
          </defs>
          <rect x="18" y="16" width="124" height="82" rx="8" fill="#172033" />
          <rect x="28" y="26" width="104" height="62" rx="8" fill="url(#avatarFace)" />
          <circle cx="62" cy="55" r="7" fill="#172033" className={isActive ? "animate-pulse" : ""} />
          <circle cx="98" cy="55" r="7" fill="#172033" className={isActive ? "animate-pulse" : ""} />
          <path d="M58 72 Q80 84 102 72" fill="none" stroke="#177e63" strokeWidth="5" strokeLinecap="round" />
          <rect x="70" y="98" width="20" height="10" rx="4" fill="#172033" />
          <rect x="48" y="108" width="64" height="8" rx="4" fill="#172033" />
        </svg>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className={`h-2 w-2 rounded-full ${isActive ? "bg-green-600" : "bg-amber-500"}`} />
            {isActive ? "Active" : "Ready"}
          </span>
          {score !== null ? <strong className="text-sm text-slate-950">{score}</strong> : null}
        </div>
      </div>
    </div>
  );
}
