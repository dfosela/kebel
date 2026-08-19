import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSolomonPrompt } from '../src/solomonPrompt.js';

test('buildSolomonPrompt embeds the diff, the original rejection reason and asks for a strict JSON verdict', () => {
  const prompt = buildSolomonPrompt({ diff: 'diff --git a/x b/x\n+hello\n', previousReason: 'missing tests' });
  assert.match(prompt, /diff --git a\/x b\/x/);
  assert.match(prompt, /missing tests/);
  assert.match(prompt, /verdict/);
  assert.match(prompt, /security_finding/);
});
