import { checkProvider as defaultCheckProvider } from './doctor.js';

export const KNOWN_PROVIDERS = ['claude', 'codex', 'gemini', 'agy'];

export async function detectProviders({ run, runCapture, checkProvider = defaultCheckProvider }) {
  const results = await Promise.all(
    KNOWN_PROVIDERS.map(async (name) => {
      const { ok } = await checkProvider({ provider: name, run, runCapture });
      return ok ? name : null;
    }),
  );
  return results.filter(Boolean);
}

export function assignRoles(available) {
  const [coder = null, reviewer = null, solomon = null] = available;
  const warnings = [];
  if (!coder) {
    warnings.push('Ningún proveedor de IA disponible para el rol coder.');
  }
  if (!reviewer) {
    warnings.push(
      'Ningún proveedor distinto disponible para el rol reviewer — la revisión cruzada no funcionará hasta instalar una segunda CLI.',
    );
  }
  if (!solomon) {
    warnings.push(
      'Ningún tercer proveedor disponible para el rol solomon — el arbitraje no estará disponible hasta instalar una tercera CLI.',
    );
  }
  return { coder, reviewer, solomon, warnings };
}
