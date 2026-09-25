# SPEC 07 — Traducción de texto (OpenAI)

> **Status:** Draft
> **Depends on:** SPEC 06
> **Date:** 2026-09-25
> **Objective:** Traducir el `transcript` obtenido en SPEC 06 del idioma origen al idioma destino usando OpenAI (`gpt-4o-mini`), devolviendo el resultado en la misma respuesta de `POST /api/audio`, sin generar audio todavía.

## Scope

**In:**

- Cliente hacia `https://api.openai.com/v1/chat/completions` (modelo `gpt-4o-mini`) para traducir texto, usando el mismo `RestClient` y la misma `OPENAI_API_KEY` ya configurados en SPEC 06.
- `AudioService` invoca la traducción después de obtener el `transcript`, pasando `sourceLanguage`/`targetLanguage`.
- Campo `translation` agregado a `AudioUploadResponse` — misma request, sin endpoint nuevo.
- Validación: si el `transcript` viene vacío (audio sin voz detectable), no se llama a la traducción — se falla explícitamente en vez de traducir un string vacío.
- Manejo de errores: `500` con `ProblemDetail` si la traducción falla, mismo patrón que SPEC 06.
- Frontend: mostrar la traducción real en el panel de conversación (lado "Otra persona"), reemplazando el placeholder vacío.

**Out of scope (para specs futuros):**

- Text-to-Speech de la traducción (SPEC 08) — por ahora la traducción se muestra solo como texto.
- Cambiar de proveedor de traducción (DeepL, Google Cloud Translate) — evaluado y descartado para esta etapa.
- Caché de traducciones repetidas.
- Detección automática del idioma origen (se sigue usando el `sourceLanguage` que manda el frontend).

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
    String translation   // nuevo: transcript traducido a targetLanguage
) {}
```

```java
// exception/TranslationException.java
public class TranslationException extends RuntimeException {
    public TranslationException(String message) { super(message); }
    public TranslationException(String message, Throwable cause) { super(message, cause); }
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
}
```

## Implementation plan

1. **Config.** En `application.properties`, agregar `openai.translation.model=gpt-4o-mini`.
2. **Excepción de dominio.** Crear `src/main/java/backtraduct/example/traductor/exception/TranslationException.java` (como arriba).
3. **Cliente de traducción.** Crear `src/main/java/backtraduct/example/traductor/client/OpenAiTranslationClient.java`. Método `translate(String text, String sourceLanguage, String targetLanguage): String`. Arma un chat completion con system prompt fijo tipo: *"Traducí literalmente el siguiente texto de {sourceLanguage} a {targetLanguage}. Devolvé únicamente la traducción, sin comillas, sin explicaciones, sin agregar nada que no esté en el texto original."* + el `transcript` como mensaje de usuario. Parsea `choices[0].message.content`. Cualquier fallo (status no-2xx, timeout, respuesta vacía) se relanza como `TranslationException`.
4. **Ampliar el DTO.** Agregar el campo `translation` a `AudioUploadResponse`.
5. **Validar transcript no vacío.** En `AudioService`, antes de traducir, si `transcript.isBlank()` lanzar `TranslationException("No se detectó voz en el audio")` sin llamar a OpenAI.
6. **Conectar en `AudioService`.** Después de obtener `transcript` (SPEC 06), llamar `OpenAiTranslationClient.translate(transcript, sourceLanguage, targetLanguage)` y armar el `AudioUploadResponse` con `translation` real. Verificación: `curl -F "audio=@sample_es.webm" -F sourceLanguage=es -F targetLanguage=pt http://localhost:8080/api/audio`, el campo `translation` es una traducción correcta al portugués del `transcript`.
7. **Manejo de errores.** Ampliar `GlobalExceptionHandler` con `@ExceptionHandler(TranslationException.class)` → `500` `ProblemDetail` con detail `"No se pudo traducir el texto"` (mensaje interno del cause no se expone). Verificación: forzar un fallo (ej. API key inválida) y confirmar `500` sin tumbar el backend.
8. **Frontend: tipo ampliado.** Agregar `translation: string` a la interfaz `AudioUploadResponse` en `src/api/audioClient.ts`.
9. **Frontend: mostrar traducción.** En `ConversationPanel`, cuando `state === "sent"`, mostrar `uploadResult.translation` como texto en el bloque "Otra persona" (sin audio todavía — eso es SPEC 08).
10. **Verificación end-to-end.** Grabar una frase en español, soltar el botón: en unos segundos aparece el `transcript` en "Vos" y la `translation` en portugués en "Otra persona".

## Acceptance criteria

- [ ] `POST /api/audio` con un audio real devuelve `translation` no vacía y correcta en el idioma destino (verificación manual con audio de prueba).
- [ ] Si el `transcript` viene vacío, la request falla con `500` `ProblemDetail` en vez de intentar traducir un string vacío.
- [ ] Si la traducción falla (API caída, key inválida), el endpoint devuelve `500` con `ProblemDetail` claro, sin tumbar el backend ni exponer detalles internos del proveedor.
- [ ] El frontend muestra la traducción real en el panel de conversación (lado "Otra persona") después de subir el audio.
- [ ] `mvn clean verify` (backend) y `npm run build` (frontend) pasan sin errores.
- [ ] No se agrega ninguna reproducción de audio de la traducción todavía (eso es SPEC 08).

## Decisiones

- **Sí:** reusar OpenAI (`gpt-4o-mini`) para traducción en vez de DeepL o Google Cloud Translate. Motivo: mismo proveedor y misma `OPENAI_API_KEY` que SPEC 06, sin dar de alta otra cuenta ni manejar un segundo secreto; calidad suficiente para ES/PT/EN/FR en esta etapa.
- **Sí:** ampliar la misma respuesta de `POST /api/audio` con `translation`, en vez de un endpoint separado. Motivo: consistente con SPEC 06, un solo viaje HTTP para todo el flujo audio→texto→traducción.
- **Sí:** `500 ProblemDetail` ante fallos de traducción, mismo patrón que STT. Motivo: consistencia — un fallo real no debe devolver una respuesta parcial confusa (transcript sí, translation no).
- **Sí:** validar `transcript` no vacío antes de llamar a la traducción. Motivo: ahorra una llamada a OpenAI innecesaria y da un mensaje de error más claro que "tradujo un string vacío exitosamente".
- **No:** caché de traducciones repetidas. Motivo: no pedido, prematuro sin datos de uso real todavía.
- **No:** detección automática de idioma origen. Motivo: ya se resuelve con el selector del frontend (SPEC 03) y el `sourceLanguage` que viaja desde SPEC 05.

## Risks

| Risk | Mitigation |
|------|------------|
| Prompt injection: el texto transcripto podría contener instrucciones que confundan al modelo de traducción | System prompt rígido que solo traduce literalmente, sin ejecutar instrucciones contenidas en el texto del usuario. Riesgo menor dado el caso de uso (traductor de voz conversacional). |
| Costo duplicado: cada request ahora dispara 2 llamadas a OpenAI (STT + traducción) | Aceptado en esta etapa; a monitorear igual que el costo de STT (SPEC 06). |
| Calidad de traducción variable en frases ambiguas o cortas | Aceptado como limitación conocida de esta etapa; no hay validación de calidad automatizada. |

## What is **not** in this spec

- Text-to-Speech de la traducción (SPEC 08).
- Cambio de proveedor de traducción.
- Caché de traducciones.
- Detección automática de idioma origen.

Cada uno de estos puntos, si se aborda, va en su propio spec.
