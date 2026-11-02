import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getProviderInvocation, buildProviderCall } from '../src/providerArgs.js';

test('claude/codex/gemini take the prompt via stdin through a .cmd shim, needing a shell to launch it on Windows', () => {
  for (const provider of ['claude', 'codex', 'gemini']) {
    const invocation = getProviderInvocation(provider, { platform: 'win32' });
    assert.equal(invocation.promptVia, 'stdin');
    assert.equal(invocation.shell, true);
  }
  assert.deepEqual(getProviderInvocation('claude').baseArgs, ['-p']);
  assert.deepEqual(getProviderInvocation('codex').baseArgs, ['exec']);
});

// Regression coverage for a real audit finding (2026-11-02): claude/codex/
// gemini are only .cmd shims on Windows — on macOS/Linux npm installs them
// as plain shebang executables, which need no shell to launch. Forcing
// shell:true unconditionally there was unnecessary (not a vulnerability by
// itself, but needless attack surface and a platform-inconsistency smell).
test('claude/codex/gemini need no shell outside Windows (npm installs them as plain shebang executables there)', () => {
  for (const provider of ['claude', 'codex', 'gemini']) {
    for (const platform of ['linux', 'darwin']) {
      assert.equal(getProviderInvocation(provider, { platform }).shell, false);
    }
  }
});

test('agy takes the prompt as an argv element, spawned without a shell (real .exe, avoids cmd.exe newline truncation)', () => {
  const invocation = getProviderInvocation('agy');
  assert.equal(invocation.promptVia, 'arg');
  assert.equal(invocation.shell, false);
  assert.deepEqual(invocation.baseArgs, ['-p']);
});

test('agy never needs a shell, on any platform', () => {
  for (const platform of ['win32', 'linux', 'darwin']) {
    assert.equal(getProviderInvocation('agy', { platform }).shell, false);
  }
});

test('getProviderInvocation throws for an unknown provider', () => {
  assert.throws(() => getProviderInvocation('nope'), /nope/);
});

// Regression coverage for a real audit finding (2026-11-02): the same
// "args/input from invocation.promptVia" logic was duplicated verbatim
// across review.js, solomon.js, diffSummary.js and doctor.js.
test('buildProviderCall puts the prompt as an argv element when promptVia is "arg"', () => {
  const call = buildProviderCall('agy', 'hola');
  assert.deepEqual(call.args, ['-p', 'hola']);
  assert.equal(call.input, undefined);
  assert.equal(call.shell, false);
});

test('buildProviderCall puts the prompt on stdin, leaving args as the bare baseArgs, when promptVia is "stdin"', () => {
  const call = buildProviderCall('claude', 'hola', { platform: 'win32' });
  assert.deepEqual(call.args, ['-p']);
  assert.equal(call.input, 'hola');
  assert.equal(call.shell, true);
});
