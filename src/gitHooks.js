import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import path from 'node:path';

const HOOK_MARKER = 'git-gate-check';

function escapeDoubleQuotedShellArg(value) {
  return value.replace(/[\\"$`]/g, '\\$&');
}

export function preCommitHookScript(binPath) {
  return `#!/bin/sh\nnode "${escapeDoubleQuotedShellArg(binPath)}" git-gate-check\n`;
}

async function readExistingHook(hookPath) {
  try {
    return await readFile(hookPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function installPreCommitHook({ runCapture, cwd, binPath, log }) {
  const { stdout } = await runCapture('git', ['rev-parse', '--git-path', 'hooks/pre-commit'], {
    cwd,
    timeoutMs: 10_000,
  });
  const hookPath = path.resolve(cwd, stdout.trim());
  await mkdir(path.dirname(hookPath), { recursive: true });

  const existing = await readExistingHook(hookPath);
  if (existing !== null && !existing.includes(HOOK_MARKER)) {
    const backupPath = `${hookPath}.kebel-backup`;
    await writeFile(backupPath, existing, 'utf8');
    log?.(`⚠ Ya había un hook de pre-commit que no era de Kebel en ${hookPath}; se guardó una copia en ${backupPath} antes de sobrescribirlo.`);
  }

  await writeFile(hookPath, preCommitHookScript(binPath), 'utf8');
  await chmod(hookPath, 0o755);
  return hookPath;
}
