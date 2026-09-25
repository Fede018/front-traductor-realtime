import type { LanguageCode } from "../types/language";

export interface AudioUploadResponse {
  id: string;
  receivedBytes: number;
  contentType: string;
  sourceLanguage: string;
  targetLanguage: string;
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
  formData.append("audio", blob);
  formData.append("sourceLanguage", sourceLanguage);
  formData.append("targetLanguage", targetLanguage);

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/audio`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const problem: ProblemDetail = await response.json().catch(() => ({}));
    throw new Error(problem.detail || `Error al subir el audio (${response.status})`);
  }

  return response.json();
}
