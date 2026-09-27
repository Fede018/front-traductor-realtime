import { apiUrl } from "./config";

interface ProblemDetail {
  detail?: string;
  title?: string;
}

export interface CreateRoomResponse {
  code: string;
  createdAt: string;
}

export interface RoomStatusResponse {
  code: string;
  participantCount: number;
  full: boolean;
}

async function readProblem(response: Response, fallback: string): Promise<never> {
  const problem: ProblemDetail = await response.json().catch(() => ({}));
  throw new Error(problem.detail || fallback);
}

export async function createRoom(): Promise<CreateRoomResponse> {
  const response = await fetch(apiUrl("/api/rooms"), { method: "POST" });
  if (!response.ok) {
    await readProblem(response, `No se pudo crear la conversación (${response.status})`);
  }
  return response.json();
}

export async function getRoom(code: string): Promise<RoomStatusResponse> {
  const response = await fetch(apiUrl(`/api/rooms/${encodeURIComponent(code)}`));
  if (!response.ok) {
    if (response.status === 404) {
      await readProblem(response, "No existe una conversación con ese código");
    }
    await readProblem(response, `No se pudo verificar la conversación (${response.status})`);
  }
  return response.json();
}
