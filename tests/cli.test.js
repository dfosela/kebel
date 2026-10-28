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

test('kb solomon delegates to the injected runSolomon and exits 0 on approval', async () => {
  const fakeRunSolomon = async () => ({ verdict: 'approved', reason: 'false alarm', solomon: true });
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['solomon'], { version: '0.1.0', stdout, runSolomon: fakeRunSolomon });

  assert.equal(code, 0);
  assert.match(written, /approved/);
});

test('kb solomon exits non-zero on a sustained rejection', async () => {
  const fakeRunSolomon = async () => ({ verdict: 'rejected', reason: 'rejection upheld' });
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['solomon'], { version: '0.1.0', stdout, runSolomon: fakeRunSolomon });

  assert.equal(code, 1);
  assert.match(written, /rejection upheld/);
});

test('kb solomon exits non-zero and prints a clear message when runSolomon throws (e.g. a security finding)', async () => {
  const fakeRunSolomon = async () => {
    throw new Error('Hallazgo de seguridad: no se puede arbitrar, ni con Solomon.');
  };
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['solomon'], { version: '0.1.0', stdout, runSolomon: fakeRunSolomon });

  assert.equal(code, 1);
  assert.match(written, /Hallazgo de seguridad/);
});

test('kb adr add delegates to the injected addAdr with the parsed title and flags', async () => {
  const calls = [];
  const fakeAddAdr = async (opts) => {
    calls.push(opts);
    return { filename: '0001-use-subprocess-clis.md' };
  };
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['adr', 'add', 'Use', 'subprocess', 'CLIs', '--context', 'why'], {
    version: '0.1.0',
    stdout,
    addAdr: fakeAddAdr,
  });

  assert.equal(code, 0);
  assert.deepEqual(calls, [{ title: 'Use subprocess CLIs', context: 'why', decision: '', consequences: '' }]);
  assert.match(written, /0001-use-subprocess-clis\.md/);
});

test('kb adr add exits non-zero with a clear message when no title is given', async () => {
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['adr', 'add'], { version: '0.1.0', stdout });

  assert.equal(code, 1);
  assert.match(written, /título/);
});

test('kb adr list prints every ADR from the injected listAdrs', async () => {
  const fakeListAdrs = async () => [{ filename: '0001-foo.md', title: 'Foo', status: 'proposed', date: '2026-08-18' }];
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['adr', 'list'], { version: '0.1.0', stdout, listAdrs: fakeListAdrs });

  assert.equal(code, 0);
  assert.match(written, /0001-foo\.md/);
  assert.match(written, /Foo/);
});

test('kb adr list prints a helpful message when there are no ADRs yet', async () => {
  const fakeListAdrs = async () => [];
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['adr', 'list'], { version: '0.1.0', stdout, listAdrs: fakeListAdrs });

  assert.equal(code, 0);
  assert.match(written, /No hay ADRs/);
});

test('kb card add delegates to the injected addCard with the parsed title and id', async () => {
  const calls = [];
  const fakeAddCard = async (opts) => {
    calls.push(opts);
    return { id: 'kb-doctor', status: 'pending', title: 'kb doctor' };
  };
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['card', 'add', 'kb', 'doctor', '--id', 'kb-doctor'], {
    version: '0.1.0',
    stdout,
    addCard: fakeAddCard,
  });

  assert.equal(code, 0);
  assert.deepEqual(calls, [{ title: 'kb doctor', id: 'kb-doctor' }]);
  assert.match(written, /kb-doctor/);
});

test('kb card add exits non-zero with a clear message when no title is given', async () => {
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['card', 'add'], { version: '0.1.0', stdout });

  assert.equal(code, 1);
  assert.match(written, /título/);
});

test('kb card add exits non-zero and prints the error when addCard rejects (e.g. a duplicate id)', async () => {
  const fakeAddCard = async () => {
    throw new Error('Ya existe una card con id "kb-doctor".');
  };
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['card', 'add', 'kb', 'doctor', '--id', 'kb-doctor'], {
    version: '0.1.0',
    stdout,
    addCard: fakeAddCard,
  });

  assert.equal(code, 1);
  assert.match(written, /Ya existe/);
});

test('kb card list prints every card from the injected listCards', async () => {
  const fakeListCards = async () => [{ id: 'kb-doctor', status: 'pending', title: 'kb doctor' }];
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['card', 'list'], { version: '0.1.0', stdout, listCards: fakeListCards });

  assert.equal(code, 0);
  assert.match(written, /kb-doctor/);
  assert.match(written, /pending/);
});

test('kb card list prints a helpful message when there are no cards yet', async () => {
  const fakeListCards = async () => [];
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['card', 'list'], { version: '0.1.0', stdout, listCards: fakeListCards });

  assert.equal(code, 0);
  assert.match(written, /No hay cards/);
});

test('kb card move delegates to the injected moveCard with the given id and status', async () => {
  const calls = [];
  const fakeMoveCard = async (opts) => {
    calls.push(opts);
    return { id: 'kb-doctor', status: 'running' };
  };
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['card', 'move', 'kb-doctor', 'running'], {
    version: '0.1.0',
    stdout,
    moveCard: fakeMoveCard,
  });

  assert.equal(code, 0);
  assert.deepEqual(calls, [{ id: 'kb-doctor', status: 'running' }]);
  assert.match(written, /running/);
});

test('kb card move exits non-zero with a clear message when id or status is missing', async () => {
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['card', 'move', 'kb-doctor'], { version: '0.1.0', stdout });

  assert.equal(code, 1);
  assert.match(written, /uso/i);
});

test('kb card move exits non-zero and prints the error when moveCard rejects (e.g. an unknown status)', async () => {
  const fakeMoveCard = async () => {
    throw new Error('Estado desconocido "bogus".');
  };
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['card', 'move', 'kb-doctor', 'bogus'], {
    version: '0.1.0',
    stdout,
    moveCard: fakeMoveCard,
  });

  assert.equal(code, 1);
  assert.match(written, /Estado desconocido/);
});

test('kb doctor prints the formatted report and exits 0 when everything is healthy', async () => {
  const fakeRunDoctor = async () => ({
    git: { ok: true },
    config: { ok: true },
    providers: [{ role: 'coder', provider: 'claude', ok: true }],
    squeezr: { ok: true },
  });
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['doctor'], { version: '0.1.0', stdout, runDoctor: fakeRunDoctor });

  assert.equal(code, 0);
  assert.match(written, /git disponible/);
  assert.match(written, /coder/);
});

test('kb doctor exits non-zero when a provider check fails', async () => {
  const fakeRunDoctor = async () => ({
    git: { ok: true },
    config: { ok: true },
    providers: [{ role: 'reviewer', provider: 'agy', ok: false, reason: 'no parece estar logado' }],
    squeezr: { ok: true },
  });
  let written = '';
  const stdout = { write: (s) => { written += s; } };

  const code = await runCli(['doctor'], { version: '0.1.0', stdout, runDoctor: fakeRunDoctor });

  assert.equal(code, 1);
  assert.match(written, /no parece estar logado/);
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
