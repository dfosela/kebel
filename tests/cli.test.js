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

test('kb review --staged delegates to the injected reviewStaged and exits 0 on approval', async () => {
  const fakeReviewStaged = async () => ({
    verdict: 'approved',
    reason: 'looks good',
    securityFinding: false,
  });
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['review', '--staged'], {
    version: '0.1.0',
    stdout,
    reviewStaged: fakeReviewStaged,
  });

  assert.equal(code, 0);
  assert.match(written, /approved/);
});

test('kb review --staged exits non-zero on rejection', async () => {
  const fakeReviewStaged = async () => ({
    verdict: 'rejected',
    reason: 'missing tests',
    securityFinding: false,
  });
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['review', '--staged'], {
    version: '0.1.0',
    stdout,
    reviewStaged: fakeReviewStaged,
  });

  assert.equal(code, 1);
  assert.match(written, /missing tests/);
});

test('kb review --staged exits non-zero and prints a clear message when reviewStaged throws', async () => {
  const fakeReviewStaged = async () => {
    throw new Error('No hay cambios staged para revisar.');
  };
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['review', '--staged'], {
    version: '0.1.0',
    stdout,
    reviewStaged: fakeReviewStaged,
  });

  assert.equal(code, 1);
  assert.match(written, /No hay cambios staged/);
});

test('kb git-gate-check exits 0 and confirms when the injected checkGitGate approves', async () => {
  const fakeCheckGitGate = async () => ({ ok: true });
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['git-gate-check'], { version: '0.1.0', stdout, checkGitGate: fakeCheckGitGate });

  assert.equal(code, 0);
  assert.match(written, /Gate de git/);
});

test('kb git-gate-check exits non-zero and prints the reason when the gate rejects', async () => {
  const fakeCheckGitGate = async () => ({ ok: false, reason: 'No hay veredicto de revisión.' });
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['git-gate-check'], { version: '0.1.0', stdout, checkGitGate: fakeCheckGitGate });

  assert.equal(code, 1);
  assert.match(written, /No hay veredicto de revisión/);
});

test('kb git-gate-check also runs the injected checkTddGate and blocks on a TDD-first violation', async () => {
  const fakeCheckGitGate = async () => ({ ok: true });
  const fakeCheckTddGate = async () => ({ ok: false, reason: 'TDD-first: hay código sin test correspondiente.' });
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['git-gate-check'], {
    version: '0.1.0',
    stdout,
    checkGitGate: fakeCheckGitGate,
    checkTddGate: fakeCheckTddGate,
  });

  assert.equal(code, 1);
  assert.match(written, /TDD-first/);
});

test('kb git-gate-check does not run checkTddGate when checkGitGate already rejects', async () => {
  const fakeCheckGitGate = async () => ({ ok: false, reason: 'No hay veredicto de revisión.' });
  const tddCalls = [];
  const fakeCheckTddGate = async () => {
    tddCalls.push('called');
    return { ok: true };
  };
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['git-gate-check'], {
    version: '0.1.0',
    stdout,
    checkGitGate: fakeCheckGitGate,
    checkTddGate: fakeCheckTddGate,
  });

  assert.equal(code, 1);
  assert.deepEqual(tddCalls, []);
});
