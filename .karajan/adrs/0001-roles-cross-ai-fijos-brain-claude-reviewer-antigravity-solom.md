# Roles cross-AI fijos (brain=Claude, reviewer=Antigravity, solomon=Codex) y Squeezr como dependencia externa auto-instalada

Status: accepted
Date: 2026-08-18

## Context

Kebel es una versión lite de Karajan Code pensada para gente sin suscripciones grandes (Claude Max, ChatGPT Pro), con foco explícito en ahorro de tokens. Necesita: (1) una asignación de roles de IA cruzada estable para el propio desarrollo de Kebel via dogfooding con kj, y (2) una estrategia de compresión de contexto que no dependa de reimplementar lógica de proxy dentro de Kebel.

## Decision

Asignación fija de roles v4 (brain != reviewer != solomon, tres familias de modelo distintas): brain/coder=Claude (Claude Code) — escribe código, TDD first, absorbe briefs de rol (triage/planner/architect/tester/security/audit) vía 'kj brief'. reviewer=Antigravity (familia Gemini de Google) — revisa cada diff en 'kj review --staged', nunca revisa su propio código. solomon=Codex (OpenAI) — arbitra únicamente cuando el brain discrepa de un rechazo del reviewer, vía 'kj solomon --position'; su veredicto se registra y se obedece salvo en hallazgos de seguridad, que ningún rol puede sobreescribir. Configurado en .karajan/kj.config.yml (coder: claude, reviewer: agy, roles.solomon.provider: codex), heredando el resto de defaults de Karajan. Squeezr (squeezr-ai, squeezr.es) se trata como dependencia EXTERNA: Kebel no reimplementa su lógica de compresión de contexto. El setup de Kebel debe detectar Squeezr, instalarlo (npm i -g squeezr-ai) y ejecutar 'squeezr setup' automáticamente por defecto -no opcional-, y solo si falla (permisos/red/SO no soportado) avisar con el motivo y las instrucciones manuales de squeezr.es/docs/installation, dejando claro que sin Squeezr el consumo de tokens será mayor.

## Consequences

Ventajas: separación real de intereses en cada revisión (ningún modelo revisa su propio código ni arbitra sobre sí mismo), arbitraje de terceros ya soportado nativamente por 'kj solomon' sin lógica adicional, y ahorro de tokens desde el primer uso sin pasos manuales para el usuario. Riesgos aceptados: dependemos de que 3 cuentas/CLIs de IA distintas estén disponibles y autenticadas (Claude, Antigravity, Codex) -mayor fricción de setup que un solo proveedor-; Antigravity (agy) no es la 'Gemini CLI' oficial que Squeezr documenta soportar explícitamente, así que la integración proxy Squeezr<->Antigravity puede necesitar validación o un adaptador propio; si Squeezr no está disponible en el SO del usuario, Kebel sigue funcionando pero sin el ahorro de tokens (nunca se debilita TDD ni revisión cruzada por esto).
