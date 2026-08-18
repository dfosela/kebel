import { spawn, execFile } from 'node:child_process';

const isWindows = process.platform === 'win32';
const DEFAULT_TIMEOUT_MS = 30000;

// cmd.exe treats whitespace and ()^&|<>%! as metacharacters — quote any
// argument containing them so `shell: true` doesn't mis-tokenize things
// like `-e "process.exit(0)"`.
function quoteForWindowsShell(value) {
  return /[\s"()^&|<>%!]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function run(command, args = [], { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = isWindows
      ? spawn([command, ...args].map(quoteForWindowsShell).join(' '), { shell: true, stdio: 'ignore' })
      : spawn(command, args, { stdio: 'ignore' });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      // shell:true spawns cmd.exe as an intermediary — child.kill() only
      // signals that shell, not the real process tree underneath it, so on
      // Windows we ask taskkill to tear down the whole tree instead.
      if (isWindows) {
        execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
      } else {
        child.kill('SIGKILL');
      }
    }, timeoutMs);

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
