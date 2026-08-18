import { createHash } from 'node:crypto';

export function hashDiff(diffText) {
  return createHash('sha256').update(diffText, 'utf8').digest('hex');
}

export async function getStagedDiff({ runCapture, cwd }) {
  const { stdout } = await runCapture('git', ['diff', '--cached'], { cwd, timeoutMs: 30_000 });
  return stdout;
}
