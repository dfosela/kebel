import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRoles } from '../src/rolePicker.js';

const answers = (list) => {
  const asked = [];
  const ask = async (text) => {
    asked.push(text);
    return list.shift() ?? '';
  };
  return { ask, asked };
};

test('without an interactive terminal it keeps the ordered proposal and asks nothing', async () => {
  const roles = await chooseRoles({
    available: ['claude', 'codex', 'agy'],
    log: () => {},
    isInteractive: false,
    ask: async () => { throw new Error('must not ask'); },
  });
  assert.deepEqual([roles.coder, roles.reviewer, roles.solomon], ['claude', 'codex', 'agy']);
});

test('Enter on every role accepts the proposal', async () => {
  const { ask, asked } = answers(['', '', '']);
  const roles = await chooseRoles({ available: ['claude', 'codex', 'agy'], log: () => {}, isInteractive: true, ask });
  assert.deepEqual([roles.coder, roles.reviewer, roles.solomon], ['claude', 'codex', 'agy']);
  assert.equal(asked.length, 3);
  assert.match(asked[0], /coder: claude/);
});

test('picking another AI for a role moves the rest of the proposal along', async () => {
  const { ask, asked } = answers(['', 'agy', '']);
  const roles = await chooseRoles({ available: ['claude', 'codex', 'agy'], log: () => {}, isInteractive: true, ask });
  assert.deepEqual([roles.coder, roles.reviewer, roles.solomon], ['claude', 'agy', 'codex']);
  assert.match(asked[2], /solomon: codex/);
});

test('an answer that is not an available AI is reported and the proposal stays', async () => {
  const logs = [];
  const { ask } = answers(['gemini', '', '']);
  const roles = await chooseRoles({ available: ['claude', 'codex'], log: (m) => logs.push(m), isInteractive: true, ask });
  assert.deepEqual([roles.coder, roles.reviewer, roles.solomon], ['claude', 'codex', null]);
  assert.match(logs.join('\n'), /"gemini" no está disponible para coder/);
});

test('with a single AI there is nothing to choose', async () => {
  const roles = await chooseRoles({
    available: ['claude'],
    log: () => {},
    isInteractive: true,
    ask: async () => { throw new Error('must not ask'); },
  });
  assert.equal(roles.coder, 'claude');
  assert.equal(roles.reviewer, null);
});
