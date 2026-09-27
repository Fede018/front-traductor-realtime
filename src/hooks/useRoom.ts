import { useCallback, useEffect, useRef, useState } from "react";
import { wsUrl } from "../api/config";
import type { ConversationTurn } from "../types/conversation";
import type { Avatar, Participant } from "../types/participant";
import type { LanguageCode } from "../types/language";
import type { RoomClientMessage, RoomServerMessage, SpeakingState } from "../types/room";

export type RoomConnectionStatus = "connecting" | "connected" | "reconnecting" | "lost";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 8000;
const PING_INTERVAL_MS = 20000;
const LIVE_THROTTLE_MS = 150;

interface LiveText {
  transcript: string;
  translation: string;
}

export function useRoom(roomCode: string | null, participantId: string) {
  const [status, setStatus] = useState<RoomConnectionStatus>("connecting");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [partnerSpeaking, setPartnerSpeaking] = useState<SpeakingState>("idle");
  const [partnerLive, setPartnerLive] = useState<LiveText>({ transcript: "", translation: "" });
  const [latestIncomingTurnId, setLatestIncomingTurnId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const liveThrottleRef = useRef<number | null>(null);
  const pendingLiveRef = useRef<LiveText | null>(null);
  const closedByUsRef = useRef(false);

  const send = useCallback((message: RoomClientMessage) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  const handleServerMessage = useCallback((message: RoomServerMessage) => {
    switch (message.type) {
      case "room.state":
        setParticipants(message.participants);
        setTurns(message.turns);
        break;
      case "participant.joined":
      case "participant.updated":
        setParticipants((prev) => {
          const exists = prev.some((p) => p.id === message.participant.id);
          return exists
            ? prev.map((p) => (p.id === message.participant.id ? message.participant : p))
            : [...prev, message.participant];
        });
        break;
      case "participant.left":
        setParticipants((prev) =>
          prev.map((p) => (p.id === message.participantId ? { ...p, connected: false } : p))
        );
        break;
      case "speaking":
        if (message.participantId !== participantId) {
          setPartnerSpeaking(message.state);
          if (message.state === "idle") {
            setPartnerLive({ transcript: "", translation: "" });
          }
        }
        break;
      case "live":
        if (message.participantId !== participantId) {
          setPartnerLive({ transcript: message.transcript, translation: message.translation });
        }
        break;
      case "turn":
        setTurns((prev) => [...prev, message.turn]);
        setPartnerLive({ transcript: "", translation: "" });
        setLatestIncomingTurnId(message.turn.id);
        break;
      default:
        break;
    }
  }, [participantId]);

  const connect = useCallback(() => {
    if (!roomCode) return;

    setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");
    closedByUsRef.current = false;

    const socket = new WebSocket(wsUrl(`/ws/room?code=${encodeURIComponent(roomCode)}&participantId=${encodeURIComponent(participantId)}`));
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      attemptRef.current = 0;
      setStatus("connected");
      pingTimerRef.current = window.setInterval(() => send({ type: "ping" }), PING_INTERVAL_MS);
    });

    socket.addEventListener("message", (event) => {
      try {
        handleServerMessage(JSON.parse(event.data) as RoomServerMessage);
      } catch {
        // mensaje no parseable: se ignora
      }
    });

    socket.addEventListener("close", () => {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      if (closedByUsRef.current) return;

      if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setStatus("lost");
        return;
      }

      setStatus("reconnecting");
      const delay = Math.min(BASE_BACKOFF_MS * 2 ** attemptRef.current, MAX_BACKOFF_MS);
      attemptRef.current += 1;
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, participantId, handleServerMessage]);

  useEffect(() => {
    if (!roomCode) return;
    attemptRef.current = 0;
    connect();

    return () => {
      closedByUsRef.current = true;
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current !== null) window.clearInterval(pingTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
    socketRef.current?.close();
    connect();
  }, [connect]);

  const updateProfile = useCallback(
    (profile: { name?: string; language?: LanguageCode; avatar?: Avatar }) => {
      send({ type: "profile", participant: profile });
    },
    [send]
  );

  const sendSpeaking = useCallback((state: SpeakingState) => send({ type: "speaking", state }), [send]);

  const sendLive = useCallback(
    (transcript: string, translation: string) => {
      pendingLiveRef.current = { transcript, translation };
      if (liveThrottleRef.current !== null) return;

      liveThrottleRef.current = window.setTimeout(() => {
        liveThrottleRef.current = null;
        if (pendingLiveRef.current) {
          send({ type: "live", transcript: pendingLiveRef.current.transcript, translation: pendingLiveRef.current.translation });
        }
      }, LIVE_THROTTLE_MS);
    },
    [send]
  );

  const sendTurn = useCallback(
    (turn: ConversationTurn) => {
      // Optimista: el servidor nunca reenvía el turno a quien lo mandó.
      setTurns((prev) => [...prev, turn]);
      send({ type: "turn", turn });
    },
    [send]
  );

  const me = participants.find((p) => p.id === participantId) ?? null;
  const partner = participants.find((p) => p.id !== participantId) ?? null;

  return {
    status,
    participants,
    me,
    partner,
    turns,
    partnerSpeaking,
    partnerLive,
    latestIncomingTurnId,
    sendTurn,
    sendSpeaking,
    sendLive,
    updateProfile,
    reconnect,
  };
}
