# SPEC 09 — Conversación bidireccional con historial

> **Status:** Draft
> **Depends on:** SPEC 03, SPEC 08
> **Date:** 2026-09-25
> **Objective:** Acumular cada turno completado (audio→transcript→traducción) en un historial visible tipo chat, persistido en `localStorage`, usando el swap manual existente para alternar la dirección de la conversación.

## Scope

**In:**

- Historial de turnos en el frontend: cada vez que se completa un ciclo (SPEC 08), se agrega una entrada al final de una lista visible tipo chat.
- Persistencia del historial en `localStorage` bajo la clave `conversation-history:v1`, sobrevive a un reload de la página.
- Guardado en `localStorage` best-effort: si falla (storage lleno, deshabilitado, modo privado), la app sigue funcionando solo con el estado en memoria de la sesión, sin romperse.
- Reutilización del mecanismo existente (SPEC 03) para alternar dirección: el usuario invierte el par de idiomas con el botón swap antes de que hable la otra persona; cada turno guarda el par de idiomas que estaba activo en el momento de grabarlo.
- Componente `ConversationHistory` (reemplaza a `ConversationPanel` de SPEC 04-08): lista scrolleable, scroll automático al turno más nuevo.
- Cada turno del historial muestra: idioma origen→destino, `transcript`, `translation` — solo texto, sin audio (el audio solo se reproduce automáticamente en el momento en que se genera, SPEC 08).

**Out of scope (para specs futuros):**

- Dos botones de micrófono separados (uno por idioma) — evaluado y descartado, se mantiene el swap manual sobre el mic único.
- Detección automática de quién habla / qué idioma se usó — sigue sin existir, tal como se decidió en SPEC 01.
- Límite o rotación automática de turnos en el historial.
- Exportar, compartir o borrar el historial manualmente.
- Reproducir el audio de un turno pasado — no se persiste audio, solo texto.
- Streaming / tiempo real (SPEC 10).

## Data model

```ts
// src/types/conversation.ts
export interface ConversationTurn {
  id: string;              // mismo id que devuelve el backend en AudioUploadResponse
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  transcript: string;
  translation: string;
  timestamp: string;       // ISO 8601, new Date().toISOString()
}
```

```ts
// src/hooks/useConversationHistory.ts (forma del estado)
interface ConversationHistoryState {
  turns: ConversationTurn[];
}
```

`localStorage["conversation-history:v1"]` guarda `JSON.stringify(turns)`. El sufijo `:v1` deja lugar para migrar o descartar el formato si cambia en el futuro, sin romper sesiones viejas silenciosamente.

## Implementation plan

1. **Tipos.** Crear `src/types/conversation.ts` con `ConversationTurn` (arriba).
2. **Hook `useConversationHistory`.** Crear `src/hooks/useConversationHistory.ts`. Al montar, lee `localStorage.getItem("conversation-history:v1")`; si existe y parsea como JSON válido, inicializa `turns` con eso; si no existe o falla el parseo, arranca con `[]` (sin romper la app). Expone `{ turns, appendTurn(turn: ConversationTurn) }`. En cada cambio de `turns`, intenta `localStorage.setItem(...)` dentro de un `try/catch` — si falla (quota excedida, storage deshabilitado), solo loguea en consola y sigue funcionando con el estado en memoria.
3. **Componente `ConversationHistory`.** Crear `src/components/ConversationHistory/ConversationHistory.tsx` + `.module.css`, reemplaza a `ConversationPanel`. Renderiza `turns` como lista tipo chat (cada item: `{sourceLanguage} → {targetLanguage}`, `transcript`, `translation`). Usa un `ref` en el último item + `scrollIntoView({ behavior: "smooth" })` cuando `turns.length` cambia.
4. **Integrar en `App.tsx`.** Usar `useConversationHistory`. En el callback que recibe `uploadResult` (SPEC 08, tras reproducir el audio automáticamente), armar un `ConversationTurn` con `id: uploadResult.id`, el `pair` activo en ese momento (`sourceLanguage`/`targetLanguage`), `uploadResult.transcript`, `uploadResult.translation`, `timestamp: new Date().toISOString()`, y llamar `appendTurn(turn)`. Reemplazar el uso de `ConversationPanel` por `ConversationHistory` pasándole `turns`.
5. **Verificación manual.** Grabar un turno (ES→PT), tocar swap, grabar otro turno (PT→ES), confirmar que ambos aparecen en la lista en orden con las direcciones correctas. Recargar la página (`F5`) y confirmar que el historial sigue ahí.
6. **Verificación de resiliencia.** Con las devtools, corromper manualmente el valor de `localStorage["conversation-history:v1"]` (texto no-JSON) y recargar: la app arranca igual, con historial vacío, sin pantalla en blanco ni error en consola sin capturar.

## Acceptance criteria

- [ ] Cada turno completado se agrega al final de la lista visible del historial.
- [ ] El historial persiste en `localStorage["conversation-history:v1"]` y sobrevive a un reload de la página.
- [ ] Si el valor guardado en `localStorage` está corrupto o `localStorage` no está disponible, la app arranca igual con historial vacío, sin romperse.
- [ ] Invertir el par de idiomas (swap) antes de grabar agrega un turno con la dirección de idioma correcta (inversa a la anterior).
- [ ] La lista hace scroll automático hacia el turno más nuevo al agregarse.
- [ ] Los turnos del historial muestran solo texto (`transcript`/`translation`) — no hay botón de reproducción de audio en turnos pasados.
- [ ] `npm run build` compila sin errores de TypeScript.

## Decisiones

- **Sí:** swap manual sobre el mic único existente, en vez de dos botones separados. Motivo: reusa toda la UI de SPEC 03-08 sin duplicar `MicButton` ni su lógica de estados. Se evaluó la alternativa de dos botones fijos (más natural cara a cara) pero se descartó para no sumar superficie nueva en esta etapa.
- **Sí:** persistir en `localStorage` con clave versionada `conversation-history:v1`. Motivo: primera persistencia real del proyecto; el sufijo de versión permite migrar o descartar el formato después sin corromper sesiones viejas.
- **Sí:** guardado best-effort (nunca rompe la app si falla). Motivo: el estado en memoria de React es la fuente de verdad para renderizar; `localStorage` es solo para sobrevivir un reload, no una base de datos.
- **No:** límite o rotación de turnos. Motivo: pedido explícito del usuario; se revisa si se vuelve un problema real (ver Riesgos).
- **No:** persistir o reproducir audio de turnos pasados. Motivo: consistente con las decisiones de SPEC 05-08 de no persistir audio — solo el turno recién generado se reproduce automáticamente.
- **No:** detección automática de idioma/dirección. Motivo: descartada desde SPEC 01, el usuario sigue controlando la dirección manualmente.

## Risks

| Risk | Mitigation |
|------|------------|
| `localStorage` tiene un límite práctico (~5-10MB por origen) y no hay cap de turnos | Riesgo bajo en uso normal de una conversación; si se vuelve un problema real, se agrega un límite o rotación en un spec futuro. |
| El formato del historial cambia en el futuro | La clave versionada (`:v1`) permite detectar el cambio y decidir migrar o descartar sin corromper la app. |
| `localStorage` deshabilitado o bloqueado (modo privado, políticas del navegador) | Guardado best-effort con `try/catch`; la app sigue funcionando solo con el estado en memoria de la sesión actual. |

## What is **not** in this spec

- Dos botones de micrófono separados por idioma.
- Detección automática de dirección/idioma.
- Límite o rotación automática del historial.
- Exportar, compartir o borrar el historial manualmente.
- Reproducción de audio de turnos pasados.
- Streaming / tiempo real (SPEC 10).

Cada uno de estos puntos, si se aborda, va en su propio spec.
