import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInit } from '../src/init.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-init-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function fakeInstallPreCommitHook(calls) {
  return async (opts) => {
    calls.push(opts);
    return path.join(opts.cwd, '.git', 'hooks', 'pre-commit');
  };
}

test('runInit detects providers, assigns roles, writes config, runs Squeezr setup and installs the git gate hook', async () => {
  await withTempDir(async (cwd) => {
    const run = async (cmd) => {
      if (['claude', 'agy'].includes(cmd)) return;
      throw new Error('not found');
    };
    const squeezrCalls = [];
    const ensureSqueezr = async () => {
      squeezrCalls.push('called');
      return { installed: true, configured: true };
    };
    const hookCalls = [];
    const logs = [];

    const config = await runInit({
      run,
      log: (m) => logs.push(m),
      ensureSqueezr,
      cwd,
      binPath: '/repo/bin/kb.js',
      installPreCommitHook: fakeInstallPreCommitHook(hookCalls),
    });

    assert.equal(config.roles.coder, 'claude');
    assert.equal(config.roles.reviewer, 'agy');
    assert.equal(config.roles.solomon, null);
    assert.deepEqual(squeezrCalls, ['called']);
    assert.equal(hookCalls.length, 1);
    assert.equal(typeof hookCalls[0].runCapture, 'function');
    assert.equal(hookCalls[0].cwd, cwd);
    assert.equal(hookCalls[0].binPath, '/repo/bin/kb.js');
    assert.match(logs.join('\n'), /pre-commit/);

    const saved = JSON.parse(await readFile(path.join(cwd, '.kebel', 'kebel.config.json'), 'utf8'));
    assert.equal(saved.roles.coder, 'claude');
    assert.equal(saved.roles.reviewer, 'agy');
  });
});

test('runInit is idempotent: a second run reports the existing config instead of overwriting it', async () => {
  await withTempDir(async (cwd) => {
    const run = async (cmd) => {
      if (cmd === 'claude') return;
      throw new Error('not found');
    };
    const ensureSqueezr = async () => ({ installed: true, configured: true });
    const installPreCommitHook = fakeInstallPreCommitHook([]);

    const first = await runInit({ run, log: () => {}, ensureSqueezr, cwd, installPreCommitHook });
    const second = await runInit({ run, log: () => {}, ensureSqueezr, cwd, installPreCommitHook });

    assert.deepEqual(first, second);
  });
});
