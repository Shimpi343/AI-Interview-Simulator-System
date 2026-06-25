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

    finalTranscriptRef.current = currentText; // Initialize with current text
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (event) => {
      let interimText = "";
      
      // Collect all transcripts from resultIndex onwards, marking finals
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // Final result - add to accumulated transcript with space
          finalTranscriptRef.current += (finalTranscriptRef.current ? " " : "") + transcript;
        } else {
          // Interim result - show as preview but don't add to final yet
          interimText += transcript;
        }
      }

      // Send the full accumulated transcript + any interim text being typed
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
      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(244,63,94,0.25)] transition hover:bg-rose-400"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
      Stop Voice Input
    </button>
  ) : (
    <button
      type="button"
      onClick={start}
      className="inline-flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-300/10 px-4 py-2 text-sm font-semibold text-teal-50 shadow-[0_14px_28px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-teal-300/15"
    >
      <span className="h-2 w-2 rounded-full bg-amber-300" />
      Start Voice Input
    </button>
  );
}
