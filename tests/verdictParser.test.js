import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVerdict } from '../src/verdictParser.js';

test('parseVerdict extracts a clean JSON verdict', () => {
  const output = '{"verdict": "approved", "reason": "looks good", "security_finding": false}';
  const result = parseVerdict(output);
  assert.deepEqual(result, { verdict: 'approved', reason: 'looks good', securityFinding: false });
});

test('parseVerdict finds the verdict JSON even surrounded by banner noise (codex-style output)', () => {
  const output = `
OpenAI Codex v0.147.0
--------
workdir: C:\\some\\path
model: gpt-5.6-terra
--------
user
some prompt
codex
{"verdict": "rejected", "reason": "missing tests", "security_finding": false}
tokens used
4417
{"verdict": "rejected", "reason": "missing tests", "security_finding": false}
`;
  const result = parseVerdict(output);
  assert.deepEqual(result, {
    verdict: 'rejected',
    reason: 'missing tests',
    securityFinding: false,
  });
});

test('parseVerdict normalizes a missing security_finding to false', () => {
  const result = parseVerdict('{"verdict": "approved", "reason": "ok"}');
  assert.equal(result.securityFinding, false);
});

test('parseVerdict throws when no JSON verdict is found', () => {
  assert.throws(() => parseVerdict('sorry, I cannot help with that'), /veredicto/);
});

test('parseVerdict throws when the JSON found has no verdict field', () => {
  assert.throws(() => parseVerdict('{"foo": "bar"}'), /veredicto/);
});
