import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOnboardingMessage } from '../src/onboarding.js';

test('buildOnboardingMessage explains each role and how work is tracked', () => {
  const message = buildOnboardingMessage({ roles: { coder: 'claude', reviewer: 'agy', solomon: 'codex' } });

  assert.match(message, /coder \(claude\)/);
  assert.match(message, /reviewer \(agy\)/);
  assert.match(message, /solomon \(codex\)/);
  assert.match(message, /kb review --staged/);
  assert.match(message, /kb card/);
  assert.match(message, /kb adr/);
  assert.match(message, /kb doctor/);
});

test('buildOnboardingMessage marks unassigned roles clearly instead of printing null/undefined', () => {
  const message = buildOnboardingMessage({ roles: { coder: 'claude', reviewer: null, solomon: null } });

  assert.doesNotMatch(message, /null/);
  assert.doesNotMatch(message, /undefined/);
  assert.match(message, /reviewer \(— sin asignar\)/);
});
