import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runSolomon } from '../src/solomon.js';
import { hashDiff } from '../src/diff.js';
import { saveVerdict } from '../src/verdictStore.js';
import { saveConfig } from '../src/kebelConfig.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-solomon-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const DIFF = 'diff --git a/x b/x\n+hello\n';

test('runSolomon calls the configured solomon provider, parses its verdict and persists it', async () => {
  await withTempDir(async (cwd) => {
    await saveVerdict({ verdict: 'rejected', reason: 'missing tests', securityFinding: false, diffHash: hashDiff(DIFF) }, cwd);

    const runCapture = async (cmd, args) => {
      if (cmd === 'git') return { stdout: DIFF, stderr: '' };
      assert.equal(cmd, 'codex');
      assert.deepEqual(args[0], 'exec');
      return { stdout: '{"verdict": "approved", "reason": "tests exist, false alarm", "security_finding": false}', stderr: '' };
    };

    const record = await runSolomon({ runCapture, solomon: 'codex', cwd, log: () => {} });

    assert.equal(record.verdict, 'approved');
    assert.equal(record.reviewer, 'codex');
    assert.equal(record.solomon, true);
    assert.equal(record.diffHash, hashDiff(DIFF));

    const saved = JSON.parse(await readFile(path.join(cwd, '.kebel', 'verdict.json'), 'utf8'));
    assert.equal(saved.verdict, 'approved');
    assert.equal(saved.solomon, true);
  });
});

test('runSolomon reads the solomon provider from .kebel/kebel.config.json when not passed explicitly', async () => {
  await withTempDir(async (cwd) => {
    await saveConfig({ version: 1, roles: { coder: 'claude', reviewer: 'agy', solomon: 'codex' } }, cwd);
    await saveVerdict({ verdict: 'rejected', reason: 'missing tests', securityFinding: false, diffHash: hashDiff(DIFF) }, cwd);

    let calledCodex = false;
    const runCapture = async (cmd) => {
      if (cmd === 'git') return { stdout: DIFF, stderr: '' };
      calledCodex = cmd === 'codex';
      return { stdout: '{"verdict": "approved", "reason": "ok", "security_finding": false}', stderr: '' };
    };

    await runSolomon({ runCapture, cwd, log: () => {} });

    assert.ok(calledCodex);
  });
});

test('runSolomon throws a clear error when no solomon provider is configured or given', async () => {
  await withTempDir(async (cwd) => {
    await saveVerdict({ verdict: 'rejected', reason: 'missing tests', securityFinding: false, diffHash: hashDiff(DIFF) }, cwd);
    const runCapture = async () => assert.fail('should not be called');

    await assert.rejects(runSolomon({ runCapture, cwd, log: () => {} }), /solomon/i);
  });
});

test('runSolomon throws when there is no previous verdict to arbitrate', async () => {
  await withTempDir(async (cwd) => {
    const runCapture = async () => assert.fail('should not be called');

    await assert.rejects(runSolomon({ runCapture, solomon: 'codex', cwd, log: () => {} }), /veredicto/i);
  });
});

test('runSolomon throws when the previous verdict is already approved (nothing to arbitrate)', async () => {
  await withTempDir(async (cwd) => {
    await saveVerdict({ verdict: 'approved', reason: 'ok', securityFinding: false, diffHash: hashDiff(DIFF) }, cwd);
    const runCapture = async () => assert.fail('should not be called');

    await assert.rejects(runSolomon({ runCapture, solomon: 'codex', cwd, log: () => {} }), /aprobado/i);
  });
});

test('runSolomon refuses to arbitrate a security finding and never calls the solomon provider', async () => {
  await withTempDir(async (cwd) => {
    await saveVerdict(
      { verdict: 'rejected', reason: 'hardcoded API key', securityFinding: true, diffHash: hashDiff(DIFF) },
      cwd,
    );
    const runCapture = async (cmd) => {
      if (cmd === 'git') return { stdout: DIFF, stderr: '' };
      assert.fail('solomon must never be invoked to override a security finding');
    };

    await assert.rejects(
      runSolomon({ runCapture, solomon: 'codex', cwd, log: () => {} }),
      /seguridad/i,
    );
  });
});

test('runSolomon throws when there is no staged diff', async () => {
  await withTempDir(async (cwd) => {
    await saveVerdict({ verdict: 'rejected', reason: 'missing tests', securityFinding: false, diffHash: hashDiff(DIFF) }, cwd);
    const runCapture = async (cmd) =>
      cmd === 'git' ? { stdout: '   \n', stderr: '' } : assert.fail('should not call solomon');

    await assert.rejects(runSolomon({ runCapture, solomon: 'codex', cwd, log: () => {} }), /staged/i);
  });
});

test('runSolomon throws when the staged diff changed since the previous verdict', async () => {
  await withTempDir(async (cwd) => {
    await saveVerdict(
      { verdict: 'rejected', reason: 'missing tests', securityFinding: false, diffHash: hashDiff('diff --git a/x b/x\n+old\n') },
      cwd,
    );
    const runCapture = async (cmd) =>
      cmd === 'git' ? { stdout: DIFF, stderr: '' } : assert.fail('should not call solomon');

    await assert.rejects(runSolomon({ runCapture, solomon: 'codex', cwd, log: () => {} }), /camb/i);
  });
});
