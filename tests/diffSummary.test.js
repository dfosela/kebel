import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDiff } from '../src/diffSummary.js';

test('summarizeDiff sends the prompt as an argv element for providers that require it that way', async () => {
  const runCapture = async (cmd, args, opts) => {
    assert.equal(cmd, 'agy');
    assert.equal(opts.input, undefined);
    assert.match(args[args.length - 1], /resumen/i);
    return { stdout: '  Este diff añade X.  \n', stderr: '' };
  };

  const summary = await summarizeDiff({ runCapture, provider: 'agy', diff: 'diff --git a/x b/x\n+hi\n' });

  assert.equal(summary, 'Este diff añade X.');
});

test('summarizeDiff sends the prompt via stdin for providers that read it that way', async () => {
  const runCapture = async (cmd, args, opts) => {
    assert.equal(cmd, 'claude');
    assert.match(opts.input, /resumen/i);
    return { stdout: 'resumen aquí', stderr: '' };
  };

  const summary = await summarizeDiff({ runCapture, provider: 'claude', diff: 'diff --git a/x b/x\n+hi\n' });

  assert.equal(summary, 'resumen aquí');
});
