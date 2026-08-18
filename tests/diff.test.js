import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashDiff, getStagedDiff } from '../src/diff.js';

test('hashDiff is deterministic and content-sensitive', () => {
  const a = hashDiff('diff --git a/x b/x\n+hello\n');
  const b = hashDiff('diff --git a/x b/x\n+hello\n');
  const c = hashDiff('diff --git a/x b/x\n+bye\n');

  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('getStagedDiff runs git diff --cached in the given cwd and returns its stdout', async () => {
  const calls = [];
  const runCapture = async (cmd, args, opts) => {
    calls.push([cmd, args, opts]);
    return { stdout: 'diff --git a/x b/x\n+hi\n', stderr: '' };
  };

  const diff = await getStagedDiff({ runCapture, cwd: '/some/project' });

  assert.equal(diff, 'diff --git a/x b/x\n+hi\n');
  assert.deepEqual(calls, [['git', ['diff', '--cached'], { cwd: '/some/project', timeoutMs: 30_000 }]]);
});
