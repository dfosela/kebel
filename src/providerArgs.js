// Non-interactive/print-mode invocation differs per CLI: claude/agy/gemini
// use `-p <prompt>`, codex uses its own `exec <prompt>` subcommand.
const PROVIDER_EXEC_ARGS = {
  claude: (prompt) => ['-p', prompt],
  agy: (prompt) => ['-p', prompt],
  gemini: (prompt) => ['-p', prompt],
  codex: (prompt) => ['exec', prompt],
};

export function buildProviderArgs(provider, prompt) {
  const builder = PROVIDER_EXEC_ARGS[provider];
  if (!builder) {
    throw new Error(`Proveedor de IA desconocido: "${provider}".`);
  }
  return builder(prompt);
}
