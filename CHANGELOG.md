# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado semántico: MAJOR cuando algo rompe compatibilidad (formato de
`.kebel/kebel.config.json`, flags de `kb`...), MINOR cuando se añade una
tarea/feature nueva (una card de `TASKS.md` completa), PATCH para fixes
sin nueva funcionalidad.

## [0.4.0] - 2026-11-18
### Added
- `kb init --reconfigure`: vuelve a detectar las IAs y a repartir los roles
  sobre una configuración existente, conservando la rama base guardada.
  `kb init` sobre un proyecto ya inicializado explica cómo hacerlo.
- `kb init` propone qué IA hace cada rol y deja cambiarlo: Enter acepta la
  propuesta y también se puede escribir otra IA disponible. Sin terminal
  interactiva reparte por orden, como antes.

## [0.3.0] - 2026-11-18
### Added
- `kb init` muestra qué IAs detecta (Claude, ChatGPT/Codex, Gemini,
  Antigravity) y, para cada una que falta, por qué: no instalada o sin
  sesión iniciada.
- `kb init` pregunta si quieres iniciar sesión en una IA instalada sin
  sesión, o instalar por npm e iniciar sesión en las que no tienes, y vuelve
  a comprobarlas antes de repartir los roles. Sin terminal interactiva solo
  explica cómo añadirlas.
### Fixed
- Codex salía como no disponible en carpetas nuevas: `kb init` comprobaba las
  IAs antes de crear el repositorio git, y Codex no funciona fuera de uno.
- `npm publish` ya no avisa de que la ruta del comando `kb` no es válida.

## [0.2.2] - 2026-11-16
### Fixed
- `kb init` ya no se rompe con un volcado de error de Node cuando la carpeta
  todavía no es un repositorio git: ahora ejecuta `git init` y continúa.

## [0.2.1] - 2026-11-02
### Fixed
- Bypass del gate de revisión vía negación en texto libre o JSON citado en
  `verdictParser.js`.
- `tddCheck.js` ya no bloquea borrados de archivos ni confía en el disco en
  vez de en git.
- Inyección de shell en el script del hook de pre-commit (`gitHooks.js`):
  se escapa `binPath` antes de insertarlo.
- URL de repo y mención a un comando inexistente corregidas en
  `scaffold.js`.
- `adr add`/`adr list` envueltos en try/catch en `cli.js`, igual que el
  resto de comandos que mutan estado.
- `runInit` ya no crashea sin capturar en detached HEAD.
- `shell: true` ahora es condicional a Windows en `providerArgs.js`
  (claude/codex/gemini).
- `installPreCommitHook` hace backup y avisa antes de sobrescribir un hook
  de pre-commit ajeno.
### Added
- Tests de cobertura para `kebelConfig.js`.
### Changed
- Deduplicada la invocación de proveedor repetida en
  review/solomon/diffSummary/doctor (`buildProviderCall`).
- Documentado el modelo de confianza procedimental del verdict store (sin
  firma criptográfica).

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
