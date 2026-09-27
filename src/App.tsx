import { useEffect, useState } from "react";
import { ConversationPanel } from "./components/ConversationPanel/ConversationPanel";
import { ConversationHistory } from "./components/ConversationHistory/ConversationHistory";
import { LanguageSelector } from "./components/LanguageSelector/LanguageSelector";
import { MicButton } from "./components/MicButton/MicButton";
import { useConversationHistory } from "./hooks/useConversationHistory";
import { useVoiceRecorder } from "./hooks/useVoiceRecorder";
import { useRealtimeMode } from "./hooks/useRealtimeMode";
import type { LanguageCode, LanguagePair } from "./types/language";
import styles from "./App.module.css";

function App() {
  const [pair, setPair] = useState<LanguagePair>({ source: "es", target: "pt" });
  const { state, audioUrl, uploadResult, errorMessage, startRecording, stopRecording } = useVoiceRecorder(pair);
  const { turns, appendTurn } = useConversationHistory();
  const realtimeMode = useRealtimeMode(pair);

  useEffect(() => {
    if (!uploadResult) return;
    appendTurn({
      id: uploadResult.id,
      sourceLanguage: uploadResult.sourceLanguage as LanguageCode,
      targetLanguage: uploadResult.targetLanguage as LanguageCode,
      transcript: uploadResult.transcript,
      translation: uploadResult.translation,
      timestamp: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadResult]);

  useEffect(() => {
    if (!realtimeMode.completedTurn) return;
    appendTurn(realtimeMode.completedTurn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeMode.completedTurn]);

  return (
    <div className={styles.app}>
      <h1 className={styles.title}>Traductor</h1>
      <LanguageSelector pair={pair} onChange={setPair} />
      <MicButton state={state} onStart={startRecording} onStop={stopRecording} />
      <ConversationPanel
        state={state}
        audioUrl={audioUrl}
        transcript={uploadResult?.transcript ?? null}
        translation={uploadResult?.translation ?? null}
        translationAudioBase64={uploadResult?.translationAudioBase64 ?? null}
        errorMessage={errorMessage}
      />
      <ConversationHistory turns={turns} />
    </div>
  );
}

export default App;
