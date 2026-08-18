import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPrompt } from '../src/reviewPrompt.js';

test('buildReviewPrompt embeds the diff and asks for a strict JSON verdict', () => {
  const prompt = buildReviewPrompt('diff --git a/x b/x\n+hello\n');
  assert.match(prompt, /diff --git a\/x b\/x/);
  assert.match(prompt, /verdict/);
  assert.match(prompt, /security_finding/);
});
