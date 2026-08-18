import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderArgs } from '../src/providerArgs.js';

test('buildProviderArgs uses -p for claude/agy/gemini', () => {
  assert.deepEqual(buildProviderArgs('claude', 'hola'), ['-p', 'hola']);
  assert.deepEqual(buildProviderArgs('agy', 'hola'), ['-p', 'hola']);
  assert.deepEqual(buildProviderArgs('gemini', 'hola'), ['-p', 'hola']);
});

test('buildProviderArgs uses exec for codex', () => {
  assert.deepEqual(buildProviderArgs('codex', 'hola'), ['exec', 'hola']);
});

test('buildProviderArgs throws for an unknown provider', () => {
  assert.throws(() => buildProviderArgs('nope', 'hola'), /nope/);
});
