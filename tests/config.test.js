import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectProviders, assignRoles } from '../src/config.js';

test('detectProviders returns only providers that are both installed and logged in', async () => {
  const checkProvider = async ({ provider }) => ({ provider, ok: ['claude', 'codex'].includes(provider) });
  const result = await detectProviders({ run: async () => {}, runCapture: async () => {}, checkProvider });
  assert.deepEqual(result, ['claude', 'codex']);
});

test('detectProviders delegates each probe to the real checkProvider by default', async () => {
  const run = async (cmd) => {
    if (cmd === 'claude') return;
    throw new Error('not found');
  };
  const runCapture = async () => ({ stdout: 'pong', stderr: '' });
  const result = await detectProviders({ run, runCapture });
  assert.deepEqual(result, ['claude']);
});

test('assignRoles picks 3 distinct providers for coder/reviewer/solomon when available', () => {
  const roles = assignRoles(['claude', 'agy', 'codex', 'gemini']);
  assert.equal(roles.coder, 'claude');
  assert.equal(roles.reviewer, 'agy');
  assert.equal(roles.solomon, 'codex');
  assert.deepEqual(roles.warnings, []);
});

test('assignRoles leaves solomon null with a warning when fewer than 3 providers are available', () => {
  const roles = assignRoles(['claude', 'agy']);
  assert.equal(roles.coder, 'claude');
  assert.equal(roles.reviewer, 'agy');
  assert.equal(roles.solomon, null);
  assert.match(roles.warnings.join(' '), /solomon/i);
});

test('assignRoles reports everything missing when no providers are available', () => {
  const roles = assignRoles([]);
  assert.equal(roles.coder, null);
  assert.equal(roles.reviewer, null);
  assert.equal(roles.solomon, null);
  assert.equal(roles.warnings.length, 3);
});
