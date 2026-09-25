# SPEC 08 — Text-to-Speech (OpenAI) — primer flujo completo

> **Status:** Draft
> **Depends on:** SPEC 07
> **Date:** 2026-09-25
> **Objective:** Generar el audio de la traducción con OpenAI TTS (`tts-1`), devolverlo en base64 en la misma respuesta y reproducirlo automáticamente en el frontend, cerrando el primer flujo completo voz→voz.

## Scope

**In:**

- Cliente hacia `https://api.openai.com/v1/audio/speech` (modelo `tts-1`, voz fija `alloy`), reusando la misma `RestClient` y `OPENAI_API_KEY` de SPEC 06/07.
- `AudioService` sintetiza el audio de `translation` después de obtenerla, y lo agrega a la respuesta como `translationAudioBase64` (mp3 codificado en base64).
- Validación: si `translation` viene vacía, no se llama al TTS — se falla explícitamente (mismo patrón que la validación de `transcript` vacío en SPEC 07).
- Manejo de errores: `500` con `ProblemDetail` si el TTS falla, mismo patrón que SPEC 06/07.
- Frontend: decodifica el audio recibido y lo reproduce **automáticamente** apenas llega la respuesta, con un botón "Reproducir traducción" de respaldo por si el navegador bloquea el autoplay.
- Con este spec queda cerrado el primer flujo funcional completo: habla en el idioma origen → transcripción → traducción → se escucha automáticamente en el idioma destino.

**Out of scope (para specs futuros):**

- Conversación bidireccional con historial de turnos (SPEC 09).
- Streaming / tiempo real (SPEC 10).
- Selección de voz distinta por idioma destino.
- Persistencia del audio generado (ni en backend ni en frontend, más allá de la reproducción inmediata).
- Endpoint binario separado para servir el audio (evaluado y descartado, ver Decisiones).

## Data model

Backend:

```java
// dto/AudioUploadResponse.java (ampliado)
public record AudioUploadResponse(
    UUID id,
    long receivedBytes,
    String contentType,
    String sourceLanguage,
    String targetLanguage,
    String transcript,
    String translation,
    String translationAudioBase64   // nuevo: mp3 de la traducción, codificado en base64
) {}
```

```java
// exception/TtsException.java
public class TtsException extends RuntimeException {
    public TtsException(String message) { super(message); }
    public TtsException(String message, Throwable cause) { super(message, cause); }
}
```

Frontend:

```ts
// src/api/audioClient.ts (ampliado)
export interface AudioUploadResponse {
  id: string;
  receivedBytes: number;
  contentType: string;
  sourceLanguage: string;
  targetLanguage: string;
  transcript: string;
  translation: string;
  translationAudioBase64: string; // mp3 en base64, decodificar antes de reproducir
}
```

## Implementation plan

1. **Config.** En `application.properties`, agregar `openai.tts.model=tts-1` y `openai.tts.voice=alloy`.
2. **Excepción de dominio.** Crear `src/main/java/backtraduct/example/traductor/exception/TtsException.java` (como arriba).
3. **Cliente TTS.** Crear `src/main/java/backtraduct/example/traductor/client/OpenAiTtsClient.java`. Método `synthesize(String text): byte[]`. `POST /v1/audio/speech` con `{ model: "tts-1", voice: "alloy", input: text }`, respuesta binaria (`audio/mpeg`) leída como `byte[]`. Cualquier fallo se relanza como `TtsException`.
4. **Ampliar el DTO.** Agregar `translationAudioBase64` a `AudioUploadResponse`.
5. **Validar `translation` no vacía.** En `AudioService`, antes de sintetizar, si `translation.isBlank()` lanzar `TtsException("No hay texto traducido para sintetizar")` sin llamar a OpenAI.
6. **Conectar en `AudioService`.** Sintetizar `translation`, codificar el resultado con `Base64.getEncoder().encodeToString(bytes)`, incluirlo en la respuesta. Verificación: `curl -F "audio=@sample_es.webm" -F sourceLanguage=es -F targetLanguage=pt http://localhost:8080/api/audio`, decodificar manualmente el campo `translationAudioBase64` (`base64 -d`) y confirmar que el mp3 resultante suena como la traducción.
7. **Manejo de errores.** Ampliar `GlobalExceptionHandler` con `@ExceptionHandler(TtsException.class)` → `500` `ProblemDetail` con detail `"No se pudo generar el audio de la traducción"`.
8. **Frontend: tipo ampliado.** Agregar `translationAudioBase64: string` a la interfaz `AudioUploadResponse`.
9. **Frontend: utilidad de decodificación.** Crear `src/utils/audio.ts` con `base64ToObjectUrl(base64: string, mimeType: string): string` (decodifica a `Uint8Array`, arma un `Blob`, devuelve `URL.createObjectURL(blob)`).
10. **Frontend: reproducción automática.** Al recibir `uploadResult` (estado `sent`), generar la object URL de `translationAudioBase64` (mime `audio/mpeg`) y reproducirla automáticamente vía un `<audio>` oculto. Agregar botón "Reproducir traducción" (ícono `Volume2`) en el bloque "Otra persona" del `ConversationPanel`, que reproduce la misma URL manualmente por si el autoplay fue bloqueado por el navegador.
11. **Verificación end-to-end completa.** Con backend y frontend corriendo: hablar en español, soltar el botón → en unos segundos se escucha automáticamente la traducción en portugués (o el par de idiomas seleccionado), sin ninguna acción manual además de soltar el micrófono.

## Acceptance criteria

- [ ] `POST /api/audio` devuelve `translationAudioBase64` no vacío, decodificable a un mp3 válido que suena como la traducción.
- [ ] Al recibir la respuesta en el frontend, el audio de la traducción se reproduce automáticamente sin acción manual del usuario.
- [ ] Existe un botón "Reproducir traducción" que reproduce el mismo audio manualmente, para el caso en que el navegador bloquee el autoplay.
- [ ] Si el TTS falla (API caída, key inválida, texto vacío), el endpoint devuelve `500` con `ProblemDetail` claro, sin tumbar el backend.
- [ ] `mvn clean verify` (backend) y `npm run build` (frontend) pasan sin errores.
- [ ] Flujo completo verificado manualmente: hablar en el idioma origen → se escucha automáticamente la traducción en el idioma destino, sin tocar nada más que el botón de micrófono.

## Decisiones

- **Sí:** OpenAI TTS (`tts-1`) en vez de Piper local u otro proveedor cloud. Motivo: mismo proveedor y misma `OPENAI_API_KEY` que STT/traducción, sin infraestructura nueva; Piper hubiera requerido instalar y gestionar 4 modelos de voz (uno por idioma), demasiado para esta etapa de "primer flujo funcional completo".
- **Sí:** audio en base64 dentro de la misma respuesta JSON, no un endpoint binario separado. Motivo: mantiene el diseño stateless ya establecido en SPEC 05-07 (todo en un solo request-response, nada se guarda en el backend); un endpoint separado hubiera obligado a cachear el audio generado en memoria hasta que el frontend lo pida.
- **Sí:** reproducción automática al recibir la respuesta. Motivo: coherente con el SPEC 01 ("Persona B escucha la traducción"), la interacción por voz no debe requerir un toque adicional para escuchar el resultado.
- **Sí:** voz fija `alloy` para todos los idiomas. Motivo: OpenAI TTS ajusta automáticamente la pronunciación según el idioma del texto de entrada; mapear una voz distinta por idioma es una mejora sin necesidad clara todavía.
- **No:** persistir el audio generado. Motivo: consistente con las decisiones de SPEC 05-07 de no guardar nada en el backend.

## Risks

| Risk | Mitigation |
|------|------------|
| Autoplay bloqueado por la política del navegador (algunos navegadores exigen interacción reciente) | Botón manual "Reproducir traducción" de respaldo; en la práctica el usuario acaba de interactuar (soltó el botón de micrófono), lo que suele habilitar el autoplay en Chrome/Firefox. |
| Tamaño de respuesta crece (audio + texto en la misma request) | Aceptado para audios cortos de conversación; se revisa si se vuelve un problema real de latencia. |
| Costo triplicado de OpenAI por request (STT + traducción + TTS) | Aceptado en esta etapa; a monitorear manualmente igual que en SPEC 06/07. |

## What is **not** in this spec

- Conversación bidireccional con historial de turnos (SPEC 09).
- Streaming / tiempo real (SPEC 10).
- Selección de voz por idioma.
- Persistencia del audio generado.

Cada uno de estos puntos, si se aborda, va en su propio spec.
