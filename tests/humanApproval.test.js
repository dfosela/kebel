import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askHumanApproval } from '../src/humanApproval.js';

test('askHumanApproval returns true for an affirmative answer', async () => {
  const approved = await askHumanApproval({ promptText: '¿Apruebas? ', prompt: async () => 's' });
  assert.equal(approved, true);
});

test('askHumanApproval accepts "y"/"yes" too', async () => {
  assert.equal(await askHumanApproval({ promptText: '', prompt: async () => 'y' }), true);
  assert.equal(await askHumanApproval({ promptText: '', prompt: async () => 'YES' }), true);
});

test('askHumanApproval returns false for anything else, including an empty answer', async () => {
  assert.equal(await askHumanApproval({ promptText: '', prompt: async () => 'n' }), false);
  assert.equal(await askHumanApproval({ promptText: '', prompt: async () => '' }), false);
  assert.equal(await askHumanApproval({ promptText: '', prompt: async () => 'maybe' }), false);
});

test('askHumanApproval passes the given prompt text through to the injected prompt function', async () => {
  const calls = [];
  await askHumanApproval({
    promptText: '¿Apruebas este commit? [s/N] ',
    prompt: async (text) => {
      calls.push(text);
      return 's';
    },
  });
  assert.deepEqual(calls, ['¿Apruebas este commit? [s/N] ']);
});
