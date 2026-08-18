import { ensureSqueezr as defaultEnsureSqueezr } from './squeezr.js';
import { run as defaultRun } from './exec.js';

const USAGE = `Usage: kb [command] [options]

Commands:
  setup       Detect/install Squeezr and configure it as the default proxy

Options:
  --version   Print the kb version
  --help      Print this help
`;

export async function runCli(
  argv,
  { version, stdout, ensureSqueezr = defaultEnsureSqueezr, run = defaultRun },
) {
  if (argv.includes('--version')) {
    stdout.write(`${version}\n`);
    return 0;
  }
  if (argv.includes('--help')) {
    stdout.write(USAGE);
    return 0;
  }
  if (argv[0] === 'setup') {
    await ensureSqueezr({ run, log: (msg) => stdout.write(`${msg}\n`) });
    return 0;
  }
  stdout.write(USAGE);
  return 0;
}
