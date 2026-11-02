import { loadConfig } from './kebelConfig.js';
import { buildProviderCall } from './providerArgs.js';
import { run as defaultRun, runCapture as defaultRunCapture } from './exec.js';
import { classifyProviderError } from './doctorFormat.js';

const PING_PROMPT = 'ping';

async function checkBinary(name, run) {
  return run(name, ['--version'], { timeoutMs: 10_000 }).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, reason: error.message }),
  );
}

export async function checkProvider({ provider, run, runCapture }) {
  if (!provider) {
    return { provider: null, ok: false, reason: 'rol no asignado' };
  }

  const binary = await checkBinary(provider, run);
  if (!binary.ok) {
    return { provider, ok: false, reason: 'binario no encontrado en PATH' };
  }

  const { args, input, shell } = buildProviderCall(provider, PING_PROMPT);

  try {
    await runCapture(provider, args, { timeoutMs: 60_000, shell, input });
    return { provider, ok: true };
  } catch (error) {
    const detail = [error.stderr, error.stdout, error.message].filter(Boolean).join('\n');
    return { provider, ok: false, reason: classifyProviderError(detail) };
  }
}

export async function runDoctor({ run = defaultRun, runCapture = defaultRunCapture, cwd = process.cwd() } = {}) {
  const git = await checkBinary('git', run);

  const config = await loadConfig(cwd);
  if (!config) {
    return {
      git,
      config: { ok: false, reason: 'Kebel no está inicializado en este proyecto. Ejecuta "kb init".' },
      providers: [],
      squeezr: null,
    };
  }

  const providers = await Promise.all(
    Object.entries(config.roles ?? {}).map(async ([role, provider]) => ({
      role,
      ...(await checkProvider({ provider, run, runCapture })),
    })),
  );

  const squeezr = await checkBinary('squeezr', run);

  return { git, config: { ok: true }, providers, squeezr };
}
