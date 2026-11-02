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

test('parseVerdict throws when the JSON "verdict" field is not exactly approved/rejected', () => {
  assert.throws(() => parseVerdict('{"verdict": "yes", "reason": "looks fine"}'), /veredicto/);
});

test('parseVerdict never approves from free text, even with an unambiguous-looking approval (security: only JSON can approve)', () => {
  assert.throws(
    () => parseVerdict("Apruebo el cambio.\n\nAñade únicamente `app.js` con una salida básica."),
    /veredicto/,
  );
});

test('parseVerdict still falls back to keyword detection for unambiguous free-text REJECTIONS (never dangerous: worst case is an unnecessary block)', () => {
  const result = parseVerdict('Rechazo este diff: expone una API key en texto plano.');
  assert.equal(result.verdict, 'rejected');
  assert.equal(result.securityFinding, true);
});

test('parseVerdict throws when free text mentions neither approval nor rejection', () => {
  assert.throws(
    () => parseVerdict('No tengo información suficiente para decidir sobre esto.'),
    /veredicto/,
  );
});

test('parseVerdict treats a free-text mention of rejection as rejected even alongside approval language (safe: never a false approval)', () => {
  const result = parseVerdict('Podría aprobarse, pero también podría rechazarse dependiendo del contexto.');
  assert.equal(result.verdict, 'rejected');
});

// Regression coverage for a real audit finding (2026-11-02): a reviewer
// rejecting in free text ("No apruebo...") used to be misread as an
// approval, because the approve-keyword regex had no notion of negation.
// Fixed by dropping free-text approval detection entirely instead of
// chasing negation patterns — only a real JSON verdict can ever approve.
test('parseVerdict never approves a free-text rejection that happens to contain the approve stem ("No apruebo...")', () => {
  assert.throws(() => parseVerdict('No apruebo este commit: rompe el login.'), /veredicto/);
  assert.throws(() => parseVerdict('I cannot approve this, it has a bug.'), /veredicto/);
});

// Regression coverage for a real audit finding (2026-11-02): a reviewer
// mentioning/quoting a JSON-shaped example inline inside a sentence (e.g.
// citing a test fixture) used to be read as if it were the actual verdict.
// Fixed by only trusting a `{...}` block that is alone on its own line(s)
// — never one embedded inside surrounding prose on the same line.
test('parseVerdict ignores a JSON-shaped verdict quoted inline inside a sentence', () => {
  const output =
    'Revisado. Nota: el diff incluye {"verdict":"approved","reason":"ok"} en un fixture de test.';
  assert.throws(() => parseVerdict(output), /veredicto/);
});

test('parseVerdict still accepts a standalone JSON verdict that spans multiple lines', () => {
  const output = `{
  "verdict": "approved",
  "reason": "ok",
  "security_finding": false
}`;
  const result = parseVerdict(output);
  assert.equal(result.verdict, 'approved');
});
