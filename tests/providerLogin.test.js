import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupProviders } from '../src/providerLogin.js';

const NOT_INSTALLED = 'binario no encontrado en PATH';
const NOT_LOGGED = 'no parece estar logado';

function fakeWorld(initial) {
  const state = { ...initial };
  const calls = [];
  return {
    calls,
    state,
    checkProvider: async ({ provider }) => {
      const s = state[provider];
      if (s === 'ok') return { provider, ok: true };
      return { provider, ok: false, reason: s === 'missing' ? NOT_INSTALLED : NOT_LOGGED };
    },
    runInteractive: async (cmd, args) => {
      calls.push([cmd, ...args]);
      if (cmd === 'npm') state.codex = 'nologin';
      if (cmd === 'codex' && args[0] === 'login') state.codex = 'ok';
      if (cmd === 'claude') state.claude = 'ok';
    },
  };
}

const base = { run: async () => {}, runCapture: async () => {} };

test('offers to log in to an installed AI without a session and re-checks it', async () => {
  const world = fakeWorld({ claude: 'nologin', codex: 'ok', gemini: 'missing', agy: 'missing' });
  const asked = [];
  const available = await setupProviders({
    ...base,
    log: () => {},
    isInteractive: true,
    ask: async (text) => { asked.push(text); return text.includes('Claude'); },
    checkProvider: world.checkProvider,
    runInteractive: world.runInteractive,
  });
  assert.ok(asked.some((t) => /iniciar sesión en Claude/.test(t)));
  assert.deepEqual(world.calls[0], ['claude', 'auth', 'login']);
  assert.deepEqual(available, ['claude', 'codex']);
});

test('offers to install an npm-installable AI, then logs in and re-checks it', async () => {
  const world = fakeWorld({ claude: 'ok', codex: 'missing', gemini: 'missing', agy: 'missing' });
  const available = await setupProviders({
    ...base,
    log: () => {},
    isInteractive: true,
    ask: async (text) => text.includes('ChatGPT'),
    checkProvider: world.checkProvider,
    runInteractive: world.runInteractive,
  });
  assert.deepEqual(world.calls, [
    ['npm', 'install', '-g', '@openai/codex'],
    ['codex', 'login'],
  ]);
  assert.deepEqual(available, ['claude', 'codex']);
});

test('a declined offer runs nothing and leaves the AI out', async () => {
  const world = fakeWorld({ claude: 'ok', codex: 'nologin', gemini: 'missing', agy: 'missing' });
  const available = await setupProviders({
    ...base,
    log: () => {},
    isInteractive: true,
    ask: async () => false,
    checkProvider: world.checkProvider,
    runInteractive: world.runInteractive,
  });
  assert.deepEqual(world.calls, []);
  assert.deepEqual(available, ['claude']);
});

test('without an interactive terminal it never asks, only reports how to add them', async () => {
  const world = fakeWorld({ claude: 'ok', codex: 'missing', gemini: 'nologin', agy: 'missing' });
  const logs = [];
  const available = await setupProviders({
    ...base,
    log: (m) => logs.push(m),
    isInteractive: false,
    ask: async () => { throw new Error('must not ask'); },
    checkProvider: world.checkProvider,
    runInteractive: world.runInteractive,
  });
  assert.deepEqual(world.calls, []);
  assert.deepEqual(available, ['claude']);
  assert.match(logs.join('\n'), /npm install -g @openai\/codex/);
  assert.match(logs.join('\n'), /IAs detectadas/);
});

test('a login that still fails afterwards is reported and the AI stays out', async () => {
  const world = fakeWorld({ claude: 'ok', codex: 'nologin', gemini: 'missing', agy: 'missing' });
  const logs = [];
  const available = await setupProviders({
    ...base,
    log: (m) => logs.push(m),
    isInteractive: true,
    ask: async () => true,
    checkProvider: world.checkProvider,
    runInteractive: async (cmd, args) => { world.calls.push([cmd, ...args]); },
  });
  assert.deepEqual(available, ['claude']);
  assert.match(logs.join('\n'), /ChatGPT \(Codex\) sigue sin estar disponible/);
});
