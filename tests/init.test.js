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

test('runInit detects providers, assigns roles, writes config and runs Squeezr setup', async () => {
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
    const logs = [];

    const config = await runInit({ run, log: (m) => logs.push(m), ensureSqueezr, cwd });

    assert.equal(config.roles.coder, 'claude');
    assert.equal(config.roles.reviewer, 'agy');
    assert.equal(config.roles.solomon, null);
    assert.deepEqual(squeezrCalls, ['called']);

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

    const first = await runInit({ run, log: () => {}, ensureSqueezr, cwd });
    const second = await runInit({ run, log: () => {}, ensureSqueezr, cwd });

    assert.deepEqual(first, second);
  });
});
