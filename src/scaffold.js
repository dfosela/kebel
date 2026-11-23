import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const SCAFFOLD_FILENAMES = ['AGENTS.md', 'CLAUDE.md'];
export const TASKS_RULES_MARKER = '<!-- kebel:tasks -->';

const TASKS_RULES = `${TASKS_RULES_MARKER}
## Cómo trabajar con las tareas (TASKS.md)

\`TASKS.md\` es la lista de tareas que ve y edita tu usuario; Kebel la sincroniza con sus tarjetas.

1. Con el primer encargo del usuario, divídelo en tareas pequeñas y regístralas en orden con
   \`kb card add "<título claro>" --id <id>\`. Aparecen en TASKS.md.
2. Haz las tareas en el orden de "Pendiente" de TASKS.md. Al empezar una, \`kb card move <id> running\`;
   al terminarla, \`kb card move <id> done\`.
3. Antes de empezar cada tarea, ejecuta \`kb card sync\`: recoge lo que el usuario haya escrito o
   cambiado en TASKS.md. Si lista tareas "por revisar", reescríbelas en TASKS.md con un título claro
   y su id, divide las grandes, ordénalas y vuelve a ejecutar \`kb card sync\`.
4. Si una tarea no está clara, o dudas del orden, pregunta a tu usuario antes de seguir.
5. Si el usuario te pide algo nuevo en el chat, regístralo como tarea con \`kb card add\` y, si no es
   obvio dónde va en el orden, pregúntaselo.
`;

async function defaultFileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function buildScaffoldContent({ roles }) {
  return `# Kebel

Este proyecto usa [Kebel](https://github.com/dfosela/kebel) para TDD-first,
revisión cruzada entre IAs y gates de git reales.

## Roles de IA configurados

- coder: ${roles.coder ?? '— sin asignar'}
- reviewer: ${roles.reviewer ?? '— sin asignar'}
- solomon: ${roles.solomon ?? '— sin asignar'}

## Convenciones

- Antes de cada commit: \`kb review --staged\`. El commit se bloquea sin un
  veredicto aprobado y con el hash del diff intacto.
- Todo archivo en \`src/\` necesita su test correspondiente en \`tests/\`
  antes de commitear — se comprueba automáticamente en el hook de
  pre-commit, no es un subcomando \`kb\` a ejecutar a mano.
- ADRs ligeras en markdown: \`kb adr add/list\`.
- Diagnóstico del setup (incluye login de cada proveedor): \`kb doctor\`.

${TASKS_RULES}`;
}

export async function writeScaffoldFiles({
  roles,
  cwd = process.cwd(),
  fileExists = defaultFileExists,
  writeFileImpl = writeFile,
  readFileImpl = readFile,
}) {
  const content = buildScaffoldContent({ roles });
  return Promise.all(
    SCAFFOLD_FILENAMES.map(async (filename) => {
      const filePath = path.join(cwd, filename);
      if (!(await fileExists(filePath))) {
        await writeFileImpl(filePath, content, 'utf8');
        return { filename, written: true, rulesAdded: false };
      }
      // An existing file is the person's: only the TASKS.md rules are appended, once.
      const existing = await readFileImpl(filePath, 'utf8');
      if (existing.includes(TASKS_RULES_MARKER)) return { filename, written: false, rulesAdded: false };
      await writeFileImpl(filePath, `${existing.trimEnd()}\n\n${TASKS_RULES}`, 'utf8');
      return { filename, written: false, rulesAdded: true };
    }),
  );
}
