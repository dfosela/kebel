import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInit } from '../src/init.js';
import { chooseRoles } from '../src/rolePicker.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-init-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function fakeInstallPreCommitHook(calls) {
  return async (opts) => {
    calls.push(opts);
    return path.join(opts.cwd, '.git', 'hooks', 'pre-commit');
  };
}

test('runInit detects providers, assigns roles, writes config, runs Squeezr setup and installs the git gate hook', async () => {
  await withTempDir(async (cwd) => {
    const run = async (cmd) => {
      if (['claude', 'agy'].includes(cmd)) return;
      throw new Error('not found');
    };
    const runCapture = async (cmd, args) => {
      if (cmd === 'git' && args[0] === 'symbolic-ref') return { stdout: 'main\n', stderr: '' };
      if (cmd === 'claude' || cmd === 'agy') return { stdout: 'pong', stderr: '' };
      throw new Error(`unexpected runCapture call: ${cmd} ${args.join(' ')}`);
    };
    const squeezrCalls = [];
    const ensureSqueezr = async () => {
      squeezrCalls.push('called');
      return { installed: true, configured: true };
    };
    const hookCalls = [];
    const logs = [];
    const scaffoldCalls = [];
    const writeScaffoldFiles = async (opts) => {
      scaffoldCalls.push(opts);
      return [{ filename: 'AGENTS.md', written: true }, { filename: 'CLAUDE.md', written: true }];
    };

    const config = await runInit({
      run,
      runCapture,
      log: (m) => logs.push(m),
      ensureSqueezr,
      cwd,
      binPath: '/repo/bin/kb.js',
      installPreCommitHook: fakeInstallPreCommitHook(hookCalls),
      writeScaffoldFiles,
    });

    assert.equal(config.roles.coder, 'claude');
    assert.equal(config.roles.reviewer, 'agy');
    assert.equal(config.roles.solomon, null);
    assert.equal(config.baseBranch, 'main');
    assert.deepEqual(squeezrCalls, ['called']);
    assert.equal(hookCalls.length, 1);
    assert.equal(typeof hookCalls[0].runCapture, 'function');
    assert.equal(hookCalls[0].cwd, cwd);
    assert.equal(hookCalls[0].binPath, '/repo/bin/kb.js');
    assert.match(logs.join('\n'), /pre-commit/);
    assert.equal(scaffoldCalls.length, 1);
    assert.deepEqual(scaffoldCalls[0].roles, config.roles);
    assert.equal(scaffoldCalls[0].cwd, cwd);
    assert.match(logs.join('\n'), /AGENTS\.md/);
    assert.match(logs.join('\n'), /Bienvenido a Kebel/);
    assert.match(logs.join('\n'), /kb card/);
    assert.match(logs.join('\n'), /IAs detectadas/);
    assert.match(logs.join('\n'), /✓ Claude: lista/);
    assert.match(logs.join('\n'), /○ ChatGPT \(Codex\): no instalada/);

    const saved = JSON.parse(await readFile(path.join(cwd, '.kebel', 'kebel.config.json'), 'utf8'));
    assert.equal(saved.roles.coder, 'claude');
    assert.equal(saved.roles.reviewer, 'agy');
    assert.equal(saved.baseBranch, 'main');
  });
});

// Regression coverage for a real audit finding (2026-11-02): on a detached
// HEAD, `git symbolic-ref --short HEAD` exits non-zero and runCapture
// rejects — this used to crash runInit uncaught instead of falling back to
// something usable (e.g. during a rebase or a CI checkout of a tag/SHA).
test('runInit falls back to the short commit sha as baseBranch on detached HEAD instead of crashing', async () => {
  await withTempDir(async (cwd) => {
    const run = async (cmd) => {
      if (cmd === 'claude') return;
      throw new Error('not found');
    };
    const runCapture = async (cmd, args) => {
      if (cmd === 'git' && args[0] === 'symbolic-ref') {
        throw Object.assign(new Error('fatal: not a symbolic ref'), { code: 128 });
      }
      if (cmd === 'git' && args[0] === 'rev-parse') return { stdout: 'abc1234\n', stderr: '' };
      if (cmd === 'claude') return { stdout: 'pong', stderr: '' };
      throw new Error(`unexpected runCapture call: ${cmd} ${args.join(' ')}`);
    };
    const ensureSqueezr = async () => ({ installed: true, configured: true });
    const logs = [];

    const config = await runInit({
      run,
      runCapture,
      log: (m) => logs.push(m),
      ensureSqueezr,
      cwd,
      installPreCommitHook: fakeInstallPreCommitHook([]),
    });

    assert.equal(config.baseBranch, 'abc1234');
    assert.match(logs.join('\n'), /detached/);
  });
});

test('runInit initializes git itself when the project is not yet a git repository, instead of crashing', async () => {
  await withTempDir(async (cwd) => {
    const runCalls = [];
    const run = async (cmd, args) => {
      if (cmd === 'git' && args[0] === 'init') { runCalls.push([cmd, ...args]); return; }
      if (cmd === 'claude') return;
      throw new Error('not found');
    };
    let symbolicRefCalls = 0;
    const runCapture = async (cmd, args) => {
      if (cmd === 'git' && args[0] === 'symbolic-ref') {
        symbolicRefCalls += 1;
        if (symbolicRefCalls === 1) {
          throw Object.assign(new Error('git symbolic-ref --short HEAD exited with code 128'), {
            code: 128,
            stderr: 'fatal: not a git repository (or any of the parent directories): .git\n',
          });
        }
        return { stdout: 'main\n', stderr: '' };
      }
      if (cmd === 'claude') return { stdout: 'pong', stderr: '' };
      throw new Error(`unexpected runCapture call: ${cmd} ${args.join(' ')}`);
    };
    const ensureSqueezr = async () => ({ installed: true, configured: true });
    const logs = [];

    const config = await runInit({
      run,
      runCapture,
      log: (m) => logs.push(m),
      ensureSqueezr,
      cwd,
      installPreCommitHook: fakeInstallPreCommitHook([]),
    });

    assert.equal(config.baseBranch, 'main');
    assert.deepEqual(runCalls, [['git', 'init']]);
    assert.match(logs.join('\n'), /inicializ/i);
  });
});

// Codex refuses to run outside a git repository, so probing the AIs before
// `git init` reported a logged-in Codex as unavailable in every new project.
test('runInit initializes git before probing the AIs', async () => {
  await withTempDir(async (cwd) => {
    const order = [];
    const run = async (cmd, args) => {
      order.push(`${cmd} ${args[0]}`);
      if (cmd === 'git' && args[0] === 'init') return;
      if (cmd === 'claude') return;
      throw new Error('not found');
    };
    let gitReady = false;
    const runCapture = async (cmd, args) => {
      if (cmd === 'git' && args[0] === 'symbolic-ref') {
        if (!gitReady) {
          gitReady = true;
          throw Object.assign(new Error('exited with code 128'), {
            code: 128,
            stderr: 'fatal: not a git repository (or any of the parent directories): .git\n',
          });
        }
        return { stdout: 'main\n', stderr: '' };
      }
      if (cmd === 'claude') return { stdout: 'pong', stderr: '' };
      throw new Error(`unexpected runCapture call: ${cmd} ${args.join(' ')}`);
    };

    await runInit({
      run,
      runCapture,
      log: () => {},
      ensureSqueezr: async () => ({ installed: true, configured: true }),
      cwd,
      installPreCommitHook: fakeInstallPreCommitHook([]),
    });

    assert.ok(order.indexOf('git init') < order.indexOf('claude --version'), order.join(' | '));
  });
});

test('runInit is idempotent: a second run reports the existing config instead of overwriting it', async () => {
  await withTempDir(async (cwd) => {
    const run = async (cmd) => {
      if (cmd === 'claude') return;
      throw new Error('not found');
    };
    const runCapture = async (cmd, args) => {
      if (cmd === 'git' && args[0] === 'symbolic-ref') return { stdout: 'main\n', stderr: '' };
      if (cmd === 'claude') return { stdout: 'pong', stderr: '' };
      throw new Error(`unexpected runCapture call: ${cmd} ${args.join(' ')}`);
    };
    const ensureSqueezr = async () => ({ installed: true, configured: true });
    const installPreCommitHook = fakeInstallPreCommitHook([]);

    const first = await runInit({ run, runCapture, log: () => {}, ensureSqueezr, cwd, installPreCommitHook });
    const logs = [];
    const second = await runInit({ run, runCapture, log: (m) => logs.push(m), ensureSqueezr, cwd, installPreCommitHook });

    assert.deepEqual(first, second);
    assert.match(logs.join('\n'), /kb init --reconfigure/);
  });
});

test('runInit lets the person pick the AI for each role', async () => {
  await withTempDir(async (cwd) => {
    const installed = ['claude', 'codex', 'agy'];
    const run = async (cmd) => {
      if (installed.includes(cmd)) return;
      throw new Error('not found');
    };
    const runCapture = async (cmd, args) => {
      if (cmd === 'git' && args[0] === 'symbolic-ref') return { stdout: 'main\n', stderr: '' };
      if (installed.includes(cmd)) return { stdout: 'pong', stderr: '' };
      throw new Error(`unexpected runCapture call: ${cmd} ${args.join(' ')}`);
    };
    const replies = ['', 'agy', ''];
    const config = await runInit({
      run,
      runCapture,
      log: () => {},
      ensureSqueezr: async () => ({ installed: true, configured: true }),
      cwd,
      installPreCommitHook: fakeInstallPreCommitHook([]),
      chooseRoles: (opts) => chooseRoles({ ...opts, isInteractive: true, ask: async () => replies.shift() ?? '' }),
    });
    assert.deepEqual([config.roles.coder, config.roles.reviewer, config.roles.solomon], ['claude', 'agy', 'codex']);
  });
});

test('runInit --reconfigure detects the AIs again and keeps the saved base branch', async () => {
  await withTempDir(async (cwd) => {
    let installed = ['claude'];
    const run = async (cmd) => {
      if (installed.includes(cmd)) return;
      throw new Error('not found');
    };
    let branch = 'main\n';
    const runCapture = async (cmd, args) => {
      if (cmd === 'git' && args[0] === 'symbolic-ref') return { stdout: branch, stderr: '' };
      if (installed.includes(cmd)) return { stdout: 'pong', stderr: '' };
      throw new Error(`unexpected runCapture call: ${cmd} ${args.join(' ')}`);
    };
    const ensureSqueezr = async () => ({ installed: true, configured: true });
    const installPreCommitHook = fakeInstallPreCommitHook([]);
    const common = { run, runCapture, log: () => {}, ensureSqueezr, cwd, installPreCommitHook };

    const first = await runInit(common);
    assert.equal(first.roles.reviewer, null);

    installed = ['claude', 'codex'];
    branch = 'feat/some-task\n';
    const second = await runInit({ ...common, reconfigure: true });

    assert.equal(second.roles.coder, 'claude');
    assert.equal(second.roles.reviewer, 'codex');
    assert.equal(second.baseBranch, 'main');
    const saved = JSON.parse(await readFile(path.join(cwd, '.kebel', 'kebel.config.json'), 'utf8'));
    assert.equal(saved.roles.reviewer, 'codex');
    assert.equal(saved.baseBranch, 'main');
  });
});
