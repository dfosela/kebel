import { KNOWN_PROVIDERS } from './config.js';
import { checkProvider as defaultCheckProvider } from './doctor.js';

export const PROVIDER_LABELS = {
  claude: 'Claude',
  codex: 'ChatGPT (Codex)',
  gemini: 'Gemini',
  agy: 'Antigravity',
};

export const NOT_INSTALLED_REASON = 'binario no encontrado en PATH';

export async function probeProviders({ run, runCapture, checkProvider = defaultCheckProvider }) {
  return Promise.all(KNOWN_PROVIDERS.map((provider) => checkProvider({ provider, run, runCapture })));
}

export function availableProviders(report) {
  return report.filter(({ ok }) => ok).map(({ provider }) => provider);
}

export function formatProviderReport(report) {
  const lines = report.map(({ provider, ok, reason }) => {
    const label = PROVIDER_LABELS[provider] ?? provider;
    if (ok) return `  ✓ ${label}: lista`;
    if (reason === NOT_INSTALLED_REASON) return `  ○ ${label}: no instalada`;
    return `  ✗ ${label}: ${reason}`;
  });
  return ['IAs detectadas:', ...lines];
}
