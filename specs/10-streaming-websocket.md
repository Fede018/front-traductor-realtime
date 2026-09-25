# SPEC 10 — Transporte por WebSocket (streaming de audio)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-09-25
> **Objective:** Reemplazar el transporte HTTP POST del audio (SPEC 05) por streaming binario sobre WebSocket, para que la subida empiece mientras la persona todavía está hablando, sin cambiar todavía el momento en que se dispara el procesamiento (STT/traducción/TTS sigue disparando al soltar el botón).

## Por qué existe este spec

"Tiempo real" completo (transcripción incremental mientras la persona habla) es demasiado grande para un solo spec: toca captura incremental, transporte, STT en streaming y TTS en streaming a la vez, y la API de Whisper que ya usamos (SPEC 06) no soporta transcripción parcial. Este spec se queda solo con la parte de **transporte**: cambia cómo viaja el audio (streaming en vez de un blob completo al final), reduciendo la latencia percibida sin tocar el pipeline de IA. El pipeline realmente incremental queda para un spec futuro (SPEC 11, todavía sin definir).

## Scope

**In:**

- Endpoint WebSocket `/ws/audio` en el backend (`spring-boot-starter-websocket`, WebSocket plano, sin STOMP/SockJS).
- Protocolo de mensajes: `start` (JSON, con `sourceLanguage`/`targetLanguage`) → N chunks binarios de audio (~250ms cada uno) → `stop` (JSON) → el backend responde con un mensaje `result` (JSON, mismo contenido que `AudioUploadResponse`) o `error`.
- Refactor de `AudioService`: extraer la lógica de STT→traducción→TTS a un método interno reusado tanto por el `AudioController` REST (SPEC 05-08, sin cambios de comportamiento) como por el nuevo handler WebSocket.
- Frontend: `MediaRecorder` con `timeslice` de 250ms, cada chunk se manda por WebSocket apenas está disponible (no se espera a soltar el botón para empezar a subir).
- Conexión WebSocket persistente y reutilizada entre turnos (se abre una vez, no una conexión nueva por cada grabación).
- Estado de error + reintento manual si la conexión se corta a mitad de un turno.
- La reproducción local del propio audio (SPEC 04) sigue funcionando, reconstruida a partir de los chunks acumulados del lado del cliente.

**Out of scope (para specs futuros):**

- Pipeline realmente incremental: transcripción/traducción parcial mientras la persona sigue hablando — queda para un spec futuro (SPEC 11, todavía sin definir).
- Reconexión automática ante corte de la conexión.
- Eliminar el endpoint REST `POST /api/audio` — se mantiene intacto y funcional.
- Múltiples conexiones simultáneas / varios dispositivos conectados a la misma conversación.
- Cambios al contrato visible de `AudioUploadResponse` (mismos campos que SPEC 08, solo cambia cómo viaja el audio de entrada y cómo llega la respuesta).

## Data model

Mensajes cliente→servidor (WebSocket):

```ts
// TEXT, JSON
type ClientMessage =
  | { type: "start"; sourceLanguage: string; targetLanguage: string }
  | { type: "stop" };
// + mensajes BINARY crudos: cada uno es un chunk de audio (ArrayBuffer), sin envoltorio JSON
```

Mensajes servidor→cliente (WebSocket):

```ts
// TEXT, JSON
type ServerMessage =
  | ({ type: "result" } & AudioUploadResponse)  // mismo shape que SPEC 08
  | { type: "error"; detail: string };
```

Backend: `AudioService` gana un método interno reusable:

```java
// service/AudioService.java (refactor)
public AudioUploadResponse process(byte[] audioBytes, String contentType,
                                    String sourceLanguage, String targetLanguage) {
    // misma lógica de validación + STT + traducción + TTS de SPEC 05-08
}
```

`AudioController` (REST) pasa a extraer `bytes`/`contentType` del `MultipartFile` y delega en `process(...)`. El handler WebSocket acumula los chunks binarios recibidos en un buffer por sesión y, al llegar `stop`, llama a `process(...)` con el buffer completo.

## Implementation plan

1. **Backend: dependencia.** Agregar `spring-boot-starter-websocket` al `pom.xml`. Verificación: `mvn -q compile` sin errores.
2. **Backend: refactor `AudioService`.** Extraer el método `process(byte[] audioBytes, String contentType, String sourceLanguage, String targetLanguage): AudioUploadResponse` con la lógica ya existente (validación + STT + traducción + TTS de SPEC 05-08). Adaptar `AudioController` para extraer bytes/contentType del `MultipartFile` y delegar en `process(...)`. Verificación: `mvn clean verify` sigue en verde, el endpoint REST responde exactamente igual que antes (sin regresión).
3. **Backend: handler WebSocket.** Crear paquete `websocket` y `src/main/java/backtraduct/example/traductor/websocket/AudioStreamHandler.java`. Mantiene, por sesión, un buffer (`ByteArrayOutputStream`) y el par de idiomas recibido en `start`. `handleTextMessage`: parsea `start` (guarda idiomas, resetea buffer) o `stop` (llama a `AudioService.process(...)` con el buffer acumulado, envía `result` o `error` por el mismo socket). `handleBinaryMessage`: agrega los bytes al buffer de la sesión; si el acumulado supera 10MB (mismo límite de SPEC 05), corta con un mensaje `error` sin llamar a `process(...)`.
4. **Backend: config.** Crear `src/main/java/backtraduct/example/traductor/config/WebSocketConfig.java` — registra `AudioStreamHandler` en `/ws/audio`, orígenes permitidos `http://localhost:5173` (mismo criterio que CORS de SPEC 02).
5. **Backend: verificación manual.** Con un cliente WebSocket de prueba (ej. `wscat -c ws://localhost:8080/ws/audio`): mandar `start`, mandar los bytes de un archivo de audio en chunks, mandar `stop`, recibir el JSON `result` con `transcript`/`translation`/`translationAudioBase64` igual que en SPEC 08.
6. **Frontend: cliente WebSocket.** Crear `src/api/audioSocket.ts`: `connect()`, `sendStart(sourceLanguage, targetLanguage)`, `sendChunk(chunk: ArrayBuffer)`, `sendStop()`, `onResult(callback)`, `onError(callback)`. La conexión se abre una vez (lazy, en el primer `connect()`) y se reutiliza en turnos siguientes.
7. **Frontend: `useVoiceRecorder` sobre WebSocket.** Al iniciar grabación: asegurar la conexión abierta (`connect()` si hace falta), mandar `start`, y usar `mediaRecorder.start(250)` (con `timeslice`). En `ondataavailable`: cada chunk se manda por WebSocket (`sendChunk`) y se acumula también localmente (para reconstruir `audioUrl` de reproducción propia, SPEC 04). Al soltar: `mediaRecorder.stop()`, en `onstop` se manda `sendStop()` y pasa a `state: "sending"`.
8. **Frontend: recepción del resultado.** Al recibir `result` por WebSocket: mismo comportamiento que SPEC 08/09 (`state: "sent"`, autoplay de la traducción, turno agregado al historial). Al recibir `error` o si la conexión se corta a mitad de turno: `state: "error"`, con mensaje visible y posibilidad de reintentar (siguiente press del mic vuelve a intentar `connect()` si hace falta).
9. **Verificación end-to-end.** Con backend y frontend corriendo: grabar y soltar el mic, confirmar en la pestaña de red que la comunicación es por WebSocket (no hay más `POST /api/audio` disparado desde la UI), y que el resultado llega y se reproduce igual que en SPEC 08/09.

## Acceptance criteria

- [ ] El frontend abre una conexión WebSocket a `/ws/audio` y la reutiliza entre turnos (no abre una nueva por cada grabación).
- [ ] Al grabar y soltar el mic, el audio viaja como chunks binarios de ~250ms por WebSocket, no como un `POST` multipart.
- [ ] El backend responde por el mismo WebSocket con un mensaje `result` que incluye `transcript`/`translation`/`translationAudioBase64`, usando la misma lógica de SPEC 06-08.
- [ ] `POST /api/audio` (REST, SPEC 05-08) sigue funcionando exactamente igual que antes, sin regresión, aunque el frontend ya no lo use.
- [ ] Si la conexión se corta a mitad de un turno, la UI pasa a estado de error y permite reintentar grabando de nuevo.
- [ ] Un turno que acumula más de 10MB de audio recibe un mensaje `error` sin intentar procesarlo.
- [ ] La reproducción local del propio audio grabado (SPEC 04) sigue funcionando igual.
- [ ] `mvn clean verify` (backend) y `npm run build` (frontend) pasan sin errores.

## Decisiones

- **Sí:** WebSocket plano en vez de STOMP/SockJS. Motivo: canal punto a punto simple (un cliente, un turno a la vez), no hace falta el modelo pub/sub de STOMP.
- **Sí:** chunks de 250ms. Motivo: buen balance entre aprovechar el streaming y no saturar de mensajes al backend.
- **Sí:** mantener el endpoint REST intacto. Motivo: sirve para debug/pruebas manuales con `curl`, y evita romper lo ya construido y verificado en SPEC 05-08.
- **Sí:** extraer `AudioService.process(...)` reusado por REST y WebSocket. Motivo: evita duplicar la lógica de STT/traducción/TTS en dos lugares.
- **Sí:** reconexión manual (no automática) ante un corte. Motivo: pedido explícito del usuario, menor complejidad en esta etapa.
- **No:** pipeline incremental real (transcripción mientras la persona sigue hablando). Motivo: es un spec aparte (SPEC 11) — acá solo cambia el transporte, el procesamiento se sigue disparando al final del turno (`stop`).
- **No:** eliminar el endpoint REST. Motivo: no aporta nada eliminarlo ahora y sí se pierde una herramienta de debug simple.

## Risks

| Risk | Mitigation |
|------|------------|
| El WebSocket se corta en medio del audio y se pierde el turno | Estado de error explícito + reintento manual; el usuario vuelve a grabar. |
| El buffer de audio acumulado por sesión activa en el backend puede crecer si el turno es muy largo | Mismo límite de 10MB que SPEC 05, validado incrementalmente al recibir cada chunk binario. |
| Mezclar mensajes de texto (`start`/`stop`) y binarios (chunks) en la misma conexión requiere discriminar bien el tipo de mensaje | El campo `type` en los mensajes de texto los distingue claramente; los mensajes binarios nunca llevan ese envoltorio. |

## What is **not** in this spec

- Pipeline realmente incremental / transcripción parcial mientras se habla (SPEC 11, a definir).
- Reconexión automática.
- Eliminación del endpoint REST.
- Múltiples conexiones/dispositivos simultáneos sobre la misma conversación.

Cada uno de estos puntos, si se aborda, va en su propio spec.
