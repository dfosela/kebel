import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// TRUST MODEL: this is plain, unsigned JSON — the gate trusts whatever is on
// disk, so the same agent that writes code could in principle write a fake
// approved verdict here itself. Cryptographically signing it would not
// close that gap: the threat model's adversary already has shell access to
// the repo, so it could just as easily read a signing key stored anywhere
// reachable from this machine. The real boundary is procedural, not
// cryptographic: a human reviews what actually gets pushed/merged.
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
