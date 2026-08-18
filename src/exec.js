import { spawn, execFile } from 'node:child_process';

const isWindows = process.platform === 'win32';
const DEFAULT_TIMEOUT_MS = 30000;

// cmd.exe treats whitespace and ()^&|<>%! as metacharacters — quote any
// argument containing them so `shell: true` doesn't mis-tokenize things
// like `-e "process.exit(0)"`.
//
// IMPORTANT: cmd.exe's command-line parser is line-oriented — a raw
// newline inside a joined `shell: true` string truncates everything after
// it (verified: only the first line of a multi-line argument survives).
// Never route a multi-line argument (e.g. an AI prompt with an embedded
// diff) through shell:true; use shell:false for a real executable, or
// `input` (stdin) instead of an argv element.
function quoteForWindowsShell(value) {
  return /[\s"()^&|<>%!]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function spawnCommand(command, args, stdio, cwd, useShell) {
  return useShell
    ? spawn([command, ...args].map(quoteForWindowsShell).join(' '), { shell: true, stdio, cwd })
    : spawn(command, args, { stdio, cwd });
}

// shell:true spawns cmd.exe as an intermediary — child.kill() only signals
// that shell, not the real process tree underneath it, so on Windows we ask
// taskkill to tear down the whole tree instead.
function killOnTimeout(child, timeoutMs, onTimeout) {
  return setTimeout(() => {
    onTimeout();
    if (isWindows) {
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
    } else {
      child.kill('SIGKILL');
    }
  }, timeoutMs);
}

export function run(command, args = [], { timeoutMs = DEFAULT_TIMEOUT_MS, cwd, shell = isWindows } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, 'ignore', cwd, shell);
    let timedOut = false;
    const timer = killOnTimeout(child, timeoutMs, () => {
      timedOut = true;
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`${command} ${args.join(' ')} timed out after ${timeoutMs}ms`));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

export function runCapture(
  command,
  args = [],
  { timeoutMs = DEFAULT_TIMEOUT_MS, cwd, shell = isWindows, input } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, ['pipe', 'pipe', 'pipe'], cwd, shell);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    if (input !== undefined) {
      child.stdin.write(input);
    }
    child.stdin.end();

    let timedOut = false;
    const timer = killOnTimeout(child, timeoutMs, () => {
      timedOut = true;
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`${command} ${args.join(' ')} timed out after ${timeoutMs}ms`));
      } else if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          Object.assign(new Error(`${command} ${args.join(' ')} exited with code ${code}`), {
            stdout,
            stderr,
            code,
          }),
        );
      }
    });
  });
}
