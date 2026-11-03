# Contribuir a Kebel

## Bugs

Abre un [issue](https://github.com/dfosela/kebel/issues/new/choose) con el
comando exacto que ejecutaste, la salida que obtuviste y la que esperabas.

## Features nuevas

Abre primero una [Discussion](https://github.com/dfosela/kebel/discussions),
no un PR. Explica qué necesitas y por qué. Habla primero, codea después —
así evitamos que trabajes en algo que no encaje con el alcance deliberadamente
reducido de Kebel (ver "filosofía lite" en el [README](README.md)).

## Abrir un PR

- Rama desde `main`.
- Incluye tests, o el PR no se revisará, salvo excepción justificada.
- [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`/`fix:`/
  `refactor:`/`docs:`/`test:`/`chore:`), asunto en minúsculas, header ≤100
  caracteres.
- Cambios enfocados: un propósito por PR.
- Sin restricción especial por tocar un archivo de configuración o workflow:
  se revisa como cualquier otro PR.

## Estilo de código

- JavaScript plano con ES modules (`import`/`export`), sin TypeScript ni
  pasos de transpilación.
- SOLID, DRY, KISS, YAGNI. `const` por defecto, funciones flecha, template
  literals.

## Tiempos

Issues y PRs se revisan en unos días.
