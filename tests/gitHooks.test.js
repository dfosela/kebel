import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
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
