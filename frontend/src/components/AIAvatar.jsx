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
            <stop offset="0%" stopColor="#7ce5ff" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#0f76d4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0a3a7d" stopOpacity="0.6" />
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
        <circle cx="100" cy="100" r="95" fill="none" stroke="#00d9ff" strokeWidth="1" opacity="0.4" className="avatar-aura" />
        <circle cx="100" cy="100" r="92" fill="none" stroke="#ff00ff" strokeWidth="0.5" opacity="0.2" className="avatar-aura-2" />

        {/* Main head */}
        <circle cx="100" cy="100" r="80" fill="url(#headGradient)" filter="url(#glow)" className="avatar-head" />

        {/* Tech lines on head */}
        <line x1="45" y1="100" x2="65" y2="100" stroke="#00d9ff" strokeWidth="1.5" opacity="0.6" className="tech-line" />
        <line x1="135" y1="100" x2="155" y2="100" stroke="#ff00ff" strokeWidth="1.5" opacity="0.6" className="tech-line" />
        <line x1="100" y1="45" x2="100" y2="65" stroke="#00d9ff" strokeWidth="1.5" opacity="0.6" className="tech-line" />
        <line x1="100" y1="135" x2="100" y2="155" stroke="#ff00ff" strokeWidth="1.5" opacity="0.6" className="tech-line" />

        {/* Left eye */}
        <g className={`avatar-eye ${blink ? "blinking" : ""}`}>
          <circle cx="75" cy="90" r="12" fill="#ffffff" opacity="0.9" />
          <circle cx="75" cy="90" r="8" fill="#0f76d4" className="avatar-pupil" />
          <circle cx="77" cy="88" r="3" fill="#00d9ff" opacity="0.8" />
        </g>

        {/* Right eye */}
        <g className={`avatar-eye ${blink ? "blinking" : ""}`}>
          <circle cx="125" cy="90" r="12" fill="#ffffff" opacity="0.9" />
          <circle cx="125" cy="90" r="8" fill="#0f76d4" className="avatar-pupil" />
          <circle cx="127" cy="88" r="3" fill="#00d9ff" opacity="0.8" />
        </g>

        {/* Smile/communication line */}
        <path d="M 75 120 Q 100 135 125 120" stroke="#ff00ff" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />

        {/* Confidence indicator - animated pulse when score is good */}
        {score && score >= 70 && (
          <circle cx="100" cy="100" r="85" fill="none" stroke="#00ff88" strokeWidth="1.5" opacity="0.4" className="confidence-pulse" />
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
          <span className="text-xs uppercase tracking-wider text-cyan-300">Score</span>
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
          filter: drop-shadow(0 0 20px rgba(0, 217, 255, 0.3));
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
          background: linear-gradient(135deg, rgba(0, 217, 255, 0.2), rgba(255, 0, 255, 0.1));
          border: 1px solid rgba(0, 217, 255, 0.3);
          padding: 6px 12px;
          border-radius: 20px;
          backdrop-filter: blur(8px);
        }

        .status-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          background: #00ff88;
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
          background: linear-gradient(135deg, rgba(0, 217, 255, 0.15), rgba(0, 255, 136, 0.1));
          border: 1px solid rgba(0, 255, 136, 0.3);
          padding: 8px 12px;
          border-radius: 12px;
          backdrop-filter: blur(8px);
        }

        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(0, 217, 255, 0.3)); }
          50% { filter: drop-shadow(0 0 40px rgba(0, 217, 255, 0.6)); }
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
          0%, 100% { r: 8; fill: #0f76d4; }
          50% { r: 9; fill: #1a8ce5; }
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
          0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(0, 255, 136, 0.6); }
          50% { opacity: 0.5; box-shadow: 0 0 4px rgba(0, 255, 136, 0.3); }
        }
      `}</style>
    </div>
  );
}
