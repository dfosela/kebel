# Kebel

Kebel es una versión **lite** de [Karajan Code](https://karajancode.com):
un orquestador multiagente para desarrollo con IA pensado para quien **no**
tiene suscripciones grandes (Claude Max, ChatGPT Pro...) y necesita ahorrar
tokens al máximo, sin renunciar a las garantías del método Karajan.

Kebel no es un fork de Karajan ni compite con él: es un proyecto nuevo,
inspirado en su filosofía y construido *con* Karajan (dogfooding), con un
subconjunto reducido de funcionalidad y foco explícito en eficiencia de
tokens.

## Lo que Kebel NO recorta

Aunque el alcance es reducido, el método no se recorta:

- **TDD-first estricto** — ningún código de producción sin un test que falle
  primero; la suite nunca se deja en rojo entre commits.
- **Revisión cruzada obligatoria en cada commit** — un modelo distinto al que
  escribió el código lo revisa antes de entrar (`kj review --staged` en este
  repo mientras se construye Kebel; el propio Kebel exigirá el equivalente).
- **Hallazgos de seguridad no overrideables**, ni siquiera en arbitraje.
- **Branch-first** — la rama base solo se mueve vía PR.
- **Gate de git real** — sin veredicto de revisión válido y con el hash del
  diff intacto, el commit se rechaza.

Ver `.karajan/adrs/` para las decisiones de arquitectura registradas.

## Uso

```sh
node bin/kb.js --version
node bin/kb.js --help
node bin/kb.js setup
```

(Aún no publicado en npm — en desarrollo activo.)

## Squeezr, integrado por defecto

[Squeezr](https://www.squeezr.es/) es un proxy local que comprime el
contexto de las llamadas a los agentes (system prompt, diffs, salidas de
test...) para ahorrar tokens, sin cambiar el flujo de trabajo.

Kebel trata Squeezr como una **dependencia externa** — no reimplementa su
lógica de compresión — pero su instalación **no es opcional ni un add-on**:
`kb setup` lo detecta, lo instala (`npm i -g squeezr-ai`) y lo configura como
proxy por defecto automáticamente, sin pedir confirmación adicional más allá
de la que ya implica instalar Kebel. Si algún paso falla (permisos, red, SO
no soportado), `kb setup` avisa con el motivo exacto y las instrucciones
manuales de [squeezr.es/docs/installation](https://www.squeezr.es/docs/installation)
— dejando claro que sin Squeezr el consumo de tokens será mayor, pero sin
bloquear el resto del setup.

## Roles cross-AI de este repo (dogfooding)

Mientras se construye Kebel con Karajan, los roles están fijos y son tres
familias de modelo distintas:

- **brain/coder → Claude** — escribe el código, TDD first.
- **reviewer → Antigravity (Gemini)** — revisa cada diff, nunca el suyo propio.
- **solomon → Codex** — arbitra solo cuando el brain discrepa de un rechazo
  del reviewer; su veredicto se obedece salvo en hallazgos de seguridad.

Detalle completo en `.karajan/adrs/0001-*.md`.

## Estado (MVP v1)

Dentro: CLI (`kb`), setup con Squeezr por defecto, gate de git real,
TDD-first, revisión cruzada, ADRs ligeras en markdown.

Fuera de v1 (a evaluar más adelante): RAG semántico (kaRAGan), watch
cross-repo (kaWATCHan), dashboard de tareas tipo Linear/Jira, integración
SonarQube/Semgrep/OSV-Scanner por defecto.
