import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureSqueezr } from '../src/squeezr.js';

function makeLogger() {
  const lines = [];
  return { log: (msg) => lines.push(msg), lines };
}

test('ensureSqueezr skips install when squeezr is already available and setup succeeds', async () => {
  const calls = [];
  const run = async (cmd, args) => {
    calls.push([cmd, ...args]);
  };
  const { log } = makeLogger();

  const result = await ensureSqueezr({ run, log });

  assert.deepEqual(result, { installed: true, configured: true });
  assert.deepEqual(calls, [
    ['squeezr', '--version'],
    ['squeezr', 'setup'],
  ]);
});

test('ensureSqueezr installs squeezr-ai when missing, then runs setup', async () => {
  const calls = [];
  const run = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === 'squeezr' && args[0] === '--version') throw new Error('not found');
  };

  const result = await ensureSqueezr({ run, log: () => {} });

  assert.deepEqual(result, { installed: true, configured: true });
  assert.deepEqual(calls, [
    ['squeezr', '--version'],
    ['npm', 'install', '-g', 'squeezr-ai'],
    ['squeezr', 'setup'],
  ]);
});

test('ensureSqueezr reports a clear failure and manual instructions when install fails', async () => {
  const run = async (cmd, args) => {
    if (cmd === 'squeezr' && args[0] === '--version') throw new Error('not found');
    if (cmd === 'npm') throw new Error('EACCES: permission denied');
  };
  const { log, lines } = makeLogger();

  const result = await ensureSqueezr({ run, log });

  assert.equal(result.installed, false);
  assert.equal(result.configured, false);
  assert.match(result.reason, /EACCES/);
  assert.ok(lines.some((l) => l.includes('squeezr.es/docs/installation')));
  assert.ok(lines.some((l) => l.toLowerCase().includes('mayor')));
});

test('ensureSqueezr reports a clear failure when setup fails after a successful install', async () => {
  const run = async (cmd, args) => {
    if (cmd === 'squeezr' && args[0] === '--version') throw new Error('not found');
    if (cmd === 'squeezr' && args[0] === 'setup') throw new Error('network unreachable');
  };
  const { log, lines } = makeLogger();

  const result = await ensureSqueezr({ run, log });

  assert.equal(result.installed, true);
  assert.equal(result.configured, false);
  assert.match(result.reason, /network unreachable/);
  assert.ok(lines.some((l) => l.includes('squeezr.es/docs/installation')));
});
