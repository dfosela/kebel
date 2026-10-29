# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado semántico: MAJOR cuando algo rompe compatibilidad (formato de
`.kebel/kebel.config.json`, flags de `kb`...), MINOR cuando se añade una
tarea/feature nueva (una card de `TASKS.md` completa), PATCH para fixes
sin nueva funcionalidad.

## [0.2.0] - 2026-10-29

### Added

- `kb init`: detección de proveedores de IA por login real (no solo binario
  instalado), asignación de roles coder/reviewer/solomon, scaffolding de
  `AGENTS.md`/`CLAUDE.md`, instalación del gate de git, y un mensaje de
  bienvenida explicando los 3 roles y los comandos básicos.
- `kb review --staged`: motor de revisión cruzada real; si no hay un
  segundo proveedor de IA logado, corre los tests del proyecto y pide
  aprobación manual con un resumen del diff generado por el coder
  (veredicto `reviewer: "human"`, nunca disfrazado de revisión por IA).
- `kb solomon`: arbitraje de terceros cuando se discrepa de un rechazo del
  reviewer; nunca overridea un hallazgo de seguridad.
- `kb adr add/list`: ADRs ligeras en markdown bajo `.kebel/adrs/`.
- `kb card add/list/move`: tracking plano de tareas en `.kebel/cards.json`.
- `kb doctor`: diagnóstico del setup (git, config, login real de cada
  proveedor asignado, Squeezr).
- `kb git-gate-check` (hook de pre-commit): bloquea el commit sin un
  veredicto de revisión aprobado y vigente, en la rama base directamente
  (branch-first), o sin un test correspondiente para cada archivo de
  `src/` tocado (TDD-first mínimo viable).
- `kb setup`: detección/instalación automática de Squeezr como proxy de
  compresión de contexto por defecto.

## [0.1.0] - 2026-08-18

### Added

- Esqueleto inicial del CLI (`kb --version`, `kb --help`).
- Setup inicial del proyecto: estructura, roles cross-AI fijos para el
  dogfooding (coder=Claude, reviewer=Antigravity, solomon=Codex), ADR de
  estrategia de integración con proveedores (CLI subprocess vs API directa).
