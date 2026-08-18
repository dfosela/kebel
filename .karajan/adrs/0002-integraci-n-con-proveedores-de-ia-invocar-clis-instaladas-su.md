# Integración con proveedores de IA: invocar CLIs instaladas (subprocess), no APIs directas

Status: accepted
Date: 2026-08-18

## Context

kb necesita asignar roles (coder/reviewer/solomon) a proveedores de IA distintos para el modelo de revisión cruzada v4. Kebel está pensado para gente sin suscripciones grandes, así que gestionar API keys de pago por proveedor añade fricción y coste que choca con el objetivo del proyecto. En este mismo repo ya validamos, dogfooding con kj, que orquestar CLIs instaladas (claude, agy, codex) vía subprocess funciona bien y reutiliza la autenticación que el usuario ya tiene.

## Decision

kb invoca por subprocess CLIs instaladas y configurables por rol (coder/reviewer/solomon), reutilizando src/exec.js ya construido (timeout real + kill de árbol de procesos en Windows). La config de kb mapea cada rol a un binario (p.ej. coder: claude, reviewer: gemini, solomon: codex) sin gestionar API keys directamente — la autenticación de cada CLI queda delegada a la propia CLI, igual que claude/codex/agy en este proyecto. kb doctor deberá comprobar que los binarios configurados existen y responden.

## Consequences

Ventajas: cero gestión de secretos por parte de kb, reutiliza suscripciones/autenticación que el usuario ya tiene (encaja con el público objetivo), reutiliza exec.js ya probado con tests. Riesgos aceptados: depende de que el usuario tenga instaladas y autenticadas las CLIs correspondientes -fricción de setup, mitigada por kb doctor y mensajes claros de qué falta-; cada CLI imprime su salida en texto libre sin formato estándar, así que kb necesitará un parser/adaptador por proveedor para extraer un veredicto estructurado (aprobado/rechazado + motivo + si hay hallazgo de seguridad) — trabajo no trivial que se aborda en la card kb-review-engine.
