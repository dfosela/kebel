import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const VERDICT_DIR = '.kebel';
const VERDICT_FILE = 'verdict.json';

function verdictPath(cwd) {
  return path.join(cwd, VERDICT_DIR, VERDICT_FILE);
}

export async function saveVerdict(record, cwd) {
  await mkdir(path.join(cwd, VERDICT_DIR), { recursive: true });
  await writeFile(verdictPath(cwd), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

export async function loadVerdict(cwd) {
  try {
    const raw = await readFile(verdictPath(cwd), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
