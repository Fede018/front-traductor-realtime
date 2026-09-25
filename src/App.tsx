import { useState } from "react";
import { ConversationPanel } from "./components/ConversationPanel/ConversationPanel";
import { LanguageSelector } from "./components/LanguageSelector/LanguageSelector";
import { MicButton } from "./components/MicButton/MicButton";
import { useMockVoiceInteraction } from "./hooks/useMockVoiceInteraction";
import type { LanguagePair } from "./types/language";
import styles from "./App.module.css";

function App() {
  const [pair, setPair] = useState<LanguagePair>({ source: "es", target: "pt" });
  const { state, result, startRecording, stopRecording } = useMockVoiceInteraction();

  return (
    <div className={styles.app}>
      <h1 className={styles.title}>Traductor</h1>
      <LanguageSelector pair={pair} onChange={setPair} />
      <MicButton state={state} onStart={startRecording} onStop={stopRecording} />
      <ConversationPanel state={state} result={result} />
    </div>
  );
}

export default App;
