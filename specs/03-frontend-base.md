# SPEC 03 — Frontend base (React + Vite)

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-25
> **Objective:** Scaffoldear `front-traduct` con Vite + React + TypeScript y armar la pantalla principal centrada en voz (mockup conceptual, con estados mockeados), sin integrar IA ni backend todavía.

## Scope

**In:**

- Scaffold del proyecto con `npm create vite@latest . -- --template react-ts` dentro de `C:\react\front-traduct`.
- Dependencia `lucide-react` para íconos.
- Pantalla principal única (sin router) con:
  - Título de la app.
  - Selector de idioma origen y destino (dos `<select>`, lista fija ES/PT/EN/FR, par por defecto ES→PT) + botón para invertir el par (swap).
  - Botón de micrófono grande, centrado, con label "Mantener para hablar".
  - Panel de conversación auxiliar: muestra transcripción original ("Vos") y traducción ("Otra persona") como texto, más un indicador de audio (ícono).
- Interacción mock del botón de micrófono: mantener presionado (`mousedown`/`touchstart`) → estado `recording`; soltar (`mouseup`/`touchend`) → estado `processing` (timeout corto, ~800ms) → estado `result`, mostrando una transcripción y traducción de ejemplo hardcodeadas. Volver a presionar reinicia el ciclo desde `recording`.
- CSS Modules para todo el styling.
- Verificación de que `npm run dev` y `npm run build` funcionan sin errores de TypeScript.

**Out of scope (para specs futuros):**

- Captura real de audio del micrófono (SPEC 04).
- Envío de audio al backend (SPEC 05).
- Speech-to-Text, traducción y Text-to-Speech reales (SPEC 06/07/08).
- Persistencia del idioma seleccionado entre sesiones.
- Historial de conversación con múltiples turnos (SPEC 09 lo trata como conversación bidireccional real).
- Animaciones o transiciones elaboradas — estados visuales simples y claros alcanzan.

## Data model

```ts
// src/types/language.ts
export type LanguageCode = "es" | "pt" | "en" | "fr";

export interface Language {
  code: LanguageCode;
  label: string; // "Español", "Português", ...
}

export const LANGUAGES: Language[] = [
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

export interface LanguagePair {
  source: LanguageCode;
  target: LanguageCode;
}
```

```ts
// src/hooks/useMockVoiceInteraction.ts (estado local del hook)
export type InteractionState = "idle" | "recording" | "processing" | "result";

export interface MockResult {
  transcript: string; // ejemplo: "Hola, ¿cómo estás?"
  translation: string; // ejemplo: "Olá, como você está?"
}
```

Todo el estado es local a React (`useState`), sin persistencia — se descarta al recargar la página.

## Implementation plan

1. **Scaffold del proyecto.** Correr `npm create vite@latest . -- --template react-ts` en `C:\react\front-traduct`, `npm install`. Verificación: `npm run dev` levanta en `http://localhost:5173` con la pantalla default de Vite.
2. **Instalar `lucide-react`.** `npm install lucide-react`. Verificación: `npm run build` sigue sin errores.
3. **Tipos de idioma.** Crear `src/types/language.ts` con `LanguageCode`, `Language`, `LANGUAGES`, `LanguagePair` como arriba.
4. **Componente `LanguageSelector`.** Crear `src/components/LanguageSelector/LanguageSelector.tsx` + `LanguageSelector.module.css`. Dos `<select>` (origen/destino) sobre `LANGUAGES`, más botón swap (ícono `ArrowLeftRight` de lucide-react) que invierte `source`/`target`. Recibe `pair` y `onChange` por props. Verificación: cambiar cualquiera de los dos selects actualiza el estado en `App`.
5. **Hook `useMockVoiceInteraction`.** Crear `src/hooks/useMockVoiceInteraction.ts`: maneja `InteractionState` y `MockResult | null`. Expone `state`, `result`, `startRecording()`, `stopRecording()`. `stopRecording()` pasa a `processing`, espera ~800ms con `setTimeout`, y setea `result` con un `MockResult` hardcodeado + pasa a `result`.
6. **Componente `MicButton`.** Crear `src/components/MicButton/MicButton.tsx` + `.module.css`. Ícono `Mic` (lucide-react) grande, centrado, label "Mantener para hablar" (cambia a "Grabando..." / "Procesando..." según estado). Eventos `onMouseDown`/`onTouchStart` → `startRecording()`, `onMouseUp`/`onTouchEnd` → `stopRecording()`.
7. **Componente `ConversationPanel`.** Crear `src/components/ConversationPanel/ConversationPanel.tsx` + `.module.css`. Muestra dos bloques ("Vos" / "Otra persona") con ícono `Volume2` y el texto de `result.transcript` / `result.translation` cuando `state === "result"`; vacío/placeholder en otros estados.
8. **Ensamblar `App.tsx`.** Layout general: título, `LanguageSelector`, `MicButton`, `ConversationPanel`. Usa `useState<LanguagePair>` para el par de idiomas (default `{ source: "es", target: "pt" }`) y `useMockVoiceInteraction`. Verificación manual: mantener presionado el botón cicla `recording → processing → result` con texto de ejemplo visible; soltar antes de que termine `processing` no rompe el ciclo.
9. **Limpieza del boilerplate de Vite.** Borrar `src/App.css`, assets default no usados, dejar `index.html` con título "Traductor". Verificación final: `npm run build` sin errores ni warnings de TypeScript.

## Acceptance criteria

- [ ] `npm run dev` sirve la app en `http://localhost:5173` sin errores en consola.
- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] La pantalla muestra selector de idioma origen/destino con ES/PT/EN/FR, par por defecto ES→PT, y botón swap que invierte el par.
- [ ] Mantener presionado el botón de micrófono pasa a estado "Grabando...", soltar pasa a "Procesando..." y luego muestra transcripción + traducción de ejemplo en el panel de conversación.
- [ ] No hay ningún campo de texto para escribir el mensaje a traducir — la única entrada es el botón de micrófono.
- [ ] No hay llamadas HTTP a ningún backend — todo el estado es mock local.

## Decisiones

- **Sí:** CSS Modules. Motivo: aislamiento por componente sin sumar una librería de estilos completa.
- **Sí:** `lucide-react` para íconos. Motivo: más prolijo y consistente entre plataformas que emoji; ya elegido explícitamente por el usuario.
- **Sí:** mic button cicla estados mock (recording/processing/result) con datos hardcodeados. Motivo: valida la UX de estados antes de tener audio real, y deja el hook (`useMockVoiceInteraction`) listo para reemplazar su implementación interna en SPEC 04 sin tocar los componentes que lo consumen.
- **Sí:** botón swap para invertir el par de idiomas. Motivo: trivial de implementar y soporta directamente el requisito de "funcionar también en sentido inverso" del SPEC 01, sin agregar dominio nuevo.
- **No:** persistir el idioma seleccionado (localStorage, etc.). Motivo: no pedido, se evalúa si hace falta en un spec posterior.
- **No:** mostrar historial de múltiples turnos de conversación. Motivo: corresponde a SPEC 09 (conversación bidireccional).

## What is **not** in this spec

- Captura de audio real (SPEC 04).
- Comunicación con el backend (SPEC 05 en adelante).
- Speech-to-Text, traducción, Text-to-Speech reales.
- Persistencia de preferencias del usuario.
- Historial de conversación con múltiples turnos.

Cada uno de estos puntos, si se aborda, va en su propio spec.
