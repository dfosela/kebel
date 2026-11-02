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

// Regression coverage for a real audit finding (2026-11-02): the scaffold
// linked to the wrong repo (manufosela/kebel) and suggested running a
// `kb-tdd-check` command that doesn't exist — the TDD check runs
// automatically via the git pre-commit hook, not as a `kb` subcommand.
test('buildScaffoldContent links to the real repo and does not suggest a nonexistent kb-tdd-check command', () => {
  const content = buildScaffoldContent({ roles: { coder: 'claude', reviewer: null, solomon: null } });
  assert.match(content, /https:\/\/github\.com\/dfosela\/kebel/);
  assert.doesNotMatch(content, /`kb-tdd-check`/);
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
