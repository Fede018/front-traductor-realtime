# SPEC 13 — Rediseño: conversación compartida entre dos teléfonos

> **Status:** Implementado
> **Depends on:** SPEC 01-11 (arquitectura, backend base, captura de audio, streaming, modo tiempo real)
> **Date:** 2026-09-27
> **Objective:** Reemplazar el modelo de "un solo dispositivo con selector de idioma" por una conversación compartida entre **dos teléfonos**: cada persona crea o se une a una sala temporal con código/QR, configura su identidad (nombre, avatar, idioma) y conversa en una pantalla tipo mensajería, con el modo manual y el modo tiempo real (SPEC 11) sincronizados entre ambos dispositivos.

## Por qué existe este spec

Hasta SPEC 11 la app asumía un solo teléfono con "Participante A" y "Participante B" fijos en la misma pantalla, y el par de idiomas se elegía con un selector manual. El caso de uso real es dos personas físicamente juntas, cada una con su propio teléfono, hablando su propio idioma. Este spec introduce el concepto de **sala temporal** (sin cuentas, sin login) para sincronizar identidad, presencia y turnos de conversación entre los dos dispositivos, y rediseña completamente el frontend sobre esa base.

## Scope

**In:**

- Backend: modelo de sala en memoria (`Room`/`Participant`), REST para crear/consultar sala, WebSocket de sala (`/ws/room`) que sincroniza identidad, estado de habla, transcripción parcial y turnos completados entre los dos participantes.
- Frontend: flujo completo `Welcome → CreateRoom/JoinRoom → Identity → Conversation`, con QR para unirse, identidad temporal (nombre + avatar genérico o foto + idioma), y pantalla de conversación tipo mensajería.
- Reconexión automática del WebSocket de sala con backoff, indicador de estado de conexión.
- Integración de modo manual (SPEC 09/10) y modo tiempo real (SPEC 11) con la sala: cada turno completado (de cualquiera de los dos modos) se sincroniza al otro teléfono.
- Rediseño visual completo (mobile-first, tokens de diseño, dark mode, dos acentos de color por participante).
- Extensión de idiomas soportados (es/pt/en/fr/it/de) sin hardcodear el par es↔pt en ningún componente.

**Out of scope (para specs futuros):**

- Persistencia de salas más allá de la memoria del proceso backend (se pierden al reiniciar el backend).
- Cuentas, login o identidad permanente entre conversaciones.
- Más de dos participantes por sala.
- Reproducir el audio traducido del modo tiempo real en el teléfono del oyente (queda sonando en el teléfono de quien habla, como ya hacía SPEC 11 — decisión explícita de este spec, ver Decisiones).
- Mostrar la identidad del otro participante durante la pantalla de `Identity` antes de entrar a la conversación (se ve recién en `Conversation`, al conectar el WebSocket).

## Data model

Backend (`C:\Java\back-traduct`, paquete `backtraduct.example.traductor.room`):

```java
// room/Participant.java
public class Participant {
    String id, slot; // slot: "a" (creador) | "b" (segundo)
    String name, language;
    Object avatar;   // { kind: "generic", variant } | { kind: "photo", dataUrl }
    boolean connected;
}

// room/Room.java
public class Room {
    String code;           // "ABC-742"
    Instant createdAt, lastActivity;
    Map<String, Participant> participants; // máx. 2
    List<Map<String, Object>> turns;       // cap 200, sin audioBase64
}
```

```java
// dto expuestos por RoomController
public record CreateRoomResponse(String code, Instant createdAt) {}
public record RoomStatusResponse(String code, int participantCount, boolean full) {}
```

Frontend (`C:\react\front-traduct\src\types`):

```ts
// participant.ts
export type Avatar = { kind: "generic"; variant: number } | { kind: "photo"; dataUrl: string };
export interface Participant { id: string; name: string | null; language: LanguageCode | null; slot: "a" | "b"; avatar: Avatar | null; connected: boolean; }

// conversation.ts (extiende SPEC 09)
export interface ConversationTurn {
  id: string; speakerId: string; sourceLanguage: LanguageCode; targetLanguage: LanguageCode;
  transcript: string; translation: string; timestamp: string;
  mode: "manual" | "realtime"; audioBase64?: string | null;
}

// room.ts — protocolo WebSocket
type RoomClientMessage =
  | { type: "profile"; participant: Partial<Pick<Participant, "name" | "language" | "avatar">> }
  | { type: "speaking"; state: "idle" | "recording" | "processing" | "live" }
  | { type: "live"; transcript: string; translation: string }
  | { type: "turn"; turn: ConversationTurn }
  | { type: "ping" };

type RoomServerMessage =
  | { type: "room.state"; selfId: string; participants: Participant[]; turns: ConversationTurn[] }
  | { type: "participant.joined" | "participant.updated"; participant: Participant }
  | { type: "participant.left"; participantId: string }
  | { type: "speaking"; participantId: string; state: SpeakingState }
  | { type: "live"; participantId: string; transcript: string; translation: string }
  | { type: "turn"; turn: ConversationTurn }
  | { type: "pong" };
```

## Implementation plan

### Backend

1. **Modelo de sala.** `room/Participant.java`, `room/Room.java` (turnos guardados sin `audioBase64`, cap 200), `room/RoomService.java` (`ConcurrentHashMap<String, Room>`, generación de código 3 letras sin I/O + 3 dígitos, purga lazy de salas inactivas >2h, asignación de slot a/b, reconexión por mismo `participantId`).
2. **Excepciones.** `exception/RoomNotFoundException.java` (404), `exception/RoomFullException.java` (409), agregadas a `GlobalExceptionHandler`.
3. **REST.** `controller/RoomController.java`: `POST /api/rooms` → `CreateRoomResponse`; `GET /api/rooms/{code}` → `RoomStatusResponse` (404 si no existe).
4. **WebSocket de sala.** `websocket/RoomHandler.java` (`TextWebSocketHandler`), ruta `/ws/room?code=...&participantId=...`. Maneja `profile`/`speaking`/`live`/`turn`/`ping` del cliente y emite `room.state` (al conectar), `participant.joined/updated/left`, `speaking`, `live`, `turn`, `pong`. Sesiones envueltas en `ConcurrentWebSocketSessionDecorator` para envíos concurrentes seguros.
5. **Config.** `config/WebSocketConfig.java` registra `RoomHandler` en `/ws/room` junto al `AudioStreamHandler` existente, con `ServletServerContainerFactoryBean` a 512KB de buffer (fotos + audio TTS en base64). Nueva propiedad `app.allowed-origin-patterns` (incluye patrón LAN `https://192.168.*.*:5173`) usada en `CorsConfig`, `WebSocketConfig` y `management.endpoints.web.cors.allowed-origin-patterns`, reemplazando los `allowedOrigins` fijos a `localhost:5173`.
6. **Verificación manual.** `curl -X POST http://localhost:8080/api/rooms` → código; `curl http://localhost:8080/api/rooms/{code}` → estado; script Node con `WebSocket` nativo simulando dos participantes conectados a `/ws/room` confirmó: `room.state` al join, `participant.joined`/`updated`, relay de `speaking` y `turn` (con `audioBase64`) al otro participante, y `participant.left` al desconectar.

### Frontend

7. **Infra.** Dependencias `qrcode.react` y `@vitejs/plugin-basic-ssl`. `vite.config.ts`: `server.host: true`, HTTPS local, proxy `/api` y `/ws` → `http://localhost:8080`. `src/api/config.ts` (`apiUrl`/`wsUrl`) resuelve por `VITE_API_BASE_URL` si está seteada, o rutas relativas contra `window.location` (necesario para evitar mixed-content al servir por HTTPS en LAN). `.env` del frontend quedó con `VITE_API_BASE_URL` vacío.
8. **Tipos.** `types/language.ts` ampliado a 6 idiomas con bandera y `getLanguage()`; `types/participant.ts`, `types/room.ts` nuevos; `types/conversation.ts` extendido con `speakerId`/`mode`/`audioBase64`.
9. **API/hooks.** `api/roomClient.ts` (`createRoom`, `getRoom`). `hooks/useSession.ts` (identidad + `participantId` en `sessionStorage`). `hooks/useRoom.ts`: dueño del WebSocket de sala, estado `connecting/connected/reconnecting/lost`, backoff 1s→8s (5 intentos), ping cada 20s, `sendTurn` optimista (el turno propio se agrega localmente porque el backend nunca lo reenvía al emisor), `sendSpeaking`, `sendLive` (throttle 150ms), `updateProfile`. `hooks/useVoiceRecorder.ts` sin cambios de lógica. `hooks/useRealtimeMode.ts` ampliado con `phase` (listening/speaking/processing, derivado de eventos `input_audio_buffer.speech_started/stopped` y `response.created`) y `speakerId`/`mode: "realtime"` en el turno completado. Se eliminó `useConversationHistory.ts` (el historial ahora es el estado de la sala, no `localStorage`).
10. **Utilidad de imagen.** `utils/image.ts#fileToSquareDataUrl`: recorta al cuadrado y reescala a 256px JPEG para fotos de perfil.
11. **Componentes nuevos.** `Avatar`, `ParticipantBar`, `MessageBubble`, `AudioPlayButton`, `LiveTurn`, `MicButton` (rehecho: tap-to-toggle en vez de mantener presionado), `ModeSwitch`, `ConnectionBadge`, `Sheet` (bottom sheet mobile / drawer lateral ≥900px), `HistorySheet`, `RoomCodeCard` (código + QR + compartir), `LanguagePicker`, `Button`. Eliminados: `ConversationPanel`, `ConversationHistory`, `LanguageSelector`, `RealtimeModeToggle`.
12. **Pantallas.** `screens/Welcome`, `screens/CreateRoom` (crea sala al montar, muestra código/QR), `screens/JoinRoom` (input con auto-formato `ABC-742`, valida contra `GET /api/rooms/{code}`), `screens/Identity` (nombre, selector de avatar genérico/foto, grilla de idiomas), `screens/Conversation` (pantalla principal: header con `ParticipantBar` + `ConnectionBadge` + botón historial, feed de `MessageBubble`/`LiveTurn`, dock con `ModeSwitch` + `MicButton`, estado de espera con `RoomCodeCard` compacto si el otro participante no llegó).
13. **App.tsx.** Reescrito como máquina de estados simple (`welcome | create | join | identity | conversation`), sin router. Detecta `?room=CODE` (deep link del QR) y valida antes de saltar a `identity`; si hay sesión previa completa en `sessionStorage`, retoma directo en `conversation`.
14. **Sistema visual.** `index.css` reescrito con tokens (`--accent-a`/`--accent-b` con variantes `-soft`/`-line`, aplicados vía `[data-slot="a"|"b"]`), dark mode con `prefers-color-scheme`, `env(safe-area-inset-*)`, tipografía Inter única (se sacó Fraunces de `index.html`), `viewport-fit=cover` y `theme-color`.
15. **Verificación.** `npx tsc -b` y `npm run build` sin errores; `npm run lint` (oxlint) sin errores (solo warnings preexistentes del mismo patrón que ya tenía el código en `useVoiceRecorder`/`useRealtimeMode`, no introducidos por este spec salvo uno análogo en `AudioPlayButton`).

## Acceptance criteria

- [x] `POST /api/rooms` crea una sala y devuelve un código con formato `ABC-742`.
- [x] `GET /api/rooms/{code}` devuelve 404 si no existe, y `full: true` si ya tiene 2 participantes.
- [x] `/ws/room?code=...&participantId=...` sincroniza `room.state`, altas/bajas de participante, `profile`, `speaking`, `live` y `turn` entre los dos teléfonos conectados a la misma sala (verificado con script de prueba de dos clientes).
- [x] El audio (`audioBase64`) de un turno manual se relaya solo al participante que no lo generó, y no queda persistido en el historial de la sala.
- [x] El frontend permite crear una sala con QR, unirse escaneándolo o tipeando el código, configurar nombre/avatar/idioma, y entrar a una conversación compartida.
- [x] La pantalla de conversación distingue visualmente quién habla (avatar con pulso + acento de color por participante) y qué idioma usa cada uno.
- [x] Modo manual y modo tiempo real (SPEC 11) conviven con el mismo lenguaje visual y ambos sincronizan sus turnos completados a la sala.
- [x] Ante corte de conexión, el frontend reintenta con backoff y muestra "Reconectando..." / "Conexión perdida" con botón de reconexión manual.
- [x] El historial completo es accesible desde un botón en el header sin ocupar espacio permanente en la pantalla principal.
- [x] La UI es mobile-first (safe areas, targets táctiles ≥44px, mic de 84px) y se adapta a pantallas ≥900px sin estirar el layout mobile.
- [x] `npx tsc -b`, `npm run build` y `npm run lint` (frontend) pasan sin errores; `mvn compile` (backend) pasa sin errores.

## Decisiones

- **Sí:** salas en memoria (`ConcurrentHashMap`), sin base de datos. Motivo: conversación temporal por diseño (brief explícito de "sin login, sin cuentas permanentes"); consistente con el resto del backend, que tampoco persiste nada.
- **Sí:** audio del modo tiempo real sigue sonando en el teléfono de quien habla (no se reenvía al oyente). Motivo: decisión explícita del usuario — cambiar esto requeriría reenviar el audio TTS de OpenAI hacia el otro teléfono (relay de audio en tiempo real), una complejidad de arquitectura que no se justificaba para este spec dado que ambos participantes están físicamente juntos.
- **Sí:** `MicButton` tap-to-toggle en vez de mantener presionado. Motivo: decisión explícita del usuario para evitar activaciones accidentales; más consistente además con el modo tiempo real, que ya era on/off.
- **Sí:** reemplazar el WIP sin commitear que ya existía en el working tree del frontend en vez de integrarlo. Motivo: decisión explícita del usuario; el WIP no cubría el modelo de sala compartida.
- **No:** mostrar la identidad del otro participante en la pantalla `Identity` antes de conectar el WebSocket. Motivo: el endpoint REST de sala solo expone `participantCount`/`full`, no los datos de identidad; agregarlo hubiera requerido un endpoint adicional fuera del alcance acordado. Se ve apenas se entra a `Conversation`.
- **Sí:** turno propio agregado de forma optimista en `useRoom` (no espera eco del servidor). Motivo: el backend explícitamente no reenvía el turno a quien lo originó (solo al otro participante); sin esto el propio emisor nunca vería su turno en pantalla.
- **Sí:** extender los idiomas soportados a 6 (es/pt/en/fr/it/de) sin cambiar el modelo. Motivo: el backend ya aceptaba cualquier código de idioma (SPEC 01); era una lista de UI, no una limitación de arquitectura.

## Risks

| Risk | Mitigation |
| --- | --- |
| Backend reiniciado pierde todas las salas activas en memoria | Aceptado, consistente con el resto del sistema (sin persistencia); a futuro, un spec de persistencia podría cubrirlo si se despliega en producción. |
| `allowedOriginPatterns` con wildcard de IP (`https://192.168.*.*:5173`) puede no cubrir todos los rangos de red doméstica/corporativa | Documentado como necesario ajustar el patrón según la red real al probar en LAN; no bloquea el uso en `localhost`. |
| Certificado self-signed de `@vitejs/plugin-basic-ssl` requiere aceptar advertencia del navegador en cada teléfono | Aceptado para desarrollo local; un despliegue real usaría un certificado válido. |
| Mensajes WebSocket de sala sin autenticación (cualquiera con el código puede unirse) | Aceptado por diseño (brief pide "sin cuentas"); el código de sala de 6 caracteres cumple el rol de secreto compartido de corta duración. |

## What is **not** in this spec

- Persistencia de salas fuera de la memoria del proceso.
- Más de dos participantes por sala.
- Reenvío del audio de tiempo real al teléfono del oyente.
- Autenticación o cuentas de usuario.
- Mostrar identidad del otro participante antes de conectar a la sala.

Cada uno de estos puntos, si se aborda, va en su propio spec.
