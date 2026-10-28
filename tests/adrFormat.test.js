import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, formatAdrNumber, nextAdrNumber, buildAdrContent, parseAdrSummary } from '../src/adrFormat.js';

test('slugify lowercases, strips accents and turns everything else into hyphens', () => {
  assert.equal(slugify('Roles cross-AI fijos: Claude, Antigravity y Codex'), 'roles-cross-ai-fijos-claude-antigravity-y-codex');
  assert.equal(slugify('¿Por qué Squeezr?'), 'por-que-squeezr');
});

test('slugify truncates long titles without leaving a trailing hyphen', () => {
  const slug = slugify('a'.repeat(100));
  assert.ok(slug.length <= 60);
  assert.ok(!slug.endsWith('-'));
});

test('formatAdrNumber zero-pads to 4 digits', () => {
  assert.equal(formatAdrNumber(1), '0001');
  assert.equal(formatAdrNumber(42), '0042');
});

test('nextAdrNumber starts at 1 when there are no existing ADR files', () => {
  assert.equal(nextAdrNumber([]), 1);
  assert.equal(nextAdrNumber(['README.md']), 1);
});

test('nextAdrNumber continues from the highest existing number', () => {
  assert.equal(nextAdrNumber(['0001-foo.md', '0002-bar.md']), 3);
});

test('buildAdrContent renders title, status, date and the three sections', () => {
  const content = buildAdrContent({
    title: 'Use subprocess CLIs',
    status: 'proposed',
    date: '2026-08-18',
    context: 'Why this came up.',
    decision: 'What we decided.',
    consequences: 'Trade-offs.',
  });
  assert.match(content, /^# Use subprocess CLIs/);
  assert.match(content, /Status: proposed/);
  assert.match(content, /Date: 2026-08-18/);
  assert.match(content, /## Context\nWhy this came up\./);
  assert.match(content, /## Decision\nWhat we decided\./);
  assert.match(content, /## Consequences\nTrade-offs\./);
});

test('parseAdrSummary extracts title, status and date from an ADR file', () => {
  const content = buildAdrContent({
    title: 'Use subprocess CLIs',
    status: 'accepted',
    date: '2026-08-18',
    context: 'c',
    decision: 'd',
    consequences: 'e',
  });
  assert.deepEqual(parseAdrSummary(content), {
    title: 'Use subprocess CLIs',
    status: 'accepted',
    date: '2026-08-18',
  });
});
