import { useEffect, useState } from "react";
import type { ConversationTurn } from "../types/conversation";

const STORAGE_KEY = "conversation-history:v1";

function loadTurns(): ConversationTurn[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ConversationTurn[];
  } catch {
    return [];
  }
}

export function useConversationHistory() {
  const [turns, setTurns] = useState<ConversationTurn[]>(() => loadTurns());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(turns));
    } catch (error) {
      console.error("No se pudo guardar el historial en localStorage", error);
    }
  }, [turns]);

  function appendTurn(turn: ConversationTurn) {
    setTurns((prev) => [...prev, turn]);
  }

  return { turns, appendTurn };
}
