import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummaryPrompt } from '../src/summaryPrompt.js';

test('buildSummaryPrompt embeds the diff and asks for a short, plain-language summary', () => {
  const prompt = buildSummaryPrompt('diff --git a/x b/x\n+hello\n');
  assert.match(prompt, /diff --git a\/x b\/x/);
  assert.match(prompt, /resumen/i);
});
