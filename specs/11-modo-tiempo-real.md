# SPEC 11 — Modo tiempo real (OpenAI Realtime API)

> **Status:** Draft
> **Depends on:** SPEC 08, SPEC 09
> **Date:** 2026-09-25
> **Objective:** Agregar un modo alternativo "tiempo real" que usa la Realtime API de OpenAI vía WebRTC para traducir hablando mientras la persona todavía está hablando, sin tocar el modo clásico (SPEC 04-10) que sigue siendo el default.

## Por qué existe este spec

SPEC 10 solo cambió el transporte (WebSocket en vez de HTTP), pero el procesamiento seguía disparando recién al soltar el botón — no es "tiempo real" de verdad, porque la API de Whisper no soporta transcripción incremental. Lograr la experiencia real del roadmap ("🎤 hablando → traducción → 🔊 empieza a sonar" antes de terminar la frase) requiere un modelo distinto: la Realtime API de OpenAI, que escucha y responde en streaming bidireccional. Es un pivot de arquitectura grande, por eso queda como modo **alternativo y opt-in**, no como reemplazo del flujo ya construido y probado.

## Scope

**In:**

- Endpoint `POST /api/realtime/session` en el backend: crea una sesión Realtime en OpenAI (con instrucciones de "solo traducir, no conversar" y `turn_detection: server_vad`) y devuelve un `client_secret` efímero (corta duración), sin exponer nunca la `OPENAI_API_KEY` real al navegador.
- Frontend: toggle "Modo tiempo real" que, al activarse, abre una conexión **WebRTC directa** entre el navegador y OpenAI (usando el client secret efímero), manda el audio del micrófono como track nativo, y reproduce el audio traducido que llega como track remoto — sin pasar el audio por nuestro backend.
- Detección automática de fin de turno vía `server_vad` de OpenAI (sin mantener presionado ningún botón mientras el modo está activo).
- Transcripción y traducción parcial/final mostradas en pantalla en vivo (vía el data channel de la conexión WebRTC), como información auxiliar — igual que en el modo clásico (SPEC 01).
- Cada turno completado en modo tiempo real se agrega al mismo historial de SPEC 09 (mismo `ConversationTurn`, mismo `localStorage`).
- El modo clásico (SPEC 04-10) queda intacto y sigue siendo el default.

**Out of scope (para specs futuros):**

- Cambiar el par de idiomas en medio de una sesión activa — para cambiar hay que apagar el toggle, invertir el selector, y prender de nuevo (crea una sesión nueva).
- Reemplazar o eliminar el modo clásico.
- Usar el WebSocket manual de SPEC 10 para este camino (la conexión a la Realtime API es WebRTC directo, un camino separado).
- Persistir el audio de las sesiones en tiempo real.
- Multiplicar conexiones simultáneas / varios dispositivos en la misma sesión Realtime.

## Data model

Backend:

```java
// dto/RealtimeSessionResponse.java
public record RealtimeSessionResponse(
    String clientSecret,
    Instant expiresAt,
    String model
) {}

// exception/RealtimeSessionException.java
public class RealtimeSessionException extends RuntimeException {
    public RealtimeSessionException(String message, Throwable cause) { super(message, cause); }
}
```

Frontend:

```ts
// src/types/realtimeSession.ts
export interface RealtimeSessionResponse {
  clientSecret: string;
  expiresAt: string; // ISO 8601
  model: string;
}
```

Los turnos generados en este modo usan el mismo `ConversationTurn` de SPEC 09 (`id` generado client-side con `crypto.randomUUID()`, ya que no hay un `AudioUploadResponse` del backend en este camino).

## Implementation plan

1. **Backend: config.** En `application.properties`, agregar `openai.realtime.model=gpt-4o-realtime-preview` y `openai.realtime.voice=alloy` (misma voz que SPEC 08, por consistencia).
2. **Backend: excepción.** Crear `src/main/java/backtraduct/example/traductor/exception/RealtimeSessionException.java`.
3. **Backend: DTO.** Crear `src/main/java/backtraduct/example/traductor/dto/RealtimeSessionResponse.java` (como arriba).
4. **Backend: cliente Realtime.** Crear `src/main/java/backtraduct/example/traductor/client/OpenAiRealtimeClient.java`. Método `createEphemeralSession(String sourceLanguage, String targetLanguage): RealtimeSessionResponse`. Llama al endpoint de creación de sesiones Realtime de OpenAI con `{ model, voice, turn_detection: { type: "server_vad" }, instructions: <prompt de intérprete> }`. El prompt es fijo y estricto: *"Sos un intérprete en tiempo real. No conversás, no respondés preguntas, no agregás comentarios propios. Tu única tarea es escuchar lo que se dice en {sourceLanguage} y decir en voz alta, inmediatamente, la traducción literal en {targetLanguage}. Nada más."* Devuelve el `client_secret` efímero recibido. Fallos → `RealtimeSessionException`.
5. **Backend: controller.** Crear `src/main/java/backtraduct/example/traductor/controller/RealtimeController.java`. `POST /api/realtime/session`, body `{ sourceLanguage, targetLanguage }`, delega en el cliente, devuelve `RealtimeSessionResponse`.
6. **Backend: manejo de errores.** Ampliar `GlobalExceptionHandler` con `@ExceptionHandler(RealtimeSessionException.class)` → `500` `ProblemDetail`.
7. **Backend: verificación.** `curl -X POST -H "Content-Type: application/json" -d '{"sourceLanguage":"es","targetLanguage":"pt"}' http://localhost:8080/api/realtime/session` devuelve un `clientSecret` no vacío.
8. **Frontend: tipos y cliente HTTP.** Crear `src/types/realtimeSession.ts` y `src/api/realtimeClient.ts` con `createRealtimeSession(sourceLanguage, targetLanguage): Promise<RealtimeSessionResponse>` (fetch al backend, mismo patrón que `audioClient.ts`).
9. **Frontend: hook `useRealtimeMode`.** Crear `src/hooks/useRealtimeMode.ts`. Al activar: pide el client secret al backend, `getUserMedia({ audio: true })`, crea `RTCPeerConnection`, agrega el track del micrófono, crea un data channel (`oai-events`) para recibir eventos de transcripción, genera el SDP offer y lo postea a la Realtime API de OpenAI con el client secret como Bearer token, aplica el SDP answer recibido (`setRemoteDescription`). El track remoto (`ontrack`) se conecta a un `<audio autoPlay>` oculto. Al desactivar: cierra la conexión, detiene los tracks del micrófono.
10. **Frontend: transcript en vivo.** Escuchar los eventos del data channel (transcripción parcial/final del usuario y de la traducción) y mostrarlos en pantalla mientras el modo está activo, como texto auxiliar.
11. **Frontend: integración con el historial.** Al completarse un turno (evento de fin de respuesta + transcripción de usuario correspondiente), armar un `ConversationTurn` (`id: crypto.randomUUID()`, par de idiomas activo, `transcript`, `translation`, `timestamp`) y `appendTurn()` al mismo historial de SPEC 09.
12. **Frontend: componente `RealtimeModeToggle`.** Crear `src/components/RealtimeModeToggle/RealtimeModeToggle.tsx` + `.module.css`. Switch on/off, muestra estado (conectando/activo/error) y el transcript en vivo mientras está activo.
13. **Verificación end-to-end.** Activar el toggle, hablar en español sin mantener nada presionado: la traducción en portugués empieza a sonar apenas OpenAI detecta una pausa (VAD), notablemente más rápido que el modo clásico. Al terminar, el turno aparece en el historial. Probar también deciendo algo tipo pregunta ("¿qué hora es?") y confirmar que la respuesta es la traducción literal, no una respuesta conversacional.

## Acceptance criteria

- [ ] `POST /api/realtime/session` devuelve un `clientSecret` efímero válido; la `OPENAI_API_KEY` real nunca llega al navegador.
- [ ] Activar el toggle abre una conexión WebRTC directa entre el navegador y OpenAI — el audio no pasa por nuestro backend.
- [ ] Con el toggle activo, hablar sin mantener ningún botón presionado dispara la traducción hablada automáticamente en cada pausa detectada por VAD.
- [ ] El modelo traduce literalmente y no responde preguntas ni conversa (verificado manualmente con al menos un caso de prueba).
- [ ] Cada turno completado en modo tiempo real se agrega al historial (SPEC 09), igual que los turnos del modo clásico.
- [ ] El modo clásico (SPEC 04-10) sigue funcionando exactamente igual, sin regresión.
- [ ] Si falla la creación de la sesión efímera (backend caído, key inválida), el toggle no se activa y muestra un error claro.
- [ ] Desactivar el toggle cierra la conexión WebRTC y libera el micrófono (no queda el ícono de "usando micrófono" activo).
- [ ] `mvn clean verify` (backend) y `npm run build` (frontend) pasan sin errores.

## Decisiones

- **Sí:** Realtime API con token efímero, conexión directa navegador→OpenAI. Motivo: seguridad equivalente al proxy (la key real nunca sale del backend), pero sin el salto de red extra que el proxy agregaría justo en el camino que este spec existe para acortar.
- **Sí:** WebRTC (no un WebSocket manual como SPEC 10) para la conexión navegador↔OpenAI. Motivo: es el transporte que OpenAI soporta oficialmente para clientes de navegador — maneja captura/reproducción de audio, cancelación de eco y codecs nativamente, evita reimplementar el chunking manual de SPEC 10 en este camino.
- **Sí:** modo alternativo con toggle, conviviendo con el flujo clásico. Motivo: no tirar lo construido y probado en SPEC 01-10; si este modo falla o resulta muy caro de usar, el modo clásico sigue disponible como default.
- **Sí:** `server_vad` + toggle on/off en vez de mantener presionado. Motivo: es la experiencia de "intérprete en vivo" que busca este spec; forzar mantener-presionado hubiera apagado el VAD automático sin necesidad real.
- **Sí:** system prompt estricto ("no conversar, solo traducir"). Motivo: riesgo conocido de que un modelo conversacional responda en vez de traducir — se deja explícito en las instrucciones y se verifica manualmente.
- **No:** permitir cambiar el par de idiomas en medio de una sesión activa. Motivo: las instrucciones del modelo se fijan al crear la sesión Realtime; cambiar de idioma implica apagar, invertir el selector, y prender de nuevo.
- **No:** persistir el audio de la sesión en tiempo real. Motivo: consistente con las decisiones de SPEC 05-10 — solo el texto (`transcript`/`translation`) queda en el historial.

## Risks

| Risk | Mitigation |
|------|------------|
| El modelo conversa en vez de traducir literalmente (el prompt no garantiza el comportamiento al 100%) | Verificación manual explícita en los criterios de aceptación; si falla seguido en uso real, se ajusta el prompt o se agregan restricciones en un spec de ajuste. |
| Costo de la Realtime API (factura por minuto de audio de entrada Y salida) más alto que STT+traducción+TTS por separado | Aceptado como modo experimental/opt-in vía toggle — el usuario elige cuándo pagar ese costo extra; el modo clásico sigue siendo el default gratuito en comparación. |
| Compatibilidad de WebRTC en redes con NAT restrictivo (ej. redes corporativas) | Riesgo bajo para desarrollo local; a revisar si se despliega en un entorno de producción real. |
| Token efímero interceptado durante su corta ventana de vida | Vida corta y alcance limitado a una sesión Realtime puntual; se transmite solo por HTTPS/WSS. |

## What is **not** in this spec

- Cambio de idioma en medio de una sesión activa.
- Reemplazo del modo clásico (SPEC 04-10).
- Uso del WebSocket manual de SPEC 10 para este camino.
- Persistencia de audio de sesiones en tiempo real.
- Múltiples conexiones/dispositivos simultáneos en modo tiempo real.

Cada uno de estos puntos, si se aborda, va en su propio spec.
