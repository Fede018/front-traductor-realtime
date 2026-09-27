import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, History, MessageCircle } from "lucide-react";
import { ParticipantBar } from "../../components/ParticipantBar/ParticipantBar";
import { ConnectionBadge } from "../../components/ConnectionBadge/ConnectionBadge";
import { MessageBubble } from "../../components/MessageBubble/MessageBubble";
import { LiveTurn } from "../../components/LiveTurn/LiveTurn";
import { MicButton } from "../../components/MicButton/MicButton";
import type { MicVisualState } from "../../components/MicButton/MicButton";
import { ModeSwitch } from "../../components/ModeSwitch/ModeSwitch";
import type { InteractionMode } from "../../components/ModeSwitch/ModeSwitch";
import { HistorySheet } from "../../components/HistorySheet/HistorySheet";
import { RoomCodeCard } from "../../components/RoomCodeCard/RoomCodeCard";
import { useRoom } from "../../hooks/useRoom";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import type { InteractionState } from "../../hooks/useVoiceRecorder";
import { useRealtimeMode } from "../../hooks/useRealtimeMode";
import type { SessionIdentity } from "../../hooks/useSession";
import type { ConversationTurn } from "../../types/conversation";
import type { LanguageCode, LanguagePair } from "../../types/language";
import type { SpeakingState } from "../../types/room";
import styles from "./Conversation.module.css";

interface ConversationProps {
  roomCode: string;
  participantId: string;
  identity: SessionIdentity;
  onExit: () => void;
}

const RECENT_TURNS_LIMIT = 6;

const MANUAL_STATE_TO_SPEAKING: Record<InteractionState, SpeakingState> = {
  idle: "idle",
  recording: "recording",
  sending: "processing",
  sent: "idle",
  error: "idle",
};

const MANUAL_STATE_TO_MIC: Record<InteractionState, MicVisualState> = {
  idle: "idle",
  recording: "recording",
  sending: "processing",
  sent: "ready",
  error: "error",
};

export function Conversation({ roomCode, participantId, identity, onExit }: ConversationProps) {
  const [mode, setMode] = useState<InteractionMode>("manual");
  const [historyOpen, setHistoryOpen] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const {
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
  } = useRoom(roomCode, participantId);

  useEffect(() => {
    if (status === "connected") {
      updateProfile({ name: identity.name, language: identity.language ?? undefined, avatar: identity.avatar });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const myLanguage: LanguageCode = (me?.language ?? identity.language) as LanguageCode;
  const partnerLanguage = partner?.language ?? null;
  const partnerReady = Boolean(partner && partner.connected);

  const pair: LanguagePair = useMemo(
    () => ({ source: myLanguage, target: partnerLanguage ?? myLanguage }),
    [myLanguage, partnerLanguage]
  );

  const voice = useVoiceRecorder(pair);
  const realtime = useRealtimeMode(pair, participantId);

  // Turno manual completado → sala.
  useEffect(() => {
    if (!voice.uploadResult) return;
    const turn: ConversationTurn = {
      id: voice.uploadResult.id,
      speakerId: participantId,
      sourceLanguage: voice.uploadResult.sourceLanguage as LanguageCode,
      targetLanguage: voice.uploadResult.targetLanguage as LanguageCode,
      transcript: voice.uploadResult.transcript,
      translation: voice.uploadResult.translation,
      timestamp: new Date().toISOString(),
      mode: "manual",
      audioBase64: voice.uploadResult.translationAudioBase64,
    };
    sendTurn(turn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.uploadResult]);

  // Turno en tiempo real completado → sala.
  useEffect(() => {
    if (!realtime.completedTurn) return;
    sendTurn(realtime.completedTurn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtime.completedTurn]);

  // Estado de habla (manual) → sala.
  useEffect(() => {
    if (mode === "manual") sendSpeaking(MANUAL_STATE_TO_SPEAKING[voice.state]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, voice.state]);

  // Estado de habla + transcripción parcial (tiempo real) → sala.
  useEffect(() => {
    if (mode !== "realtime") return;
    if (realtime.status !== "active") {
      sendSpeaking("idle");
      return;
    }
    sendSpeaking(realtime.phase === "processing" ? "processing" : "live");
    sendLive(realtime.liveUserTranscript, realtime.liveTranslation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, realtime.status, realtime.phase, realtime.liveUserTranscript, realtime.liveTranslation]);

  // Al salir de tiempo real, apagar la conexión WebRTC.
  useEffect(() => {
    if (mode !== "realtime" && realtime.status !== "idle") {
      realtime.disable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  const recentTurns = turns.slice(-RECENT_TURNS_LIMIT);
  const hasMoreHistory = turns.length > RECENT_TURNS_LIMIT;

  const meSpeakingVisual =
    (mode === "manual" && (voice.state === "recording" || voice.state === "sending")) ||
    (mode === "realtime" && realtime.status === "active" && realtime.phase !== "listening");

  const showMineLive =
    (mode === "manual" && (voice.state === "recording" || voice.state === "sending")) ||
    (mode === "realtime" && realtime.status === "active" && (realtime.liveUserTranscript || realtime.liveTranslation || realtime.phase === "speaking"));

  const mineLiveLabel =
    mode === "manual"
      ? voice.state === "sending"
        ? "Procesando..."
        : "Escuchando..."
      : realtime.phase === "processing"
        ? "Traduciendo..."
        : "Escuchando...";

  const showPartnerLive = partnerSpeaking !== "idle";
  const partnerLiveLabel =
    partnerSpeaking === "processing" ? "Procesando..." : partnerSpeaking === "recording" ? "Escuchando..." : "Hablando...";

  const handleMicPress = () => {
    if (!partnerReady) return;
    if (voice.state === "recording") {
      voice.stopRecording();
    } else {
      voice.startRecording();
    }
  };

  const handleRealtimeToggle = () => {
    if (!partnerReady) return;
    if (realtime.status === "active" || realtime.status === "connecting") {
      realtime.disable();
    } else {
      realtime.enable();
    }
  };

  const realtimeMicState: MicVisualState =
    realtime.status === "connecting" ? "processing" : realtime.status === "active" ? "recording" : realtime.status === "error" ? "error" : "idle";

  const realtimeLabels =
    realtime.status === "active"
      ? { recording: "En vivo — tocá para detener" }
      : realtime.status === "connecting"
        ? { processing: "Conectando..." }
        : { idle: "Tocá para activar tiempo real", error: "Tocá para reintentar" };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.iconButton} onClick={onExit} aria-label="Salir de la conversación">
          <ArrowLeft size={19} />
        </button>

        <ParticipantBar me={me} partner={partner} meSpeaking={meSpeakingVisual} partnerSpeaking={partnerSpeaking !== "idle"} />

        <button type="button" className={styles.historyButton} onClick={() => setHistoryOpen(true)} aria-label="Ver historial">
          <History size={19} />
        </button>
      </header>

      <div className={styles.statusBar}>
        <ConnectionBadge status={status} realtimeActive={mode === "realtime" && realtime.status === "active"} onReconnect={reconnect} />
      </div>

      <main className={styles.main}>
        {!partnerReady ? (
          <div className={styles.waiting}>
            <p className={styles.waitingTitle}>Esperando al otro participante...</p>
            <RoomCodeCard code={roomCode} compact />
          </div>
        ) : (
          <div className={styles.feed}>
            {recentTurns.length === 0 && !showMineLive && !showPartnerLive ? (
              <div className={styles.emptyState}>
                <MessageCircle size={26} strokeWidth={1.5} />
                <p>Todo listo. Tocá el micrófono para empezar a hablar.</p>
              </div>
            ) : (
              <>
                {hasMoreHistory && (
                  <button type="button" className={styles.viewHistoryLink} onClick={() => setHistoryOpen(true)}>
                    Ver historial completo
                  </button>
                )}
                {recentTurns.map((turn) => (
                  <MessageBubble
                    key={turn.id}
                    turn={turn}
                    speaker={participants.find((p) => p.id === turn.speakerId) ?? null}
                    isMine={turn.speakerId === participantId}
                    autoPlay={turn.id === latestIncomingTurnId && turn.targetLanguage === myLanguage}
                  />
                ))}
                {showPartnerLive && (
                  <LiveTurn speaker={partner} isMine={false} statusLabel={partnerLiveLabel} transcript={partnerLive.transcript} translation={partnerLive.translation} />
                )}
                {showMineLive && (
                  <LiveTurn
                    speaker={me}
                    isMine
                    statusLabel={mineLiveLabel}
                    transcript={mode === "realtime" ? realtime.liveUserTranscript : ""}
                    translation={mode === "realtime" ? realtime.liveTranslation : ""}
                  />
                )}
              </>
            )}
            <div ref={feedEndRef} />
          </div>
        )}
      </main>

      <div className={styles.dock}>
        <ModeSwitch mode={mode} onChange={setMode} disabled={!partnerReady} />
        {mode === "manual" ? (
          <MicButton state={partnerReady ? MANUAL_STATE_TO_MIC[voice.state] : "idle"} onPress={handleMicPress} />
        ) : (
          <MicButton state={realtimeMicState} onPress={handleRealtimeToggle} labels={realtimeLabels} />
        )}
        {!partnerReady && <p className={styles.dockHint}>Esperando a que se una la otra persona...</p>}
      </div>

      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} turns={turns} participants={participants} myId={participantId} />
    </div>
  );
}
