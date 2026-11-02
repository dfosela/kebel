import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { preCommitHookScript, installPreCommitHook } from '../src/gitHooks.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-hooks-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('preCommitHookScript invokes kb git-gate-check via node with the given bin path', () => {
  const script = preCommitHookScript('/repo/bin/kb.js');
  assert.match(script, /^#!\/bin\/sh\n/);
  assert.match(script, /node "\/repo\/bin\/kb\.js" git-gate-check/);
});

// Regression coverage for a real audit finding (2026-11-02): binPath was
// interpolated unescaped into a double-quoted sh string — a path containing
// a double quote, backtick, `$` or backslash could break out of the string
// or get shell-expanded/command-substituted when the hook runs.
test('preCommitHookScript escapes shell-significant characters in binPath', () => {
  const script = preCommitHookScript('/repo/bin kb"; rm -rf ~; echo "$(whoami)`id`.js');
  assert.match(script, /^#!\/bin\/sh\nnode "[^\n]*" git-gate-check\n$/);
  const quoted = script.match(/node "([^\n]*)" git-gate-check\n$/)[1];
  assert.equal(
    quoted,
    '/repo/bin kb\\"; rm -rf ~; echo \\"\\$(whoami)\\`id\\`.js',
  );
});

test('installPreCommitHook resolves the hooks dir via git and writes the script there', async () => {
  await withTempDir(async (cwd) => {
    const calls = [];
    const runCapture = async (cmd, args, opts) => {
      calls.push([cmd, args, opts]);
      return { stdout: `${path.join('.git', 'hooks', 'pre-commit')}\n`, stderr: '' };
    };

    const hookPath = await installPreCommitHook({ runCapture, cwd, binPath: '/repo/bin/kb.js' });

    assert.equal(hookPath, path.join(cwd, '.git', 'hooks', 'pre-commit'));
    assert.deepEqual(calls, [
      ['git', ['rev-parse', '--git-path', 'hooks/pre-commit'], { cwd, timeoutMs: 10_000 }],
    ]);
    const written = await readFile(hookPath, 'utf8');
    assert.equal(written, preCommitHookScript('/repo/bin/kb.js'));
  });
});

// Regression coverage for a real audit finding (2026-11-02): a pre-existing
// pre-commit hook not written by Kebel (e.g. husky) used to be silently
// clobbered with no warning and no way to recover its previous content.
test('installPreCommitHook backs up and warns when a foreign pre-commit hook already exists', async () => {
  await withTempDir(async (cwd) => {
    const hooksDir = path.join(cwd, '.git', 'hooks');
    await mkdir(hooksDir, { recursive: true });
    const hookPath = path.join(hooksDir, 'pre-commit');
    await writeFile(hookPath, '#!/bin/sh\nnpx husky-run pre-commit\n', 'utf8');
    const runCapture = async () => ({ stdout: `${path.join('.git', 'hooks', 'pre-commit')}\n`, stderr: '' });
    const logs = [];

    const resultPath = await installPreCommitHook({ runCapture, cwd, binPath: '/repo/bin/kb.js', log: (m) => logs.push(m) });

    assert.equal(resultPath, hookPath);
    const written = await readFile(hookPath, 'utf8');
    assert.equal(written, preCommitHookScript('/repo/bin/kb.js'));
    const backup = await readFile(`${hookPath}.kebel-backup`, 'utf8');
    assert.equal(backup, '#!/bin/sh\nnpx husky-run pre-commit\n');
    assert.match(logs.join('\n'), /kebel-backup/);
  });
});

test('installPreCommitHook overwrites its own previous hook without a backup or a warning', async () => {
  await withTempDir(async (cwd) => {
    const hooksDir = path.join(cwd, '.git', 'hooks');
    await mkdir(hooksDir, { recursive: true });
    const hookPath = path.join(hooksDir, 'pre-commit');
    await writeFile(hookPath, preCommitHookScript('/old/bin/kb.js'), 'utf8');
    const runCapture = async () => ({ stdout: `${path.join('.git', 'hooks', 'pre-commit')}\n`, stderr: '' });
    const logs = [];

    await installPreCommitHook({ runCapture, cwd, binPath: '/repo/bin/kb.js', log: (m) => logs.push(m) });

    const written = await readFile(hookPath, 'utf8');
    assert.equal(written, preCommitHookScript('/repo/bin/kb.js'));
    await assert.rejects(() => readFile(`${hookPath}.kebel-backup`, 'utf8'));
    assert.equal(logs.length, 0);
  });
});

test('installPreCommitHook does not back up anything when there was no previous hook', async () => {
  await withTempDir(async (cwd) => {
    const runCapture = async () => ({ stdout: `${path.join('.git', 'hooks', 'pre-commit')}\n`, stderr: '' });
    const logs = [];

    const hookPath = await installPreCommitHook({ runCapture, cwd, binPath: '/repo/bin/kb.js', log: (m) => logs.push(m) });

    await assert.rejects(() => readFile(`${hookPath}.kebel-backup`, 'utf8'));
    assert.equal(logs.length, 0);
  });
});
