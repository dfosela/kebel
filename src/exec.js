import { spawn, execFile } from 'node:child_process';

const isWindows = process.platform === 'win32';
const DEFAULT_TIMEOUT_MS = 30000;

// cmd.exe treats whitespace and ()^&|<>%! as metacharacters — quote any
// argument containing them so `shell: true` doesn't mis-tokenize things
// like `-e "process.exit(0)"`.
function quoteForWindowsShell(value) {
  return /[\s"()^&|<>%!]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function spawnCommand(command, args, stdio, cwd) {
  return isWindows
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

export function run(command, args = [], { timeoutMs = DEFAULT_TIMEOUT_MS, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, 'ignore', cwd);
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

export function runCapture(command, args = [], { timeoutMs = DEFAULT_TIMEOUT_MS, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, ['ignore', 'pipe', 'pipe'], cwd);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

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
