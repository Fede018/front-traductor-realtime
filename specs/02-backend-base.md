# SPEC 02 — Backend base (Spring Boot)

> **Status:** Draft
> **Depends on:** SPEC 01
> **Date:** 2026-09-25
> **Objective:** Dejar `back-traduct` con dependencias, estructura de paquetes, CORS, endpoint de health y manejo global de errores, sin traducción ni audio todavía.

## Scope

**In:**

- Agregar `spring-boot-starter-actuator` al `pom.xml` de `back-traduct`.
- Exponer `/actuator/health` (health check estándar, sin detalles sensibles).
- Configurar CORS para permitir el origen `http://localhost:5173` (Vite dev server).
- Definir convención de paquetes por capa técnica: `config`, `exception` (y `controller`/`service` quedan reservados para cuando exista la primera funcionalidad real, en SPEC 05+).
- Manejo global de errores con `@RestControllerAdvice` devolviendo `ProblemDetail` (RFC 7807) para excepciones no controladas.
- Verificación de que el proyecto compila y levanta con `mvn spring-boot:run`.

**Out of scope (para specs futuros):**

- Cualquier endpoint de negocio (recepción de audio, texto, traducción) — arranca en SPEC 05.
- Autenticación/autorización — no mencionada en el roadmap, se evalúa si hace falta más adelante.
- Configuración de CORS dinámica por variable de entorno o perfiles (`dev`/`prod`) — se define si aparece la necesidad; por ahora el origen queda hardcodeado.
- Integración con el servicio de IA/audio — SPEC 06/07/08.
- Tests de integración end-to-end contra el frontend real — solo se prueba el backend de forma aislada (MockMvc).

## Data model

Este spec no introduce estructuras de datos de negocio. Solo configuración (`application.properties`) y clases de infraestructura (`CorsConfig`, `GlobalExceptionHandler`).

## Implementation plan

1. **Agregar dependencia Actuator.** Editar `pom.xml`: agregar `spring-boot-starter-actuator`. Verificación: `mvn -q compile` termina sin errores.
2. **Exponer health check.** En `src/main/resources/application.properties`, agregar `management.endpoints.web.exposure.include=health`. Verificación: levantar con `mvn spring-boot:run` y `curl http://localhost:8080/actuator/health` devuelve `{"status":"UP"}` con código 200.
3. **Configurar CORS.** Crear `src/main/java/backtraduct/example/traductor/config/CorsConfig.java`, bean `WebMvcConfigurer` que permite origen `http://localhost:5173`, métodos `GET, POST, OPTIONS`, todos los headers, sobre `/**`. Verificación: test `CorsConfigTest` con `MockMvc` hace `OPTIONS /actuator/health` con header `Origin: http://localhost:5173` y comprueba `Access-Control-Allow-Origin` en la respuesta.
4. **Manejo global de errores.** Crear `src/main/java/backtraduct/example/traductor/exception/GlobalExceptionHandler.java`, `@RestControllerAdvice` con `@ExceptionHandler(Exception.class)` que devuelve `ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, ...)`. Verificación: test `GlobalExceptionHandlerTest` con un `@RestController` de test (solo en `src/test`) que lanza una excepción, y confirma `Content-Type: application/problem+json` y el body con `status`, `title`, `detail`.
5. **Confirmar arranque limpio.** `mvn clean verify` pasa sin errores con todo lo anterior integrado.

## Acceptance criteria

- [ ] `mvn clean verify` pasa sin errores.
- [ ] `GET /actuator/health` devuelve 200 con `{"status":"UP"}`.
- [ ] Una request `OPTIONS` con `Origin: http://localhost:5173` recibe `Access-Control-Allow-Origin: http://localhost:5173`.
- [ ] Una excepción no controlada en un controller devuelve `ProblemDetail` (`application/problem+json`), no un stacktrace ni HTML de error por defecto de Spring.
- [ ] Existen los paquetes `config` y `exception` dentro de `backtraduct.example.traductor`.
- [ ] No existe ningún endpoint de negocio (audio, texto, traducción) todavía.

## Decisiones

- **Sí:** Spring Boot Actuator para el health check. Motivo: estándar, cero mantenimiento, y deja la puerta abierta a métricas cuando llegue SPEC 10 (tiempo real).
- **No:** endpoint `/api/health` custom. Motivo: reinventar algo que Actuator ya resuelve.
- **Sí:** origen CORS hardcodeado (`localhost:5173`). Motivo: es el único consumidor por ahora (Vite dev server); configurarlo por variable de entorno hoy sería anticipar un problema que no existe todavía.
- **Sí:** paquetes por capa técnica (`config`, `exception`, y luego `controller`/`service`). Motivo: con tan poco código todavía, organizar por feature sería prematuro.
- **Sí:** `ProblemDetail` (RFC 7807) para errores. Motivo: viene integrado en Spring Boot 3+/4, no requiere mantener una clase de error propia.
- **No:** crear controllers o packages `controller`/`service` vacíos en este spec. Motivo: paquete vacío sin clases no aporta nada; se crean cuando SPEC 05 agregue el primer endpoint real.

## What is **not** in this spec

- Endpoints de negocio (audio, transcripción, traducción, TTS).
- Autenticación/autorización.
- CORS configurable por entorno.
- Integración con el servicio de IA/audio.

Cada uno de estos puntos, si se aborda, va en su propio spec.
