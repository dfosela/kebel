import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeProviders, availableProviders, formatProviderReport } from '../src/providerReport.js';

const checkProvider = async ({ provider }) => {
  if (provider === 'claude') return { provider, ok: true };
  if (provider === 'codex') return { provider, ok: false, reason: 'binario no encontrado en PATH' };
  return { provider, ok: false, reason: 'no parece estar logado' };
};

test('probeProviders reports every known provider with its status, in a fixed order', async () => {
  const report = await probeProviders({ run: async () => {}, runCapture: async () => {}, checkProvider });
  assert.deepEqual(
    report.map(({ provider, ok }) => [provider, ok]),
    [
      ['claude', true],
      ['codex', false],
      ['gemini', false],
      ['agy', false],
    ],
  );
  assert.equal(report[1].reason, 'binario no encontrado en PATH');
});

test('availableProviders keeps only the ready ones, in order', async () => {
  const report = await probeProviders({ run: async () => {}, runCapture: async () => {}, checkProvider });
  assert.deepEqual(availableProviders(report), ['claude']);
});

test('formatProviderReport names each AI and says why a missing one was skipped', () => {
  const lines = formatProviderReport([
    { provider: 'claude', ok: true },
    { provider: 'codex', ok: false, reason: 'binario no encontrado en PATH' },
    { provider: 'gemini', ok: false, reason: 'no parece estar logado' },
  ]);
  assert.match(lines[0], /IAs detectadas/);
  assert.match(lines[1], /✓ Claude: lista/);
  assert.match(lines[2], /○ ChatGPT \(Codex\): no instalada/);
  assert.match(lines[3], /✗ Gemini: no parece estar logado/);
});
