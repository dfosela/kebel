import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildScaffoldContent, writeScaffoldFiles, SCAFFOLD_FILENAMES, TASKS_RULES_MARKER } from '../src/scaffold.js';

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

    assert.deepEqual(results, SCAFFOLD_FILENAMES.map((filename) => ({ filename, written: true, rulesAdded: false })));
    for (const filename of SCAFFOLD_FILENAMES) {
      const content = await readFile(path.join(cwd, filename), 'utf8');
      assert.match(content, /coder: claude/);
    }
  });
});

test('the scaffold tells the AI how to work with TASKS.md', () => {
  const content = buildScaffoldContent({ roles: { coder: 'claude', reviewer: null, solomon: null } });
  assert.match(content, /divide/i);
  assert.match(content, /kb card add/);
  assert.match(content, /orden de "Pendiente"/);
  assert.match(content, /Antes de empezar cada tarea, ejecuta `kb card sync`/);
  assert.match(content, /pregunta a tu usuario/i);
  assert.match(content, /te pide algo nuevo en el chat/);
});

test('writeScaffoldFiles keeps an existing file and adds the TASKS.md rules to it only once', async () => {
  await withTempDir(async (cwd) => {
    await writeFile(path.join(cwd, 'AGENTS.md'), 'contenido ya existente\n', 'utf8');
    const roles = { coder: 'claude', reviewer: null, solomon: null };

    const results = await writeScaffoldFiles({ roles, cwd });
    await writeScaffoldFiles({ roles, cwd });

    assert.deepEqual(results, [
      { filename: 'AGENTS.md', written: false, rulesAdded: true },
      { filename: 'CLAUDE.md', written: true, rulesAdded: false },
    ]);
    const content = await readFile(path.join(cwd, 'AGENTS.md'), 'utf8');
    assert.match(content, /^contenido ya existente\n/);
    assert.equal(content.split(TASKS_RULES_MARKER).length, 2, 'the rules are added exactly once');
    assert.doesNotMatch(content, /coder: claude/);
  });
});
