import { apiUrl } from "./config";
import type { LanguageCode } from "../types/language";

export interface AudioUploadResponse {
  id: string;
  receivedBytes: number;
  contentType: string;
  sourceLanguage: string;
  targetLanguage: string;
  transcript: string;
  translation: string;
  translationAudioBase64: string;
}

interface ProblemDetail {
  detail?: string;
  title?: string;
}

export async function uploadAudio(
  blob: Blob,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode
): Promise<AudioUploadResponse> {
  const formData = new FormData();
  formData.append("audio", blob, "audio.webm");
  formData.append("sourceLanguage", sourceLanguage);
  formData.append("targetLanguage", targetLanguage);

  const response = await fetch(apiUrl("/api/audio"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const problem: ProblemDetail = await response.json().catch(() => ({}));
    throw new Error(problem.detail || `Error al subir el audio (${response.status})`);
  }

  return response.json();
}
