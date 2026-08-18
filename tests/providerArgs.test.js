import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getProviderInvocation } from '../src/providerArgs.js';

test('claude/codex/gemini take the prompt via stdin through a .cmd shim (shell required to launch it)', () => {
  for (const provider of ['claude', 'codex', 'gemini']) {
    const invocation = getProviderInvocation(provider);
    assert.equal(invocation.promptVia, 'stdin');
    assert.equal(invocation.shell, true);
  }
  assert.deepEqual(getProviderInvocation('claude').baseArgs, ['-p']);
  assert.deepEqual(getProviderInvocation('codex').baseArgs, ['exec']);
});

test('agy takes the prompt as an argv element, spawned without a shell (real .exe, avoids cmd.exe newline truncation)', () => {
  const invocation = getProviderInvocation('agy');
  assert.equal(invocation.promptVia, 'arg');
  assert.equal(invocation.shell, false);
  assert.deepEqual(invocation.baseArgs, ['-p']);
});

test('getProviderInvocation throws for an unknown provider', () => {
  assert.throws(() => getProviderInvocation('nope'), /nope/);
});
