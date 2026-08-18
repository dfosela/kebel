import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run, runCapture } from '../src/exec.js';

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

test('run executes in the given cwd', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-exec-cwd-'));
  try {
    const marker = path.join(dir, 'ran-here.txt');
    await run(process.execPath, ['-e', "require('fs').writeFileSync('ran-here.txt', 'ok')"], {
      cwd: dir,
    });
    const { existsSync } = await import('node:fs');
    assert.ok(existsSync(marker));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runCapture resolves with stdout when the command exits 0', async () => {
  const result = await runCapture(process.execPath, ['-e', "process.stdout.write('hello')"]);
  assert.equal(result.stdout, 'hello');
});

test('runCapture rejects with stdout/stderr attached when the command exits non-zero', async () => {
  await assert.rejects(
    runCapture(process.execPath, [
      '-e',
      "process.stdout.write('partial'); process.exit(1)",
    ]),
    (error) => {
      assert.equal(error.stdout, 'partial');
      return true;
    },
  );
});

test('runCapture rejects with a timeout error instead of hanging past the deadline', async () => {
  await assert.rejects(
    runCapture(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { timeoutMs: 200 }),
    /timed out/,
  );
});

test('runCapture writes `input` to the child stdin when provided', async () => {
  const result = await runCapture(
    process.execPath,
    ['-e', "process.stdin.on('data', d => process.stdout.write(d))"],
    { input: 'hello from stdin' },
  );
  assert.equal(result.stdout, 'hello from stdin');
});

test('runCapture with shell:false still preserves a multi-line argument verbatim (regression: shell:true mangles embedded newlines on Windows)', async () => {
  const multiline = 'line1\nline2\nline3';
  const result = await runCapture(
    process.execPath,
    ['-e', 'process.stdout.write(process.argv[1])', multiline],
    { shell: false },
  );
  assert.equal(result.stdout, multiline);
});
