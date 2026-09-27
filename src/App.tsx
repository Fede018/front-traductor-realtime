import { useEffect, useState } from "react";
import { Welcome } from "./screens/Welcome/Welcome";
import { CreateRoom } from "./screens/CreateRoom/CreateRoom";
import { JoinRoom } from "./screens/JoinRoom/JoinRoom";
import { Identity } from "./screens/Identity/Identity";
import { Conversation } from "./screens/Conversation/Conversation";
import { useSession } from "./hooks/useSession";
import { getRoom } from "./api/roomClient";

type Screen = "welcome" | "create" | "join" | "identity" | "conversation";

function App() {
  const { session, setRoomCode, setIdentity, reset } = useSession();
  const [screen, setScreen] = useState<Screen>("welcome");

  // Deep link (?room=ABC-742, típicamente desde el QR) o recarga en medio de una conversación.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");

    if (roomParam) {
      window.history.replaceState({}, "", window.location.pathname);
      getRoom(roomParam)
        .then((room) => {
          setRoomCode(room.code);
          setScreen(room.full ? "join" : "identity");
        })
        .catch(() => setScreen("join"));
      return;
    }

    if (session.roomCode && session.identity.name && session.identity.language) {
      setScreen("conversation");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExit = () => {
    reset();
    setScreen("welcome");
  };

  switch (screen) {
    case "create":
      return (
        <CreateRoom onReady={(code) => setRoomCode(code)} onContinue={() => setScreen("identity")} />
      );

    case "join":
      return (
        <JoinRoom
          initialCode={session.roomCode ?? ""}
          onJoined={(code) => {
            setRoomCode(code);
            setScreen("identity");
          }}
          onBack={() => setScreen("welcome")}
        />
      );

    case "identity":
      return (
        <Identity
          initialName={session.identity.name}
          initialLanguage={session.identity.language}
          initialAvatar={session.identity.avatar}
          onSubmit={({ name, language, avatar }) => {
            setIdentity({ name, language, avatar });
            setScreen("conversation");
          }}
        />
      );

    case "conversation":
      if (!session.roomCode || !session.identity.language) {
        setScreen("welcome");
        return null;
      }
      return (
        <Conversation
          roomCode={session.roomCode}
          participantId={session.participantId}
          identity={session.identity}
          onExit={handleExit}
        />
      );

    default:
      return <Welcome onCreate={() => setScreen("create")} onJoin={() => setScreen("join")} />;
  }
}

export default App;
