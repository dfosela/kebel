import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function hasTestScript(cwd) {
  try {
    const raw = await readFile(path.join(cwd, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    return Boolean(pkg.scripts?.test);
  } catch {
    return false;
  }
}

export async function runProjectTests({ runCapture, cwd = process.cwd() }) {
  if (!(await hasTestScript(cwd))) {
    return { ok: false, ran: false, reason: 'El proyecto no tiene un script "test" en package.json.' };
  }

  try {
    const { stdout, stderr } = await runCapture('npm', ['test'], { cwd, timeoutMs: 300_000 });
    return { ok: true, ran: true, output: `${stdout}${stderr}` };
  } catch (error) {
    return { ok: false, ran: true, reason: 'Los tests del proyecto fallan.', output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}
