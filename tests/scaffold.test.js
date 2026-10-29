import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildScaffoldContent, writeScaffoldFiles, SCAFFOLD_FILENAMES } from '../src/scaffold.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-scaffold-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('buildScaffoldContent mentions each configured role and the key kb commands', () => {
  const content = buildScaffoldContent({ roles: { coder: 'claude', reviewer: 'agy', solomon: null } });
  assert.match(content, /coder: claude/);
  assert.match(content, /reviewer: agy/);
  assert.match(content, /solomon: — sin asignar/);
  assert.match(content, /kb review --staged/);
  assert.match(content, /kb doctor/);
});

test('writeScaffoldFiles creates AGENTS.md and CLAUDE.md when neither exists', async () => {
  await withTempDir(async (cwd) => {
    const results = await writeScaffoldFiles({ roles: { coder: 'claude', reviewer: null, solomon: null }, cwd });

    assert.deepEqual(results, SCAFFOLD_FILENAMES.map((filename) => ({ filename, written: true })));
    for (const filename of SCAFFOLD_FILENAMES) {
      const content = await readFile(path.join(cwd, filename), 'utf8');
      assert.match(content, /coder: claude/);
    }
  });
});

test('writeScaffoldFiles never overwrites a file that already exists', async () => {
  await withTempDir(async (cwd) => {
    await writeFile(path.join(cwd, 'AGENTS.md'), 'contenido ya existente\n', 'utf8');

    const results = await writeScaffoldFiles({ roles: { coder: 'claude', reviewer: null, solomon: null }, cwd });

    assert.deepEqual(results, [
      { filename: 'AGENTS.md', written: false },
      { filename: 'CLAUDE.md', written: true },
    ]);
    const untouched = await readFile(path.join(cwd, 'AGENTS.md'), 'utf8');
    assert.equal(untouched, 'contenido ya existente\n');
  });
});
