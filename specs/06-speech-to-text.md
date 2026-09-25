# SPEC 06 — Speech-to-Text (OpenAI Whisper)

> **Status:** Draft
> **Depends on:** SPEC 05
> **Date:** 2026-09-25
> **Objective:** Transcribir el audio recibido en `POST /api/audio` usando la API de OpenAI (`whisper-1`) y devolver el texto real en la misma respuesta, sin traducir todavía.

## Scope

**In:**

- Cliente HTTP hacia `https://api.openai.com/v1/audio/transcriptions` (modelo `whisper-1`) usando `RestClient` de Spring (ya incluido en `spring-boot-starter-webmvc`, sin dependencias nuevas).
- `AudioService` invoca la transcripción después de validar el audio, pasando `sourceLanguage` como pista de idioma a Whisper.
- Campo `transcript` agregado a `AudioUploadResponse` (SPEC 05) — misma request, sin endpoint nuevo.
- Manejo de errores del STT: `500` con `ProblemDetail` si OpenAI falla, hace timeout, o la API key falta/es inválida.
- `OPENAI_API_KEY` como variable de entorno, nunca committeada.
- Frontend: mostrar la transcripción real en el panel de conversación (lado "Vos"), reemplazando el placeholder vacío de SPEC 05.

**Out of scope (para specs futuros):**

- Traducción del texto transcripto (SPEC 07).
- Text-to-Speech (SPEC 08).
- Persistir audio o transcripciones (ni en el backend ni en el frontend).
- Procesamiento asíncrono / colas para la llamada a OpenAI — se hace síncrono dentro del mismo request.
- Reintentos automáticos si OpenAI falla.
- Cambiar de proveedor de STT (whisper.cpp local, servicio propio) — evaluado y descartado para esta etapa.

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
    String transcript   // nuevo: texto transcripto por Whisper
) {}
```

```java
// exception/SttException.java
public class SttException extends RuntimeException {
    public SttException(String message, Throwable cause) { super(message, cause); }
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
}
```

## Implementation plan

1. **Config.** En `application.properties`, agregar `openai.api-key=${OPENAI_API_KEY}` y `openai.stt.model=whisper-1`. Verificación: `mvn -q compile` sin errores; la app no arranca si `OPENAI_API_KEY` no está seteada (falla rápido y explícito, no en silencio).
2. **Excepción de dominio.** Crear `src/main/java/backtraduct/example/traductor/exception/SttException.java` (como arriba).
3. **Cliente OpenAI.** Crear paquete `client` y `src/main/java/backtraduct/example/traductor/client/OpenAiSttClient.java`. Método `transcribe(MultipartFile audio, String languageHint): String`. Arma request multipart a OpenAI (`file`, `model=whisper-1`, `language=languageHint`) con el header `Authorization: Bearer ${openai.api-key}`, usando `RestClient`. Parsea la respuesta JSON (`{ "text": "..." }`) y devuelve `text`. Cualquier fallo (status no-2xx, timeout, `IOException`) se envuelve y relanza como `SttException`.
4. **Ampliar el DTO.** Agregar el campo `transcript` a `AudioUploadResponse`.
5. **Conectar en `AudioService`.** Después de validar `audio`/idiomas (SPEC 05), llamar a `OpenAiSttClient.transcribe(audio, sourceLanguage)` y armar el `AudioUploadResponse` con el `transcript` real. Verificación: `curl -F "audio=@sample.webm" -F sourceLanguage=es -F targetLanguage=pt http://localhost:8080/api/audio`, el campo `transcript` de la respuesta coincide con lo dicho en `sample.webm`.
6. **Manejo de errores.** Ampliar `GlobalExceptionHandler` con `@ExceptionHandler(SttException.class)` → `500` `ProblemDetail` con detail `"No se pudo transcribir el audio"` (sin exponer el mensaje interno de OpenAI/stacktrace). Verificación: con `OPENAI_API_KEY` inválida, la request devuelve `500` en vez de tumbar el proceso.
7. **Frontend: tipo ampliado.** Agregar `transcript: string` a la interfaz `AudioUploadResponse` en `src/api/audioClient.ts`.
8. **Frontend: mostrar transcripción.** En `ConversationPanel`, cuando `state === "sent"`, mostrar `uploadResult.transcript` como texto auxiliar en el bloque "Vos", junto al botón "Reproducir audio" ya existente.
9. **Verificación end-to-end.** Con backend y frontend corriendo y `OPENAI_API_KEY` configurada: grabar una frase real, soltar el botón, ver la transcripción exacta aparecer en pantalla en unos segundos.

## Acceptance criteria

- [ ] `POST /api/audio` con un audio real devuelve `transcript` no vacío y coherente con lo dicho (verificación manual con audio de prueba).
- [ ] `sourceLanguage` se pasa como pista de idioma en la llamada a OpenAI.
- [ ] Si `OPENAI_API_KEY` falta, es inválida, o OpenAI no responde, el endpoint devuelve `500` con `ProblemDetail` claro, sin tumbar el backend ni exponer detalles internos del proveedor.
- [ ] El frontend muestra la transcripción real en el panel de conversación (lado "Vos") después de subir el audio.
- [ ] `mvn clean verify` (backend) y `npm run build` (frontend) pasan sin errores.
- [ ] La API key no está hardcodeada en ningún archivo versionado (solo referenciada vía `${OPENAI_API_KEY}`).

## Decisiones

- **Sí:** OpenAI API con modelo `whisper-1`. Motivo: cero infraestructura propia, buena precisión multi-idioma (ES/PT/EN/FR), acorde a esta etapa de "primer flujo completo" del roadmap (SPEC 06-08). Alternativas evaluadas: whisper.cpp local (gratis y offline, pero suma trabajo de infraestructura ahora) y servicio Python separado (más flexible a futuro, pero dos servicios para levantar en dev). Se puede reconsiderar en SPEC 10 si la latencia/costo se vuelve un problema.
- **Sí:** ampliar la respuesta de `POST /api/audio` con `transcript` en vez de un endpoint nuevo. Motivo: un solo viaje HTTP, más simple para el frontend, consistente con la decisión de SPEC 05.
- **Sí:** pasar `sourceLanguage` como hint de idioma a Whisper. Motivo: mejora precisión y velocidad, el dato ya viaja desde SPEC 05.
- **Sí:** `500 ProblemDetail` ante fallos del STT (no `201` con `transcript` null). Motivo: decisión explícita — un fallo real de transcripción debe ser visible para el usuario, no silencioso.
- **No:** persistir audio ni transcripciones. Motivo: sin necesidad todavía; el historial de conversación llega en SPEC 09.
- **No:** procesamiento asíncrono o colas para la llamada a OpenAI. Motivo: fuera de alcance en esta etapa; la latencia de `whisper-1` es aceptable en un request síncrono.

## Risks

| Risk | Mitigation |
|------|------------|
| `OPENAI_API_KEY` expuesta por error (commit, log) | Solo se lee de variable de entorno; nunca se loguea el valor completo; `.gitignore` ya cubre `.env` en el frontend, y la key del backend no vive en ningún archivo del repo. |
| Costo por uso de la API (facturación por minuto de audio) | Sin límite automático en este spec — a monitorear manualmente durante desarrollo; un límite de uso se evalúa si hace falta más adelante. |
| Latencia variable de OpenAI (audio largo, red lenta) | Aceptado en esta etapa (no hay SLA de tiempo real todavía); se revisa en SPEC 10. |
| Dependencia de internet — sin conexión, no hay transcripción | Aceptado: es la contrapartida elegida al descartar whisper.cpp local. |

## What is **not** in this spec

- Traducción del texto transcripto (SPEC 07).
- Text-to-Speech (SPEC 08).
- Persistencia de audio o transcripciones.
- Cambio de proveedor de STT.
- Procesamiento asíncrono / reintentos automáticos.

Cada uno de estos puntos, si se aborda, va en su propio spec.
