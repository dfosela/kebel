import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { evaluateGitGate, checkGitGate } from '../src/gitGate.js';
import { hashDiff } from '../src/diff.js';
import { saveVerdict } from '../src/verdictStore.js';
import { saveConfig } from '../src/kebelConfig.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-gate-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('evaluateGitGate blocks when there is no verdict on record', () => {
  const result = evaluateGitGate({ diff: 'diff --git a/x b/x\n+hi\n', verdict: null });
  assert.equal(result.ok, false);
  assert.match(result.reason, /kb review --staged/);
});

test('evaluateGitGate blocks when the last verdict was a rejection', () => {
  const diff = 'diff --git a/x b/x\n+hi\n';
  const verdict = { verdict: 'rejected', reason: 'missing tests', diffHash: hashDiff(diff) };
  const result = evaluateGitGate({ diff, verdict });
  assert.equal(result.ok, false);
  assert.match(result.reason, /rejected/);
  assert.match(result.reason, /missing tests/);
});

test('evaluateGitGate blocks when the staged diff changed since the review', () => {
  const verdict = { verdict: 'approved', reason: 'ok', diffHash: hashDiff('diff --git a/x b/x\n+old\n') };
  const result = evaluateGitGate({ diff: 'diff --git a/x b/x\n+new\n', verdict });
  assert.equal(result.ok, false);
  assert.match(result.reason, /cambió/);
});

test('evaluateGitGate approves when the verdict is approved and the diff hash matches', () => {
  const diff = 'diff --git a/x b/x\n+hi\n';
  const verdict = { verdict: 'approved', reason: 'ok', diffHash: hashDiff(diff) };
  const result = evaluateGitGate({ diff, verdict });
  assert.equal(result.ok, true);
});

test('evaluateGitGate lets an empty staged diff through (nothing to gate)', () => {
  const result = evaluateGitGate({ diff: '   \n', verdict: null });
  assert.equal(result.ok, true);
});

test('evaluateGitGate blocks a commit directly on the base branch, even with an approved verdict', () => {
  const diff = 'diff --git a/x b/x\n+hi\n';
  const verdict = { verdict: 'approved', reason: 'ok', diffHash: hashDiff(diff) };
  const result = evaluateGitGate({ diff, verdict, currentBranch: 'main', baseBranch: 'main' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Branch-first/);
  assert.match(result.reason, /main/);
});

test('evaluateGitGate allows a commit on a feature branch different from the base branch', () => {
  const diff = 'diff --git a/x b/x\n+hi\n';
  const verdict = { verdict: 'approved', reason: 'ok', diffHash: hashDiff(diff) };
  const result = evaluateGitGate({ diff, verdict, currentBranch: 'feat/x', baseBranch: 'main' });
  assert.equal(result.ok, true);
});

function fakeRunCapture({ diff, branch }) {
  return async (cmd, args) => {
    assert.equal(cmd, 'git');
    if (args[0] === 'diff') return { stdout: diff, stderr: '' };
    if (args[0] === 'symbolic-ref') return { stdout: `${branch}\n`, stderr: '' };
    throw new Error(`unexpected git call: ${args.join(' ')}`);
  };
}

test('checkGitGate reads the staged diff and the persisted verdict for the given cwd', async () => {
  await withTempDir(async (cwd) => {
    const diff = 'diff --git a/x b/x\n+hi\n';
    await saveVerdict({ verdict: 'approved', reason: 'ok', diffHash: hashDiff(diff) }, cwd);

    const result = await checkGitGate({ runCapture: fakeRunCapture({ diff, branch: 'feat/x' }), cwd });

    assert.equal(result.ok, true);
  });
});

test('checkGitGate blocks when the current branch matches the configured base branch', async () => {
  await withTempDir(async (cwd) => {
    const diff = 'diff --git a/x b/x\n+hi\n';
    await saveVerdict({ verdict: 'approved', reason: 'ok', diffHash: hashDiff(diff) }, cwd);
    await saveConfig({ version: 1, roles: {}, baseBranch: 'main' }, cwd);

    const result = await checkGitGate({ runCapture: fakeRunCapture({ diff, branch: 'main' }), cwd });

    assert.equal(result.ok, false);
    assert.match(result.reason, /Branch-first/);
  });
});
