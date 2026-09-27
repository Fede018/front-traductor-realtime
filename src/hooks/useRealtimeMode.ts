import { useCallback, useEffect, useRef, useState } from "react";
import { createRealtimeSession } from "../api/realtimeClient";
import type { LanguagePair } from "../types/language";

export type RealtimeModeStatus = "idle" | "connecting" | "active" | "error";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export function useRealtimeMode(languagePair: LanguagePair) {
  const [status, setStatus] = useState<RealtimeModeStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const languagePairRef = useRef(languagePair);
  languagePairRef.current = languagePair;

  const cleanup = useCallback(() => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }
  }, []);

  const disable = useCallback(() => {
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const enable = useCallback(async () => {
    setStatus("connecting");
    setErrorMessage(null);

    try {
      const { source, target } = languagePairRef.current;
      const session = await createRealtimeSession(source, target);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      const audioElement = document.createElement("audio");
      audioElement.autoplay = true;
      audioElementRef.current = audioElement;
      peerConnection.ontrack = (event) => {
        audioElement.srcObject = event.streams[0];
      };

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sdpResponse = await fetch(`${REALTIME_CALLS_URL}?model=${session.model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${session.clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`No se pudo conectar con OpenAI Realtime (${sdpResponse.status})`);
      }

      const answerSdp = await sdpResponse.text();
      await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStatus("active");
    } catch (error) {
      cleanup();
      setErrorMessage(error instanceof Error ? error.message : "No se pudo activar el modo tiempo real.");
      setStatus("error");
    }
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { status, errorMessage, enable, disable };
}
