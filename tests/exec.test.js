import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/exec.js';

test('run resolves when the command exits 0', async () => {
  await assert.doesNotReject(run(process.execPath, ['-e', 'process.exit(0)']));
});

test('run rejects when the command exits non-zero', async () => {
  await assert.rejects(run(process.execPath, ['-e', 'process.exit(1)']));
});

test('run rejects when the command does not exist', async () => {
  await assert.rejects(run('kb-definitely-not-a-real-binary-xyz', []));
});

test('run rejects with a timeout error instead of hanging past the deadline', async () => {
  await assert.rejects(
    run(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { timeoutMs: 200 }),
    /timed out/,
  );
});
