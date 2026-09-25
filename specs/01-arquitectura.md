# SPEC 01 — Arquitectura general del traductor por voz

> **Status:** Aprobado
> **Depends on:** (ninguno — spec fundacional)
> **Date:** 2026-09-25
> **Objective:** Definir la arquitectura de componentes, el flujo de datos extremo a extremo y el roadmap de specs para un traductor de voz en tiempo real (React ↔ Spring Boot ↔ servicio de IA/audio), sin escribir código todavía.

## Por qué existe este spec

La app **no** es un traductor de texto con un campo de entrada: es un intérprete de voz. Esa decisión condiciona todo lo que viene después (UI centrada en micrófono, pipeline audio→texto→traducción→audio, necesidad futura de streaming). Este spec fija esa decisión por escrito antes de tocar código, para que ningún spec posterior la reabra ni la contradiga.

## Scope

**In:**

- Diagrama de componentes: Frontend (React) ↔ Backend (Spring Boot) ↔ Servicio de IA/audio (STT, traducción, TTS).
- Flujo de datos extremo a extremo de una interacción de voz (persona A habla → audio → texto → traducción → audio → persona B escucha), y su sentido inverso.
- Roadmap de specs siguientes (02 a 10) con el alcance de cada uno, para que ningún spec posterior invente scope no acordado.
- Confirmación de stack tecnológico y ubicación de los dos repos (`C:\react\front-traduct`, `C:\Java\back-traduct`).
- Principio de diseño de la UI: la voz es el mecanismo principal de entrada/salida; el texto (transcripción, traducción, idioma detectado, estado) es información auxiliar visible, nunca el mecanismo de interacción.
- Principio de extensibilidad de idiomas: la arquitectura no debe hardcodear el par Español↔Portugués como único caso — debe admitir agregar idiomas sin rediseño.

**Out of scope (para specs futuros):**

- Cualquier código, endpoint, componente React o configuración Maven/npm concretos (empiezan en SPEC 02 y SPEC 03).
- Contrato exacto de la API REST (payloads, formatos de audio, códigos de error) — se define en SPEC 05.
- Integración real de STT (Whisper), traducción y TTS (Piper) — SPEC 06, 07, 08.
- Streaming / tiempo real (WebSocket) — SPEC 10.
- Selección dinámica de idioma por el usuario (persistencia, detección automática) — se define en detalle cuando corresponda; en SPEC 03 solo se menciona como selector hardcodeado en la UI.

## Data model

Este spec no introduce estructuras de datos concretas — es un documento de arquitectura. Los modelos de datos (payload de audio, estructura de transcripción, etc.) se definen en SPEC 05 en adelante.

## Arquitectura de componentes

```
┌──────────────────┐       HTTP/REST        ┌──────────────────┐      (a definir)      ┌──────────────────────┐
│   Frontend        │ ─────────────────────▶ │   Backend         │ ────────────────────▶ │  Servicio de IA/audio │
│   React + TS +    │ ◀───────────────────── │   Spring Boot     │ ◀──────────────────── │  (STT / Traducción /  │
│   Vite             │                        │   (REST API)      │                        │   TTS)                 │
│   front-traduct    │                        │   back-traduct    │                        │                        │
└──────────────────┘                         └──────────────────┘                        └──────────────────────┘
```

- **Frontend (`front-traduct`):** captura audio del micrófono, muestra estados (idle/grabando/procesando/resultado), reproduce el audio traducido. No hace STT/traducción/TTS localmente.
- **Backend (`back-traduct`):** expone la REST API, orquesta el pipeline (recibe audio, delega en el servicio de IA/audio, devuelve resultado). Es el único punto de contacto del frontend hacia afuera.
- **Servicio de IA/audio:** responsable de Speech-to-Text, traducción de texto y Text-to-Speech. En esta etapa **no se decide** si es una librería embebida en el backend, un proceso local (Whisper/Piper) o un servicio externo — esa decisión se toma en SPEC 06/07/08, cuando haya que implementarlo. Se lo modela como componente separado para que el backend no quede acoplado a una implementación concreta.

## Flujo de datos extremo a extremo

```
Persona A habla (idioma origen)
        ↓
[Frontend] captura audio (micrófono)
        ↓
[Frontend → Backend] envía audio vía HTTP
        ↓
[Backend → Servicio IA] Speech-to-Text → texto en idioma origen
        ↓
[Servicio IA] traduce texto → texto en idioma destino
        ↓
[Servicio IA] Text-to-Speech → audio en idioma destino
        ↓
[Backend → Frontend] devuelve audio traducido (+ transcripción y traducción como texto auxiliar)
        ↓
[Frontend] reproduce audio
        ↓
Persona B escucha la traducción
```

El mismo flujo aplica en sentido inverso (Persona B → Persona A) sin cambios estructurales: el idioma origen/destino es un parámetro, no un camino de código distinto.

## Principio de extensibilidad de idiomas

- El par de idiomas (origen, destino) es un parámetro de la interacción, no una constante del sistema.
- Ningún componente (frontend, backend, servicio de IA) debe codificar "Español" o "Portugués" como valores fijos en la lógica de negocio — sí puede haber una lista inicial soportada (SPEC 03: selector hardcodeado ES/PT/EN/FR), pero la estructura de datos y los endpoints deben aceptar cualquier código de idioma (ej. `es`, `pt`, `en`, `fr`) sin cambios de código para agregar uno nuevo, solo configuración/lista.

## Principio de UI centrada en voz

- La interacción principal es: mantener presionado un botón de micrófono para hablar, soltar para enviar.
- No existe (ni existirá en próximos specs) un campo de texto como mecanismo de entrada del mensaje a traducir.
- El texto en pantalla (transcripción, traducción, idioma detectado, estado de procesamiento) es siempre información **auxiliar** — confirma lo que el audio ya transmitió, no lo reemplaza.

## Roadmap de specs (referencia — no implementar acá)

| Spec | Título                     | Entregable                                                                                                  |
| ---- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 01   | Arquitectura (este spec)   | Documento de arquitectura, sin código                                                                       |
| 02   | Backend Spring Boot        | `back-traduct` con dependencias, estructura de paquetes, CORS, endpoint de health, manejo básico de errores |
| 03   | Frontend React             | `front-traduct` con pantalla principal centrada en voz (mockup conceptual), sin IA real                     |
| 04   | Captura de audio           | Grabar/reproducir audio en el navegador (MediaRecorder), sin backend todavía                                |
| 05   | Enviar audio al backend    | Contrato REST definido, frontend envía audio, backend confirma recepción, sin traducir                      |
| 06   | Speech-to-Text             | Integración Whisper: audio → texto                                                                          |
| 07   | Traducción                 | Texto origen → texto destino                                                                                |
| 08   | Text-to-Speech             | Texto destino → audio (Piper): primer flujo completo end-to-end                                             |
| 09   | Conversación bidireccional | UI y backend soportan ambos sentidos (A→B y B→A) con historial visible                                      |
| 10   | Tiempo real                | Streaming/WebSocket para reducir latencia percibida                                                         |

Cada spec de esta tabla se redacta en detalle (con sus propias preguntas de clarificación) cuando llegue su turno — esta tabla fija el orden y el alcance macro para que no se mezclen etapas.

## Stack y repos confirmados

- **Frontend:** React + TypeScript + Vite, repo en `C:\react\front-traduct` (vacío, se crea en SPEC 03).
- **Backend:** Java + Spring Boot 4.1.1 (Java 21) + Maven, repo en `C:\Java\back-traduct` (ya iniciado: `pom.xml`, `groupId backtraduct.example`, `artifactId traductor`, dependencias `spring-boot-starter-webmvc` y `lombok` presentes; faltan dependencias específicas del dominio, que se agregan en SPEC 02 en adelante).
- **Comunicación Frontend↔Backend:** REST API sobre HTTP (contrato exacto en SPEC 05; tiempo real queda para SPEC 10).

## Implementation plan

Este spec no tiene plan de implementación de código — su único entregable es este documento. Los pasos de implementación arrancan en SPEC 02.

## Acceptance criteria

- [ ] El documento define los tres componentes (Frontend, Backend, Servicio de IA/audio) y sus relaciones.
- [ ] El documento describe el flujo completo de una interacción de voz en ambos sentidos.
- [ ] El documento dice explícitamente que el texto es auxiliar y la voz es el mecanismo principal.
- [ ] El documento fija que el par de idiomas es un parámetro, no un valor hardcodeado en la lógica.
- [ ] El roadmap de specs 02–10 está en el documento y cada uno tiene un alcance de una línea.
- [ ] Ningún spec posterior necesita redefinir estos principios — solo puede referenciarlos.

## Decisiones

- **Sí:** modelar el servicio de IA/audio como componente lógico separado del backend, sin decidir todavía si vive embebido o externo. Motivo: evita acoplar el backend a una implementación de STT/TTS antes de tiempo.
- **No:** definir el contrato REST exacto en este spec. Motivo: sin backend ni frontend corriendo, cualquier contrato sería especulativo; se define en SPEC 05 con ambos lados ya construibles.
- **Sí:** roadmap fijo de specs 02 a 10 documentado acá. Motivo: el usuario ya dio el orden completo; registrarlo evita que un spec futuro se adelante a otro (ej. implementar streaming antes de tener el flujo básico funcionando).
- **No:** implementar selección de idioma dinámica (detección automática, persistencia) en etapas tempranas. Motivo: SPEC 03 solo necesita un selector hardcodeado para no bloquear el desarrollo de la UI.
- **Sí:** usar Maven para el backend. Motivo: ya es el build tool del proyecto existente en `C:\Java\back-traduct`.

## What is **not** in this spec

- Código de frontend o backend (arranca en SPEC 02/03).
- Contrato REST concreto (SPEC 05).
- Integración de Whisper, traductor de texto o Piper (SPEC 06/07/08).
- WebSocket / streaming (SPEC 10).
- Selección de idioma dinámica más allá de un selector hardcodeado (se revisa en spec futuro si hace falta).

Cada uno de estos puntos, si se aborda, va en su propio spec.
