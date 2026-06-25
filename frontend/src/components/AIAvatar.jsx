import { useState, useEffect } from "react";

export default function AIAvatar({ isActive = false, score = null }) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 4000 + Math.random() * 2000);
    return () => clearInterval(blinkInterval);
  }, [isActive]);

  return (
    <div className="avatar-container">
      <svg viewBox="0 0 200 200" className="avatar-svg">
        {/* Head - futuristic orb shape */}
        <defs>
          <radialGradient id="headGradient" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.92" />
            <stop offset="55%" stopColor="#fb7185" stopOpacity="0.84" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.68" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Aura glow */}
        <circle cx="100" cy="100" r="95" fill="none" stroke="#2dd4bf" strokeWidth="1" opacity="0.42" className="avatar-aura" />
        <circle cx="100" cy="100" r="92" fill="none" stroke="#fbbf24" strokeWidth="0.5" opacity="0.28" className="avatar-aura-2" />

        {/* Main head */}
        <circle cx="100" cy="100" r="80" fill="url(#headGradient)" filter="url(#glow)" className="avatar-head" />

        {/* Tech lines on head */}
        <line x1="45" y1="100" x2="65" y2="100" stroke="#2dd4bf" strokeWidth="1.5" opacity="0.65" className="tech-line" />
        <line x1="135" y1="100" x2="155" y2="100" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" className="tech-line" />
        <line x1="100" y1="45" x2="100" y2="65" stroke="#2dd4bf" strokeWidth="1.5" opacity="0.65" className="tech-line" />
        <line x1="100" y1="135" x2="100" y2="155" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" className="tech-line" />

        {/* Left eye */}
        <g className={`avatar-eye ${blink ? "blinking" : ""}`}>
          <circle cx="75" cy="90" r="12" fill="#ffffff" opacity="0.9" />
          <circle cx="75" cy="90" r="8" fill="#0f766e" className="avatar-pupil" />
          <circle cx="77" cy="88" r="3" fill="#fbbf24" opacity="0.85" />
        </g>

        {/* Right eye */}
        <g className={`avatar-eye ${blink ? "blinking" : ""}`}>
          <circle cx="125" cy="90" r="12" fill="#ffffff" opacity="0.9" />
          <circle cx="125" cy="90" r="8" fill="#0f766e" className="avatar-pupil" />
          <circle cx="127" cy="88" r="3" fill="#fbbf24" opacity="0.85" />
        </g>

        {/* Smile/communication line */}
        <path d="M 75 120 Q 100 135 125 120" stroke="#fb7185" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />

        {/* Confidence indicator - animated pulse when score is good */}
        {score && score >= 70 && (
          <circle cx="100" cy="100" r="85" fill="none" stroke="#2dd4bf" strokeWidth="1.5" opacity="0.46" className="confidence-pulse" />
        )}
      </svg>

      {/* Status badge */}
      <div className="avatar-status">
        <span className="status-dot"></span>
        <span className="text-xs font-semibold text-white">{isActive ? "Active" : "Ready"}</span>
      </div>

      {/* Score display if available */}
      {score !== null && (
        <div className="avatar-score">
          <span className="text-xs uppercase tracking-wider text-amber-200">Score</span>
          <span className="text-2xl font-bold text-white">{score}</span>
        </div>
      )}

      <style>{`
        .avatar-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .avatar-svg {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 0 20px rgba(251, 191, 36, 0.24));
          animation: ${isActive ? "pulse-glow 3s ease-in-out infinite" : "none"};
        }

        .avatar-head {
          animation: ${isActive ? "head-float 6s ease-in-out infinite" : "none"};
        }

        .avatar-aura {
          animation: ${isActive ? "aura-rotate 8s linear infinite" : "none"};
        }

        .avatar-aura-2 {
          animation: ${isActive ? "aura-rotate-reverse 6s linear infinite" : "none"};
        }

        .tech-line {
          animation: ${isActive ? "tech-pulse 2s ease-in-out infinite" : "none"};
        }

        .avatar-eye {
          opacity: 1;
          animation: ${isActive ? "eye-track 4s ease-in-out infinite" : "none"};
        }

        .avatar-eye.blinking {
          animation: blink 0.3s ease-in-out !important;
        }

        .avatar-pupil {
          animation: ${isActive ? "pupil-shine 3s ease-in-out infinite" : "none"};
        }

        .confidence-pulse {
          animation: confidence-glow 2s ease-in-out infinite;
        }

        .avatar-status {
          position: absolute;
          bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, rgba(45, 212, 191, 0.18), rgba(251, 191, 36, 0.1));
          border: 1px solid rgba(45, 212, 191, 0.3);
          padding: 6px 12px;
          border-radius: 20px;
          backdrop-filter: blur(8px);
        }

        .status-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          background: #2dd4bf;
          border-radius: 50%;
          animation: status-pulse 2s ease-in-out infinite;
        }

        .avatar-score {
          position: absolute;
          top: 8px;
          right: 8px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(45, 212, 191, 0.1));
          border: 1px solid rgba(251, 191, 36, 0.28);
          padding: 8px 12px;
          border-radius: 12px;
          backdrop-filter: blur(8px);
        }

        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(251, 191, 36, 0.25)); }
          50% { filter: drop-shadow(0 0 40px rgba(45, 212, 191, 0.45)); }
        }

        @keyframes head-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes aura-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes aura-rotate-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes tech-pulse {
          0%, 100% { opacity: 0.3; stroke-width: 1.5; }
          50% { opacity: 0.8; stroke-width: 2; }
        }

        @keyframes eye-track {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(3px); }
          75% { transform: translateX(-3px); }
        }

        @keyframes pupil-shine {
          0%, 100% { r: 8; fill: #0f766e; }
          50% { r: 9; fill: #115e59; }
        }

        @keyframes blink {
          0%, 100% { cy: 90; r: 12; }
          50% { cy: 95; r: 2; }
        }

        @keyframes confidence-glow {
          0%, 100% { r: 85; opacity: 0.2; }
          50% { r: 90; opacity: 0.5; }
        }

        @keyframes status-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(45, 212, 191, 0.6); }
          50% { opacity: 0.5; box-shadow: 0 0 4px rgba(45, 212, 191, 0.3); }
        }
      `}</style>
    </div>
  );
}
