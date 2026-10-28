import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyProviderError, formatDoctorReport, isDoctorHealthy } from '../src/doctorFormat.js';

test('classifyProviderError recognizes common authentication error phrasing', () => {
  assert.match(classifyProviderError('Error: not authenticated, please login'), /logado/i);
  assert.match(classifyProviderError('Invalid API key'), /logado/i);
  assert.match(classifyProviderError('401 Unauthorized'), /logado/i);
});

test('classifyProviderError falls back to the raw message for unrelated failures', () => {
  assert.match(classifyProviderError('connection timed out'), /connection timed out/);
});

test('classifyProviderError collapses multi-line stderr output into one line', () => {
  assert.equal(classifyProviderError('line one\nline two\n  line three'), 'line one line two line three');
});

test('formatDoctorReport reports a missing config and stops there', () => {
  const lines = formatDoctorReport({
    git: { ok: true },
    config: { ok: false, reason: 'Kebel no está inicializado. Ejecuta "kb init".' },
    providers: [],
    squeezr: null,
  });
  assert.ok(lines.some((line) => /no está inicializado/.test(line)));
  assert.equal(lines.length, 1);
});

test('formatDoctorReport lists git, every role and squeezr when config exists', () => {
  const lines = formatDoctorReport({
    git: { ok: true },
    config: { ok: true },
    providers: [
      { role: 'coder', provider: 'claude', ok: true },
      { role: 'reviewer', provider: 'agy', ok: false, reason: 'binario no encontrado en PATH' },
      { role: 'solomon', provider: null, ok: false, reason: 'rol no asignado' },
    ],
    squeezr: { ok: true },
  });

  assert.ok(lines.some((line) => /git/.test(line) && /✓/.test(line)));
  assert.ok(lines.some((line) => /coder/.test(line) && /claude/.test(line) && /✓/.test(line)));
  assert.ok(lines.some((line) => /reviewer/.test(line) && /binario no encontrado/.test(line)));
  assert.ok(lines.some((line) => /solomon/.test(line) && /sin proveedor/.test(line)));
  assert.ok(lines.some((line) => /Squeezr/.test(line) && /✓/.test(line)));
});

test('isDoctorHealthy is false when the config is missing', () => {
  assert.equal(isDoctorHealthy({ git: { ok: true }, config: { ok: false }, providers: [] }), false);
});

test('isDoctorHealthy is false when git is missing', () => {
  assert.equal(isDoctorHealthy({ git: { ok: false }, config: { ok: true }, providers: [] }), false);
});

test('isDoctorHealthy ignores unassigned roles but fails on a broken assigned provider', () => {
  assert.equal(
    isDoctorHealthy({
      git: { ok: true },
      config: { ok: true },
      providers: [
        { role: 'coder', provider: 'claude', ok: true },
        { role: 'solomon', provider: null, ok: false },
      ],
    }),
    true,
  );
  assert.equal(
    isDoctorHealthy({
      git: { ok: true },
      config: { ok: true },
      providers: [{ role: 'reviewer', provider: 'agy', ok: false }],
    }),
    false,
  );
});
