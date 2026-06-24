import { useEffect, useRef, useState } from "react";

const PHONE_CAMERA_KEYWORDS = [
  "phone",
  "iphone",
  "android",
  "droidcam",
  "ivcam",
  "epoccam",
  "continuity",
  "obs",
  "snap camera",
];

const LAPTOP_CAMERA_KEYWORDS = [
  "integrated",
  "built-in",
  "builtin",
  "internal",
  "facetime",
  "webcam",
  "camera",
  "hd user facing",
];


function getCameraErrorMessage(err) {
  switch (err?.name) {
    case "NotAllowedError":
      return "Camera permission denied. Allow camera access in browser site settings and reload.";
    case "NotFoundError":
      return "No camera device was found on this system.";
    case "NotReadableError":
      return "Camera is busy in another app. Close it and try again.";
    case "OverconstrainedError":
      return "Your camera does not support the requested video settings.";
    default:
      return "Camera/microphone not available.";
  }
}

function getCameraScore(device) {
  const label = device.label.toLowerCase();
  let score = 0;

  if (PHONE_CAMERA_KEYWORDS.some((keyword) => label.includes(keyword))) score -= 100;
  if (LAPTOP_CAMERA_KEYWORDS.some((keyword) => label.includes(keyword))) score += 20;
  if (label.includes("usb")) score -= 8;
  if (label.includes("front")) score += 4;

  return score;
}

async function getPreferredCameraDevice() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((device) => device.kind === "videoinput");

  if (!cameras.length) return null;

  return [...cameras].sort((a, b) => getCameraScore(b) - getCameraScore(a))[0];
}

async function requestCameraStream(deviceId, includeAudio = true) {
  const video = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
    : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" };

  return navigator.mediaDevices.getUserMedia({ video, audio: includeAudio });
}


export default function VideoCapture({ onFramesCapture, isRecording, onVideoRecorded, onCameraStatusChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const mimeTypeRef = useRef("video/webm");
  const framesRef = useRef([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState("idle");
  const [selectedCameraLabel, setSelectedCameraLabel] = useState("");
  const [cameraCount, setCameraCount] = useState(0);
  const onVideoRecordedRef = useRef(onVideoRecorded);
  const onCameraStatusChangeRef = useRef(onCameraStatusChange);
  const playbackUrlRef = useRef(null);

  useEffect(() => {
    onVideoRecordedRef.current = onVideoRecorded;
  }, [onVideoRecorded]);

  useEffect(() => {
    onCameraStatusChangeRef.current = onCameraStatusChange;
  }, [onCameraStatusChange]);

  useEffect(() => {
    playbackUrlRef.current = playbackUrl;
  }, [playbackUrl]);

  useEffect(() => {
    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        const message = "This browser does not support camera access via getUserMedia.";
        setPermissionError(message);
        setCameraActive(false);
        if (onCameraStatusChangeRef.current) {
          onCameraStatusChangeRef.current(false, message);
        }
        return;
      }

      try {
        let stream;
        let usedVideoOnly = false;
        let selectedCamera = null;

        try {
          const permissionStream = await requestCameraStream(null, false);
          permissionStream.getTracks().forEach((track) => track.stop());
          selectedCamera = await getPreferredCameraDevice();
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCameraCount(devices.filter((device) => device.kind === "videoinput").length);
          stream = await requestCameraStream(selectedCamera?.deviceId, true);
        } catch (audioErr) {
          console.warn("[VC] Audio+video request failed, retrying video-only:", audioErr);
          if (!selectedCamera) {
            selectedCamera = await getPreferredCameraDevice();
          }
          stream = await requestCameraStream(selectedCamera?.deviceId, false);
          usedVideoOnly = true;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const activeTrack = stream.getVideoTracks()[0];
          const activeLabel = activeTrack?.label || selectedCamera?.label || "Laptop camera";
          setSelectedCameraLabel(activeLabel);
          setCameraActive(true);
          setPermissionError(usedVideoOnly ? "Microphone unavailable. Recording will continue with video only." : "");
          if (onCameraStatusChangeRef.current) {
            onCameraStatusChangeRef.current(true, `Using ${activeLabel}`);
          }

          try {
            const supportedMimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
              (candidate) => MediaRecorder.isTypeSupported(candidate)
            );

            mimeTypeRef.current = supportedMimeType || "video/webm";
            console.log("[VC] MIME:", supportedMimeType || "browser-default");

            const recorder = supportedMimeType
              ? new MediaRecorder(stream, { mimeType: supportedMimeType })
              : new MediaRecorder(stream);

            recorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                chunksRef.current.push(event.data);
                console.log("[VC] Chunk:", event.data.size, "bytes, Total:", chunksRef.current.length);
              }
            };

            recorder.onstop = () => {
              console.log("[VC] Stopped, chunks:", chunksRef.current.length);
              if (chunksRef.current.length === 0) {
                console.warn("[VC] No chunks!");
                return;
              }
              try {
                const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
                console.log("[VC] Blob:", blob.size, "bytes");
                if (blob.size === 0) {
                  console.warn("[VC] Empty blob!");
                  return;
                }
                const url = URL.createObjectURL(blob);
                console.log("[VC] URL created");
                setPlaybackUrl(url);
                setRecordingStatus("saved");
                if (onVideoRecordedRef.current) onVideoRecordedRef.current(blob);
              } catch (err) {
                console.error("[VC] Error:", err);
              } finally {
                chunksRef.current = [];
              }
            };

            recorder.onerror = (evt) => console.error("[VC] Error:", evt.error);
            mediaRecorderRef.current = recorder;
          } catch (err) {
            console.error("[VC] Recorder init:", err);
            setPermissionError("Failed to initialize video recording.");
            setCameraActive(false);
            if (onCameraStatusChangeRef.current) {
              onCameraStatusChangeRef.current(false, "Failed to initialize video recording.");
            }
          }
        }
      } catch (err) {
        console.error("[VC] Camera:", err);
        const message = getCameraErrorMessage(err);
        setPermissionError(message);
        setCameraActive(false);
        if (onCameraStatusChangeRef.current) {
          onCameraStatusChangeRef.current(false, message);
        }
      }
    };
    startCamera();
    return () => {
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraActive || !mediaRecorderRef.current) {
      if (isRecording) {
        setRecordingStatus("idle");
      }
      return;
    }
    if (isRecording) {
      if (mediaRecorderRef.current.state === "inactive") {
        chunksRef.current = [];
        framesRef.current = [];
        mediaRecorderRef.current.start();
        setRecordingStatus("recording");
        const captureFrame = () => {
          if (videoRef.current && canvasRef.current) {
            try {
              const ctx = canvasRef.current.getContext("2d");
              ctx.drawImage(videoRef.current, 0, 0, 320, 240);
              const frameData = canvasRef.current.toDataURL("image/jpeg", 0.3);
              const base64 = frameData.split(",")[1];
              if (base64) framesRef.current.push(base64);
            } catch (err) {
              console.error("Frame capture:", err);
            }
          }
        };
        const intervalId = setInterval(captureFrame, 500);
        return () => {
          clearInterval(intervalId);
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
            setRecordingStatus("idle");
          }
          if (framesRef.current.length > 0) {
            onFramesCapture(framesRef.current.join(";"));
          }
        };
      }
    } else {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.requestData();
        mediaRecorderRef.current.stop();
        setRecordingStatus("idle");
      }
    }
  }, [isRecording, cameraActive, onFramesCapture]);

  const handleClearRecording = () => {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    setPlaybackUrl(null);
    setRecordingStatus("idle");
    chunksRef.current = [];
    framesRef.current = [];
  };

  return (
    <div className="space-y-4">
      {permissionError && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {permissionError}
        </p>
      )}
      {recordingStatus !== "saved" && (
        <div className="overflow-hidden rounded-[1.5rem] border border-cyan-400/25 bg-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.25)]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-[4/3] w-full bg-slate-900 object-cover"
            style={{ maxHeight: "240px" }}
          />
          <canvas ref={canvasRef} width={320} height={240} className="hidden" />
          <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-300">
            <span className="uppercase tracking-[0.2em]">Live capture</span>
            <span>{cameraActive ? "Camera ready" : "Awaiting permission"}</span>
          </div>
          {cameraActive ? (
            <div className="border-t border-white/10 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-300">
              <p className="truncate">
                Active camera: <span className="font-semibold text-cyan-200">{selectedCameraLabel || "Laptop camera"}</span>
              </p>
              {cameraCount > 1 ? (
                <p className="mt-1 text-slate-500">Laptop camera is preferred automatically when multiple cameras are connected.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {recordingStatus === "recording" && (
        <div className="flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          <div className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span>Recording video...</span>
        </div>
      )}
      {recordingStatus === "saved" && playbackUrl && (
        <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Your recording</p>
          <video
            key={playbackUrl}
            src={playbackUrl}
            controls
            controlsList="nodownload"
            className="w-full overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-950"
            style={{ maxHeight: "240px", display: "block" }}
            onError={(e) => console.error("[VC] Video error:", e)}
          />
          <button
            type="button"
            onClick={handleClearRecording}
            className="btn-secondary rounded-full px-3 py-2 text-xs font-semibold transition"
          >
            Clear Recording & Re-record
          </button>
        </div>
      )}
    </div>
  );
}
