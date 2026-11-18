import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRoles, parseRolesArg } from '../src/rolePicker.js';

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

test('without an interactive terminal it tells an AI assistant to ask its user, with the command to run', async () => {
  const logs = [];
  await chooseRoles({ available: ['claude', 'codex', 'agy'], log: (m) => logs.push(m), isInteractive: false });
  const text = logs.join('\n');
  assert.match(text, /Si eres un asistente de IA/);
  assert.match(text, /pregunta a tu usuario/i);
  assert.match(text, /coder=claude, reviewer=codex, solomon=agy/);
  assert.match(text, /kb init --reconfigure --roles coder=<ia>,reviewer=<ia>,solomon=<ia>/);
});

test('requested roles are applied as given, without asking', async () => {
  const logs = [];
  const roles = await chooseRoles({
    available: ['claude', 'codex', 'agy'],
    log: (m) => logs.push(m),
    isInteractive: false,
    requested: { coder: 'codex', reviewer: 'agy', solomon: 'claude' },
    ask: async () => { throw new Error('must not ask'); },
  });
  assert.deepEqual([roles.coder, roles.reviewer, roles.solomon], ['codex', 'agy', 'claude']);
  assert.doesNotMatch(logs.join('\n'), /asistente de IA/);
});

test('requested roles fill any role left out from the remaining AIs, in order', async () => {
  const roles = await chooseRoles({
    available: ['claude', 'codex', 'agy'],
    log: () => {},
    isInteractive: false,
    requested: { reviewer: 'claude' },
  });
  assert.deepEqual([roles.coder, roles.reviewer, roles.solomon], ['codex', 'claude', 'agy']);
});

test('a requested AI that is not available fails loudly', async () => {
  await assert.rejects(
    chooseRoles({ available: ['claude', 'codex'], log: () => {}, isInteractive: false, requested: { coder: 'gemini' } }),
    /"gemini" no está disponible.*claude, codex/,
  );
});

test('the same AI requested for two roles fails loudly', async () => {
  await assert.rejects(
    chooseRoles({
      available: ['claude', 'codex'],
      log: () => {},
      isInteractive: false,
      requested: { coder: 'claude', reviewer: 'claude' },
    }),
    /"claude" no puede tener dos roles/,
  );
});

test('parseRolesArg reads coder=x,reviewer=y,solomon=z', () => {
  assert.deepEqual(parseRolesArg('coder=claude,reviewer=codex,solomon=agy'), {
    coder: 'claude',
    reviewer: 'codex',
    solomon: 'agy',
  });
  assert.deepEqual(parseRolesArg(' reviewer = Codex '), { reviewer: 'codex' });
});

test('parseRolesArg rejects an unknown role or a malformed pair', () => {
  assert.throws(() => parseRolesArg('boss=claude'), /rol desconocido "boss"/);
  assert.throws(() => parseRolesArg('coder'), /formato.*rol=ia/);
});

test('Enter on every role accepts the proposal', async () => {
  const { ask, asked } = answers(['', '', '']);
  const roles = await chooseRoles({ available: ['claude', 'codex', 'agy'], log: () => {}, isInteractive: true, ask });
  assert.deepEqual([roles.coder, roles.reviewer, roles.solomon], ['claude', 'codex', 'agy']);
  assert.equal(asked.length, 3);
  assert.match(asked[0], /¿claude como coder\? \(Enter = sí, o escribe otra: codex, agy\)/);
});

test('picking another AI for a role moves the rest of the proposal along', async () => {
  const { ask, asked } = answers(['', 'agy', '']);
  const roles = await chooseRoles({ available: ['claude', 'codex', 'agy'], log: () => {}, isInteractive: true, ask });
  assert.deepEqual([roles.coder, roles.reviewer, roles.solomon], ['claude', 'agy', 'codex']);
  assert.match(asked[2], /¿codex como solomon\? \(Enter = sí\)/);
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
