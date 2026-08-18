import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { runCli } from '../src/cli.js';

const binPath = fileURLToPath(new URL('../bin/kb.js', import.meta.url));
const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

test('kb --version prints the package version and exits 0', () => {
  const result = spawnSync(process.execPath, [binPath, '--version'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), pkg.version);
});

test('kb --help prints usage and exits 0', () => {
  const result = spawnSync(process.execPath, [binPath, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: kb/);
});

test('kb setup delegates to the injected ensureSqueezr and prints its log lines', async () => {
  const calls = [];
  const fakeEnsureSqueezr = async ({ log }) => {
    calls.push('called');
    log('fake log line');
    return { installed: true, configured: true };
  };
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['setup'], { version: '0.1.0', stdout, ensureSqueezr: fakeEnsureSqueezr });

  assert.equal(code, 0);
  assert.deepEqual(calls, ['called']);
  assert.match(written, /fake log line/);
});

test('kb init delegates to the injected runInit', async () => {
  const calls = [];
  const fakeRunInit = async ({ log }) => {
    calls.push('called');
    log('fake init log line');
    return { version: 1, roles: { coder: 'claude', reviewer: null, solomon: null } };
  };
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['init'], { version: '0.1.0', stdout, runInit: fakeRunInit });

  assert.equal(code, 0);
  assert.deepEqual(calls, ['called']);
  assert.match(written, /fake init log line/);
});
