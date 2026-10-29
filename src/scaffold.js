import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const SCAFFOLD_FILENAMES = ['AGENTS.md', 'CLAUDE.md'];

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

Este proyecto usa [Kebel](https://github.com/manufosela/kebel) para TDD-first,
revisión cruzada entre IAs y gates de git reales.

## Roles de IA configurados

- coder: ${roles.coder ?? '— sin asignar'}
- reviewer: ${roles.reviewer ?? '— sin asignar'}
- solomon: ${roles.solomon ?? '— sin asignar'}

## Convenciones

- Antes de cada commit: \`kb review --staged\`. El commit se bloquea sin un
  veredicto aprobado y con el hash del diff intacto.
- Todo archivo en \`src/\` necesita su test correspondiente en \`tests/\`
  antes de commitear (\`kb-tdd-check\`).
- Tareas y su estado: \`kb card add/list/move\`.
- ADRs ligeras en markdown: \`kb adr add/list\`.
- Diagnóstico del setup (incluye login de cada proveedor): \`kb doctor\`.
`;
}

export async function writeScaffoldFiles({
  roles,
  cwd = process.cwd(),
  fileExists = defaultFileExists,
  writeFileImpl = writeFile,
}) {
  const content = buildScaffoldContent({ roles });
  return Promise.all(
    SCAFFOLD_FILENAMES.map(async (filename) => {
      const filePath = path.join(cwd, filename);
      if (await fileExists(filePath)) {
        return { filename, written: false };
      }
      await writeFileImpl(filePath, content, 'utf8');
      return { filename, written: true };
    }),
  );
}
