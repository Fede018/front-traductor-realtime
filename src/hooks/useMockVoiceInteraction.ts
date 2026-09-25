import { useCallback, useRef, useState } from "react";

export type InteractionState = "idle" | "recording" | "processing" | "result";

export interface MockResult {
  transcript: string; // ejemplo: "Hola, ¿cómo estás?"
  translation: string; // ejemplo: "Olá, como você está?"
}

const MOCK_RESULT: MockResult = {
  transcript: "Hola, ¿cómo estás?",
  translation: "Olá, como você está?",
};

const PROCESSING_DELAY_MS = 800;

export function useMockVoiceInteraction() {
  const [state, setState] = useState<InteractionState>("idle");
  const [result, setResult] = useState<MockResult | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startRecording = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setResult(null);
    setState("recording");
  }, []);

  const stopRecording = useCallback(() => {
    setState("processing");
    timeoutRef.current = setTimeout(() => {
      setResult(MOCK_RESULT);
      setState("result");
      timeoutRef.current = null;
    }, PROCESSING_DELAY_MS);
  }, []);

  return { state, result, startRecording, stopRecording };
}
