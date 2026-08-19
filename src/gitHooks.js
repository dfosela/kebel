import { writeFile, mkdir, chmod } from 'node:fs/promises';
import path from 'node:path';

export function preCommitHookScript(binPath) {
  return `#!/bin/sh\nnode "${binPath}" git-gate-check\n`;
}

export async function installPreCommitHook({ runCapture, cwd, binPath }) {
  const { stdout } = await runCapture('git', ['rev-parse', '--git-path', 'hooks/pre-commit'], {
    cwd,
    timeoutMs: 10_000,
  });
  const hookPath = path.resolve(cwd, stdout.trim());
  await mkdir(path.dirname(hookPath), { recursive: true });
  await writeFile(hookPath, preCommitHookScript(binPath), 'utf8');
  await chmod(hookPath, 0o755);
  return hookPath;
}
