# SPEC 04 — Captura de audio real en el navegador

> **Status:** Draft
> **Depends on:** SPEC 03
> **Date:** 2026-09-25
> **Objective:** Reemplazar el hook mock del SPEC 03 por captura real de audio del micrófono (MediaRecorder) con reproducción local, sin enviar nada al backend todavía.

## Scope

**In:**

- Hook `useVoiceRecorder` que pide permiso de micrófono (`getUserMedia`) y graba con `MediaRecorder` mientras el botón está presionado.
- Reproducción del audio grabado en el propio navegador (sin backend, sin traducción).
- Estado de error visible en la UI cuando se deniegan permisos o el navegador no soporta `getUserMedia`/`MediaRecorder`.
- Reemplazo del `ConversationPanel` mock: el lado "Vos" pasa a mostrar un botón "Reproducir audio" (ícono `Volume2`) en vez de texto de transcripción hardcodeado.
- Eliminación de `useMockVoiceInteraction` (SPEC 03) — queda reemplazado por `useVoiceRecorder`.

**Out of scope (para specs futuros):**

- Enviar el audio grabado al backend (SPEC 05).
- Speech-to-Text, traducción, Text-to-Speech (SPEC 06/07/08).
- Límite de duración de grabación o detección de silencio.
- Guardar/persistir grabaciones entre sesiones.
- Indicador de nivel de volumen / visualización de forma de onda mientras se graba.

## Data model

```ts
// src/hooks/useVoiceRecorder.ts
export type InteractionState = "idle" | "recording" | "ready" | "error";

export interface VoiceRecorderState {
  state: InteractionState;
  audioUrl: string | null;     // URL.createObjectURL(blob) del audio grabado, null si no hay
  errorMessage: string | null; // solo tiene valor cuando state === "error"
}
```

El audio vive solo en memoria del navegador (`Blob` + Object URL). No se persiste ni se envía a ningún lado en este spec.

## Implementation plan

1. **Crear `useVoiceRecorder`.** Nuevo archivo `src/hooks/useVoiceRecorder.ts`. Expone `{ state, audioUrl, errorMessage, startRecording, stopRecording }`. `startRecording()`: llama `navigator.mediaDevices.getUserMedia({ audio: true })`; si falla o no existe la API, setea `state: "error"` con `errorMessage`. Si tiene éxito, crea `MediaRecorder` con `audio/webm;codecs=opus` si `MediaRecorder.isTypeSupported` lo confirma, o sin `mimeType` (default del navegador) si no; arranca a grabar y pasa a `state: "recording"`.
2. **Finalizar grabación.** `stopRecording()` llama `mediaRecorder.stop()` y detiene los tracks del stream (`track.stop()` para liberar el micrófono). En el handler `onstop`, arma el `Blob` con los chunks, genera `URL.createObjectURL(blob)`, lo guarda en `audioUrl` y pasa a `state: "ready"`. Verificación manual: grabar 2 segundos, ver `state` pasar de `recording` a `ready`.
3. **Actualizar `MicButton`.** Cambiar de `useMockVoiceInteraction` a `useVoiceRecorder`. Label según estado: `idle` → "Mantener para hablar", `recording` → "Grabando...", `ready` → "Mantené para grabar de nuevo", `error` → "Error de micrófono, tocá para reintentar". En `error`, un click vuelve a intentar `startRecording()`.
4. **Actualizar `ConversationPanel`.** El bloque "Vos" muestra, cuando `state === "ready"`, un botón con ícono `Volume2` y texto "Reproducir audio" que reproduce `audioUrl` (vía un `<audio>` oculto controlado por `ref`, `.play()` al click). El bloque "Otra persona" queda vacío/placeholder (sin contenido hasta SPEC 08). En `state === "error"`, mostrar `errorMessage` en el panel.
5. **Eliminar código mock.** Borrar `src/hooks/useMockVoiceInteraction.ts` y cualquier referencia a `MockResult`/texto de ejemplo hardcodeado en `App.tsx` y `ConversationPanel.tsx`.
6. **Verificación manual completa.** `npm run dev`: mantener presionado el botón → el navegador pide permiso de micrófono → hablar → soltar → aparece "Reproducir audio" → al tocarlo se escucha exactamente lo grabado. Denegar el permiso en otra prueba → aparece el estado de error sin romper el resto de la pantalla.

## Acceptance criteria

- [ ] Al mantener presionado el botón mic por primera vez, el navegador pide permiso de micrófono.
- [ ] Al soltar el botón, el audio grabado se puede reproducir con "Reproducir audio" y suena igual a lo que se dijo.
- [ ] Si se deniegan los permisos (o `getUserMedia` no existe), la UI muestra un mensaje de error sin romper el resto de la pantalla, y permite reintentar.
- [ ] `useMockVoiceInteraction` y cualquier texto de ejemplo hardcodeado fueron eliminados del código.
- [ ] No hay ninguna request HTTP disparada — el audio queda solo en memoria del navegador.
- [ ] Al soltar el micrófono, los tracks del stream se detienen (no queda el ícono de "usando micrófono" activo en el navegador).
- [ ] `npm run build` compila sin errores de TypeScript.

## Decisiones

- **Sí:** `audio/webm;codecs=opus` con fallback al default del navegador. Motivo: soportado en Chrome/Firefox/Edge; el formato exacto solo importa cuando se defina el contrato con el backend en SPEC 05.
- **Sí:** estado `error` visible en la UI ante permisos denegados. Motivo: pedido explícito, evita que el usuario se quede sin feedback.
- **No:** límite de duración de grabación. Motivo: pedido explícito de no agregarlo todavía; se evalúa si hace falta más adelante.
- **Sí:** eliminar `useMockVoiceInteraction` en vez de mantenerlo en paralelo. Motivo: este spec lo reemplaza directamente, mantenerlo vivo sería código muerto.
- **No:** subir o persistir el audio grabado. Motivo: corresponde a SPEC 05 (enviar audio al backend).
- **No:** indicador visual de nivel de audio o forma de onda mientras se graba. Motivo: no pedido, agrega complejidad sin estar en el flujo core todavía.

## What is **not** in this spec

- Envío del audio al backend (SPEC 05).
- Speech-to-Text (SPEC 06).
- Traducción de texto (SPEC 07).
- Text-to-Speech (SPEC 08).
- Límite de duración, detección de silencio, visualización de audio.

Cada uno de estos puntos, si se aborda, va en su propio spec.
