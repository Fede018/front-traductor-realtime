import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioUploadResponse } from "../api/audioClient";
import { connect, onClose, onError, onResult, sendChunk, sendStart, sendStop } from "../api/audioSocket";
import type { LanguagePair } from "../types/language";

export type InteractionState =
  | "idle"
  | "recording"
  | "sending"
  | "sent"
  | "error";

export interface VoiceRecorderState {
  state: InteractionState;
  audioUrl: string | null; // se mantiene para reproducción local (SPEC 04)
  uploadResult: AudioUploadResponse | null;
  errorMessage: string | null;
}

const PREFERRED_MIME_TYPE = "audio/webm;codecs=opus";
const TIMESLICE_MS = 250;

export function useVoiceRecorder(
  languagePair: LanguagePair
): VoiceRecorderState & {
  startRecording: () => void;
  stopRecording: () => void;
} {
  const [state, setState] = useState<InteractionState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<AudioUploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const languagePairRef = useRef(languagePair);
  languagePairRef.current = languagePair;
  const turnInFlightRef = useRef(false);

  useEffect(() => {
    onResult((result) => {
      turnInFlightRef.current = false;
      setUploadResult(result);
      setState("sent");
    });

    onError((detail) => {
      turnInFlightRef.current = false;
      setErrorMessage(detail);
      setState("error");
    });

    onClose(() => {
      if (turnInFlightRef.current) {
        turnInFlightRef.current = false;
        setErrorMessage("Se cortó la conexión con el servidor. Volvé a intentar grabando de nuevo.");
        setState("error");
      }
    });
  }, []);

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

    connect()
      .then(() =>
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          const { source, target } = languagePairRef.current;
          sendStart(source, target);

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
              event.data.arrayBuffer().then((buffer) => sendChunk(buffer));
            }
          };

          mediaRecorder.onstop = () => {
            const blob = new Blob(chunksRef.current, {
              type: mediaRecorder.mimeType || PREFERRED_MIME_TYPE,
            });
            setAudioUrl(URL.createObjectURL(blob));
            setUploadResult(null);
            setState("sending");
            sendStop();
          };

          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.start(TIMESLICE_MS);
          turnInFlightRef.current = true;
          setState("recording");
        })
      )
      .catch(() => {
        setErrorMessage("No se pudo acceder al micrófono o al servidor de streaming.");
        setState("error");
      });
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  return { state, audioUrl, uploadResult, errorMessage, startRecording, stopRecording };
}
