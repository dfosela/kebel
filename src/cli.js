import { ensureSqueezr as defaultEnsureSqueezr } from './squeezr.js';
import { run as defaultRun } from './exec.js';
import { runInit as defaultRunInit } from './init.js';

const USAGE = `Usage: kb [command] [options]

Commands:
  init        Detect AI providers, assign coder/reviewer/solomon roles and set up Squeezr
  setup       Detect/install Squeezr and configure it as the default proxy

Options:
  --version   Print the kb version
  --help      Print this help
`;

export async function runCli(
  argv,
  {
    version,
    stdout,
    ensureSqueezr = defaultEnsureSqueezr,
    run = defaultRun,
    runInit = defaultRunInit,
  },
) {
  if (argv.includes('--version')) {
    stdout.write(`${version}\n`);
    return 0;
  }
  if (argv.includes('--help')) {
    stdout.write(USAGE);
    return 0;
  }
  const log = (msg) => stdout.write(`${msg}\n`);
  if (argv[0] === 'setup') {
    await ensureSqueezr({ run, log });
    return 0;
  }
  if (argv[0] === 'init') {
    await runInit({ run, log, ensureSqueezr });
    return 0;
  }
  stdout.write(USAGE);
  return 0;
}
