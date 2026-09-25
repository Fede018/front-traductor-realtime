import { useCallback, useRef, useState } from "react";

export type InteractionState = "idle" | "recording" | "ready" | "error";

export interface VoiceRecorderState {
  state: InteractionState;
  audioUrl: string | null;
  errorMessage: string | null;
}

const PREFERRED_MIME_TYPE = "audio/webm;codecs=opus";

export function useVoiceRecorder(): VoiceRecorderState & {
  startRecording: () => void;
  stopRecording: () => void;
} {
  const [state, setState] = useState<InteractionState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setErrorMessage("Tu navegador no soporta grabación de audio.");
      setState("error");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        chunksRef.current = [];

        const mimeType = MediaRecorder.isTypeSupported(PREFERRED_MIME_TYPE)
          ? PREFERRED_MIME_TYPE
          : undefined;

        const mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, {
            type: mediaRecorder.mimeType || PREFERRED_MIME_TYPE,
          });
          setAudioUrl(URL.createObjectURL(blob));
          setState("ready");
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setState("recording");
      })
      .catch(() => {
        setErrorMessage("No se pudo acceder al micrófono. Revisá los permisos.");
        setState("error");
      });
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  return { state, audioUrl, errorMessage, startRecording, stopRecording };
}
