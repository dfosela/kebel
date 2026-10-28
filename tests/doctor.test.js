import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkProvider, runDoctor } from '../src/doctor.js';
import { saveConfig } from '../src/kebelConfig.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-doctor-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('checkProvider reports "rol no asignado" when no provider is given', async () => {
  const result = await checkProvider({ provider: null, run: async () => {}, runCapture: async () => ({ stdout: '' }) });
  assert.deepEqual(result, { provider: null, ok: false, reason: 'rol no asignado' });
});

test('checkProvider reports a missing binary without attempting a prompt', async () => {
  const runCaptureCalls = [];
  const result = await checkProvider({
    provider: 'claude',
    run: async () => { throw new Error('not found'); },
    runCapture: async (...args) => { runCaptureCalls.push(args); return { stdout: '' }; },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /binario no encontrado/);
  assert.deepEqual(runCaptureCalls, []);
});

test('checkProvider sends a minimal prompt and reports ok when it succeeds', async () => {
  const result = await checkProvider({
    provider: 'claude',
    run: async () => {},
    runCapture: async (cmd, args, opts) => {
      assert.equal(cmd, 'claude');
      assert.equal(opts.input, 'ping');
      return { stdout: 'pong', stderr: '' };
    },
  });

  assert.deepEqual(result, { provider: 'claude', ok: true });
});

test('checkProvider classifies an authentication failure from the minimal prompt', async () => {
  const result = await checkProvider({
    provider: 'agy',
    run: async () => {},
    runCapture: async () => { throw new Error('401 unauthorized: please login'); },
  });

  assert.equal(result.provider, 'agy');
  assert.equal(result.ok, false);
  assert.match(result.reason, /logado/i);
});

test('checkProvider reads the auth error from stderr, not just error.message', async () => {
  const result = await checkProvider({
    provider: 'codex',
    run: async () => {},
    runCapture: async () => {
      throw Object.assign(new Error('codex exec exited with code 1'), {
        stderr: 'ERROR: unexpected status 401 Unauthorized: missing scopes',
        stdout: '',
      });
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /logado/i);
});

test('runDoctor reports a missing config without checking providers', async () => {
  await withTempDir(async (cwd) => {
    const result = await runDoctor({ run: async () => {}, runCapture: async () => ({ stdout: '' }), cwd });

    assert.equal(result.config.ok, false);
    assert.deepEqual(result.providers, []);
  });
});

test('runDoctor checks git, every assigned role and squeezr when config exists', async () => {
  await withTempDir(async (cwd) => {
    await saveConfig({ version: 1, roles: { coder: 'claude', reviewer: 'agy', solomon: null } }, cwd);

    const run = async (cmd) => {
      if (cmd === 'git' || cmd === 'claude' || cmd === 'agy' || cmd === 'squeezr') return;
      throw new Error('not found');
    };
    const runCapture = async () => ({ stdout: 'pong', stderr: '' });

    const result = await runDoctor({ run, runCapture, cwd });

    assert.equal(result.git.ok, true);
    assert.equal(result.config.ok, true);
    assert.equal(result.squeezr.ok, true);
    assert.deepEqual(
      result.providers.map((p) => [p.role, p.provider, p.ok]),
      [['coder', 'claude', true], ['reviewer', 'agy', true], ['solomon', null, false]],
    );
  });
});
