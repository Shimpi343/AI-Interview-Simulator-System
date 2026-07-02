import { useRef, useState } from "react";

export default function VoiceInputButton({ onTranscript, currentText = "" }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef(currentText);

  const start = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      window.alert("Speech recognition is not supported in this browser.");
      return;
    }

    finalTranscriptRef.current = currentText;
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (event) => {
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? " " : "") + transcript;
        } else {
          interimText += transcript;
        }
      }

      const fullText = finalTranscriptRef.current + (interimText ? " " + interimText : "");
      onTranscript(fullText.trim());
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return listening ? (
    <button
      type="button"
      onClick={stop}
      className="btn-danger gap-2"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
      Stop voice
    </button>
  ) : (
    <button
      type="button"
      onClick={start}
      className="btn-secondary gap-2"
    >
      <span className="h-2 w-2 rounded-full bg-amber-300" />
      Voice input
    </button>
  );
}
