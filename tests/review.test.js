import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { reviewStaged } from '../src/review.js';
import { hashDiff } from '../src/diff.js';
import { saveConfig } from '../src/kebelConfig.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-review-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('reviewStaged calls the configured reviewer, parses the verdict and persists it bound to the diff hash', async () => {
  await withTempDir(async (cwd) => {
    const runCapture = async (cmd, args) => {
      if (cmd === 'git') return { stdout: 'diff --git a/x b/x\n+hello\n', stderr: '' };
      assert.equal(cmd, 'agy');
      assert.deepEqual(args[0], '-p');
      return {
        stdout: '{"verdict": "approved", "reason": "looks fine", "security_finding": false}',
        stderr: '',
      };
    };

    const record = await reviewStaged({ runCapture, reviewer: 'agy', cwd, log: () => {} });

    assert.equal(record.verdict, 'approved');
    assert.equal(record.reviewer, 'agy');
    assert.equal(record.diffHash, hashDiff('diff --git a/x b/x\n+hello\n'));

    const saved = JSON.parse(await readFile(path.join(cwd, '.kebel', 'verdict.json'), 'utf8'));
    assert.equal(saved.diffHash, record.diffHash);
  });
});

test('reviewStaged reads the reviewer from .kebel/kebel.config.json when not passed explicitly', async () => {
  await withTempDir(async (cwd) => {
    await saveConfig({ version: 1, roles: { coder: 'claude', reviewer: 'codex', solomon: null } }, cwd);
    let calledCodex = false;
    const runCapture = async (cmd) => {
      if (cmd === 'git') return { stdout: 'diff\n', stderr: '' };
      calledCodex = cmd === 'codex';
      return { stdout: '{"verdict": "approved", "reason": "ok", "security_finding": false}', stderr: '' };
    };

    await reviewStaged({ runCapture, cwd, log: () => {} });

    assert.ok(calledCodex);
  });
});

test('reviewStaged throws a clear error when there is no staged diff', async () => {
  await withTempDir(async (cwd) => {
    const runCapture = async (cmd) =>
      cmd === 'git' ? { stdout: '   \n', stderr: '' } : assert.fail('should not call the reviewer');

    await assert.rejects(
      reviewStaged({ runCapture, reviewer: 'agy', cwd, log: () => {} }),
      /staged/i,
    );
  });
});

test('reviewStaged throws a clear error when no reviewer is configured or given', async () => {
  await withTempDir(async (cwd) => {
    const runCapture = async () => assert.fail('should not be called');

    await assert.rejects(reviewStaged({ runCapture, cwd, log: () => {} }), /reviewer/i);
  });
});

test('reviewing a different diff produces a different diff hash (the old verdict no longer matches)', async () => {
  await withTempDir(async (cwd) => {
    let call = 0;
    const runCapture = async (cmd) => {
      if (cmd === 'git') {
        call += 1;
        return { stdout: call === 1 ? 'diff A\n' : 'diff B\n', stderr: '' };
      }
      return { stdout: '{"verdict": "approved", "reason": "ok", "security_finding": false}', stderr: '' };
    };

    const first = await reviewStaged({ runCapture, reviewer: 'agy', cwd, log: () => {} });
    const second = await reviewStaged({ runCapture, reviewer: 'agy', cwd, log: () => {} });

    assert.notEqual(first.diffHash, second.diffHash);
  });
});
