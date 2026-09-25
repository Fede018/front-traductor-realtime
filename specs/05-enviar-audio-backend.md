# SPEC 05 — Enviar audio al backend

> **Status:** Aprobado
> **Depends on:** SPEC 02, SPEC 04
> **Date:** 2026-09-25
> **Objective:** Definir el contrato REST `POST /api/audio` y conectar el frontend para que, al soltar el botón de micrófono, el audio grabado se suba automáticamente al backend y este confirme la recepción, sin transcribir ni traducir todavía.

## Scope

**In:**

- Endpoint `POST /api/audio` en `back-traduct`, `multipart/form-data` con campos `audio` (archivo), `sourceLanguage`, `targetLanguage` (strings, ej. `"es"`, `"pt"`).
- Respuesta `201 Created` con confirmación de recepción: `{ id, receivedBytes, contentType, sourceLanguage, targetLanguage }`.
- Límite de tamaño de archivo: 10 MB (`spring.servlet.multipart.max-file-size`), con error controlado si se excede.
- Validación básica: `audio` no vacío, `sourceLanguage`/`targetLanguage` no vacíos → `400` con `ProblemDetail` si falla.
- Primeros paquetes `controller` y `service` en el backend (`AudioController`, `AudioService`), siguiendo la convención fijada en SPEC 02.
- Frontend: subida automática del audio grabado apenas se suelta el botón (en paralelo a la reproducción local ya existente de SPEC 04), con estados `sending`/`sent` visibles en la UI.
- `VITE_API_BASE_URL` como variable de entorno del frontend para la URL del backend.

**Out of scope (para specs futuros):**

- Speech-to-Text real sobre el audio recibido (SPEC 06).
- Traducción de texto (SPEC 07).
- Text-to-Speech de la respuesta (SPEC 08).
- Persistir el audio en disco/DB en el backend — se recibe, se mide, se descarta.
- Reintentos automáticos de subida ante fallo de red.
- Autenticación/autorización sobre el endpoint.

## Data model

Backend (`back-traduct`):

```java
// dto/AudioUploadResponse.java
public record AudioUploadResponse(
    UUID id,
    long receivedBytes,
    String contentType,
    String sourceLanguage,
    String targetLanguage
) {}
```

Frontend (`front-traduct`):

```ts
// src/api/audioClient.ts
export interface AudioUploadResponse {
  id: string;
  receivedBytes: number;
  contentType: string;
  sourceLanguage: string;
  targetLanguage: string;
}
```

```ts
// src/hooks/useVoiceRecorder.ts (ampliado)
export type InteractionState =
  | "idle"
  | "recording"
  | "sending"
  | "sent"
  | "error";

export interface VoiceRecorderState {
  state: InteractionState;
  audioUrl: string | null; // se mantiene para reproducción local (SPEC 04)
  uploadResult: AudioUploadResponse | null;
  errorMessage: string | null;
}
```

## Implementation plan

1. **Backend: límite de tamaño.** En `application.properties`, agregar `spring.servlet.multipart.max-file-size=10MB` y `spring.servlet.multipart.max-request-size=10MB`. Verificación: `mvn -q compile` sin errores.
2. **Backend: DTO.** Crear `src/main/java/backtraduct/example/traductor/dto/AudioUploadResponse.java` (record, como arriba).
3. **Backend: `AudioService`.** Crear `src/main/java/backtraduct/example/traductor/service/AudioService.java`. Método `receive(MultipartFile audio, String sourceLanguage, String targetLanguage)`: valida que `audio` no esté vacío y que ambos idiomas no sean blank (si fallan, lanza `IllegalArgumentException` con mensaje descriptivo); si son válidos, arma y devuelve `AudioUploadResponse` con `UUID.randomUUID()`, `audio.getSize()`, `audio.getContentType()`.
4. **Backend: `AudioController`.** Crear `src/main/java/backtraduct/example/traductor/controller/AudioController.java`. `POST /api/audio`, `@RequestParam("audio") MultipartFile audio`, `@RequestParam String sourceLanguage`, `@RequestParam String targetLanguage`, delega en `AudioService`, devuelve `201` con el DTO. Verificación: `curl -F "audio=@sample.webm" -F sourceLanguage=es -F targetLanguage=pt http://localhost:8080/api/audio` devuelve JSON con `id`, `receivedBytes`, `contentType`.
5. **Backend: errores específicos.** Ampliar `GlobalExceptionHandler` (SPEC 02) con `@ExceptionHandler(MaxUploadSizeExceededException.class)` → `413` `ProblemDetail`, y `@ExceptionHandler(IllegalArgumentException.class)` → `400` `ProblemDetail`. Verificación: request sin `audio` devuelve `400`; archivo >10MB devuelve `413`.
6. **Frontend: variable de entorno.** Crear `.env` en la raíz de `front-traduct` con `VITE_API_BASE_URL=http://localhost:8080`.
7. **Frontend: cliente HTTP.** Crear `src/api/audioClient.ts` con `uploadAudio(blob: Blob, sourceLanguage: LanguageCode, targetLanguage: LanguageCode): Promise<AudioUploadResponse>`, arma `FormData` (`audio`, `sourceLanguage`, `targetLanguage`) y hace `fetch(\`${import.meta.env.VITE_API_BASE_URL}/api/audio\`, { method: "POST", body: formData })`; si `!response.ok`, lanza error con el detalle del `ProblemDetail`.
8. **Frontend: `useVoiceRecorder` ampliado.** En el handler `onstop` (SPEC 04), después de generar `audioUrl`, pasar a `state: "sending"` y llamar `uploadAudio(...)`. Éxito → `uploadResult` seteado, `state: "sent"`. Falla → `state: "error"`, `errorMessage` con el detalle; `audioUrl` se conserva en ambos casos para poder reproducir lo grabado localmente.
9. **Frontend: UI.** Actualizar `MicButton` (`sending` → "Enviando...", `sent` → "Enviado, mantené para grabar de nuevo") y `ConversationPanel` (bloque "Vos" muestra spinner/label mientras `sending`, confirmación breve cuando `sent`, junto al botón "Reproducir audio" ya existente).
10. **Verificación end-to-end.** Con `mvn spring-boot:run` y `npm run dev` corriendo, grabar y soltar el botón: la pestaña de red muestra `POST http://localhost:8080/api/audio` con `201`, la UI pasa por `sending` → `sent`, y "Reproducir audio" sigue funcionando igual que en SPEC 04.

## Acceptance criteria

- [ ] `POST /api/audio` con `audio`, `sourceLanguage`, `targetLanguage` válidos devuelve `201` con `{ id, receivedBytes, contentType, sourceLanguage, targetLanguage }`.
- [ ] Falta de `audio` o idiomas vacíos devuelve `400` con `ProblemDetail`.
- [ ] Archivo mayor a 10 MB devuelve `413` con `ProblemDetail`.
- [ ] Al soltar el botón de micrófono en el frontend, el audio se sube automáticamente sin acción manual adicional.
- [ ] La UI muestra un estado visible mientras se sube (`sending`) y otro al confirmarse (`sent`).
- [ ] Si la subida falla (backend caído, red, etc.), la UI muestra el estado de error sin romper el resto de la pantalla, y el audio local sigue siendo reproducible.
- [ ] `mvn clean verify` (backend) y `npm run build` (frontend) pasan sin errores.
- [ ] El backend no persiste el audio en disco ni en base de datos — solo lo procesa en memoria durante el request.

## Decisiones

- **Sí:** `multipart/form-data` en vez de JSON+base64. Motivo: estándar para archivos, evita el overhead de base64, Spring lo soporta nativo.
- **Sí:** respuesta con metadata real (`id`, `receivedBytes`, `contentType`) en vez de `200` vacío. Motivo: da algo concreto para verificar el circuito completo sin inventar datos de IA falsos.
- **Sí:** subida automática al soltar el botón. Motivo: consistente con la filosofía de interacción por voz sin fricción del SPEC 01 — el usuario no debe tocar un botón extra para "enviar".
- **Sí:** límite de 10 MB. Motivo: cubre varios minutos de audio comprimido en opus sin permitir subidas descontroladas.
- **Sí:** `VITE_API_BASE_URL` como variable de entorno. Motivo: evita hardcodear la URL del backend, listo para cuando haya más de un entorno.
- **No:** persistir el audio recibido. Motivo: en esta etapa no hay nada que hacer con él todavía (STT llega en SPEC 06); persistirlo ahora sería trabajo sin uso.
- **No:** reintentos automáticos de subida. Motivo: no pedido, agrega complejidad de manejo de estado sin necesidad todavía.

## What is **not** in this spec

- Speech-to-Text (SPEC 06).
- Traducción de texto (SPEC 07).
- Text-to-Speech (SPEC 08).
- Persistencia del audio en el backend.
- Reintentos automáticos de subida ante fallos de red.
- Autenticación/autorización.

Cada uno de estos puntos, si se aborda, va en su propio spec.
