import {useCallback, useRef, useState} from "react";

export function useWebAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const audioBlobRef = useRef<Blob | null>(null);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    let mimeType = "audio/webm;codecs=opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/webm";
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/ogg;codecs=opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/ogg";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.addEventListener("dataavailable", (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    });

    recorder.addEventListener("stop", () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioBlobRef.current = blob; // <-- store blob immediately
      setIsRecording(false);
    });

    recorder.start(500);
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    return new Promise((resolve) => {
      recorder.addEventListener(
          "stop",
          () => {
            resolve(audioBlobRef.current);
          },
          { once: true }
      );
      recorder.stop();
    });
  }, []);

  const getRecordingUri = useCallback(async (): Promise<string | null> => {
    const blob = audioBlobRef.current;
    if (!blob) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }, []);

  const clearRecording = useCallback(() => {
    audioBlobRef.current = null;
    audioChunksRef.current = [];
  }, []);

  return {
    startRecording,
    stopRecording,
    getRecordingUri,
    clearRecording,
    isRecording,
  };
}
