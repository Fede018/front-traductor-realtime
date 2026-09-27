import { useCallback, useEffect, useState } from "react";
import type { LanguageCode } from "../types/language";
import type { Avatar } from "../types/participant";
import { DEFAULT_AVATAR } from "../types/participant";

const STORAGE_KEY = "vocera-session:v1";

export interface SessionIdentity {
  name: string;
  language: LanguageCode | null;
  avatar: Avatar;
}

export interface Session {
  participantId: string;
  roomCode: string | null;
  identity: SessionIdentity;
}

function createParticipantId(): string {
  return crypto.randomUUID();
}

function defaultSession(): Session {
  return {
    participantId: createParticipantId(),
    roomCode: null,
    identity: { name: "", language: null, avatar: DEFAULT_AVATAR },
  };
}

function loadSession(): Session {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSession();
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed.participantId) return defaultSession();
    return {
      participantId: parsed.participantId,
      roomCode: parsed.roomCode ?? null,
      identity: {
        name: parsed.identity?.name ?? "",
        language: parsed.identity?.language ?? null,
        avatar: parsed.identity?.avatar ?? DEFAULT_AVATAR,
      },
    };
  } catch {
    return defaultSession();
  }
}

/** Identidad + sala del participante en este teléfono. Sin cuentas: vive en sessionStorage. */
export function useSession() {
  const [session, setSession] = useState<Session>(() => loadSession());

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // almacenamiento no disponible (privado/incógnito estricto): la sesión sigue en memoria
    }
  }, [session]);

  const setRoomCode = useCallback((roomCode: string | null) => {
    setSession((prev) => ({ ...prev, roomCode }));
  }, []);

  const setIdentity = useCallback((identity: Partial<SessionIdentity>) => {
    setSession((prev) => ({ ...prev, identity: { ...prev.identity, ...identity } }));
  }, []);

  const reset = useCallback(() => {
    setSession(defaultSession());
  }, []);

  return { session, setRoomCode, setIdentity, reset };
}
