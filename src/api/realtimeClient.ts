import type { LanguageCode } from "../types/language";
import type { RealtimeSessionResponse } from "../types/realtimeSession";

interface ProblemDetail {
  detail?: string;
  title?: string;
}

export async function createRealtimeSession(
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode
): Promise<RealtimeSessionResponse> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/realtime/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceLanguage, targetLanguage }),
  });

  if (!response.ok) {
    const problem: ProblemDetail = await response.json().catch(() => ({}));
    throw new Error(problem.detail || `Error al crear la sesión de tiempo real (${response.status})`);
  }

  return response.json();
}
