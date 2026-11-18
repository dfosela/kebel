import { spawn } from 'node:child_process';
import { askHumanApproval } from './humanApproval.js';
import { checkProvider as defaultCheckProvider } from './doctor.js';
import {
  PROVIDER_LABELS,
  NOT_INSTALLED_REASON,
  probeProviders,
  availableProviders,
  formatProviderReport,
} from './providerReport.js';

// Gemini and Antigravity have no separate login command: signing in happens
// the first time their interactive session opens.
const PROVIDER_SETUP = {
  claude: { loginArgs: ['auth', 'login'], npmPackage: '@anthropic-ai/claude-code' },
  codex: { loginArgs: ['login'], npmPackage: '@openai/codex' },
  gemini: {
    loginArgs: [],
    npmPackage: '@google/gemini-cli',
    note: 'se abrirá Gemini: elige "Login with Google" y sal con /quit',
  },
  agy: { loginArgs: [], note: 'se abrirá Antigravity: inicia sesión y sal cuando termine' },
};

function defaultRunInteractive(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} terminó con código ${code}`)),
    );
  });
}

const commandText = (steps) => steps.map(([cmd, args]) => [cmd, ...args].join(' ')).join(' && ');

async function offerProvider(entry, deps) {
  const { run, runCapture, log, ask, runInteractive, checkProvider, isInteractive } = deps;
  const { provider, reason } = entry;
  const label = PROVIDER_LABELS[provider] ?? provider;
  const setup = PROVIDER_SETUP[provider];
  const installed = reason !== NOT_INSTALLED_REASON;

  if (!installed && !setup.npmPackage) {
    log(`  Para usar ${label}, instálala por tu cuenta y vuelve a ejecutar "kb init".`);
    return entry;
  }
  const steps = [
    ...(installed ? [] : [['npm', ['install', '-g', setup.npmPackage]]]),
    [provider, setup.loginArgs],
  ];
  if (!isInteractive) {
    log(`  Para añadir ${label}: ${commandText(steps)}`);
    return entry;
  }

  const question = installed
    ? `¿Quieres iniciar sesión en ${label} ahora? (s/n) `
    : `${label} no está instalada. ¿Instalarla e iniciar sesión ahora? (s/n) `;
  if (!(await ask(question))) return entry;

  if (setup.note) log(`  (${setup.note})`);
  try {
    for (const [cmd, args] of steps) await runInteractive(cmd, args);
  } catch (error) {
    log(`  ✗ ${label}: ${error.message}`);
    return entry;
  }
  const recheck = await checkProvider({ provider, run, runCapture });
  log(recheck.ok ? `  ✓ ${label}: lista` : `  ✗ ${label} sigue sin estar disponible: ${recheck.reason}`);
  return recheck;
}

export async function setupProviders({
  run,
  runCapture,
  log,
  ask = (promptText) => askHumanApproval({ promptText }),
  runInteractive = defaultRunInteractive,
  checkProvider = defaultCheckProvider,
  isInteractive = Boolean(process.stdin.isTTY),
}) {
  const report = await probeProviders({ run, runCapture, checkProvider });
  formatProviderReport(report).forEach((line) => log(line));

  const deps = { run, runCapture, log, ask, runInteractive, checkProvider, isInteractive };
  const final = [];
  for (const entry of report) {
    final.push(entry.ok ? entry : await offerProvider(entry, deps));
  }
  return availableProviders(final);
}
