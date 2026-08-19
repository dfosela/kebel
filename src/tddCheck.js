import { existsSync } from 'node:fs';
import path from 'node:path';

const SOURCE_PATTERN = /^src\/(.+)\.js$/;

export function expectedTestPath(sourceFile) {
  const match = SOURCE_PATTERN.exec(sourceFile.replace(/\\/g, '/'));
  if (!match) return null;
  return `tests/${match[1]}.test.js`;
}

export function evaluateTddCheck({ files, testFileExists }) {
  const missing = files
    .map((source) => ({ source, expectedTest: expectedTestPath(source) }))
    .filter(({ expectedTest }) => expectedTest && !testFileExists(expectedTest));

  if (missing.length > 0) {
    const list = missing.map(({ source, expectedTest }) => `  - ${source} → falta ${expectedTest}`).join('\n');
    return {
      ok: false,
      reason: `TDD-first: hay código sin test correspondiente.\n${list}`,
    };
  }
  return { ok: true };
}

export async function checkTddGate({
  runCapture,
  cwd = process.cwd(),
  fileExists = (relativePath) => existsSync(path.resolve(cwd, relativePath)),
}) {
  const { stdout } = await runCapture('git', ['diff', '--cached', '--name-only'], { cwd, timeoutMs: 10_000 });
  const files = stdout.split('\n').map((f) => f.trim()).filter(Boolean);
  return evaluateTddCheck({ files, testFileExists: fileExists });
}
