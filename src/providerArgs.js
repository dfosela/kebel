// How to hand a (potentially multi-line) prompt to each provider's CLI
// without going through cmd.exe's command-line parser, which truncates a
// joined shell:true argument at its first embedded newline on Windows:
//
// - claude/codex/gemini are npm .cmd shims (need a shell to launch at
//   all), but all read the prompt from stdin when none is given as an
//   argv element — so the prompt never touches cmd.exe's parser.
// - agy is a real .exe. It requires the prompt as an argv value (no
//   stdin support in print mode), so instead it's spawned WITHOUT a
//   shell — Windows' native argv marshalling (unlike cmd.exe) preserves
//   embedded newlines correctly.
const PROVIDERS = {
  claude: { baseArgs: ['-p'], promptVia: 'stdin', shell: true },
  codex: { baseArgs: ['exec'], promptVia: 'stdin', shell: true },
  gemini: { baseArgs: ['-p'], promptVia: 'stdin', shell: true },
  agy: { baseArgs: ['-p'], promptVia: 'arg', shell: false },
};

export function getProviderInvocation(provider) {
  const invocation = PROVIDERS[provider];
  if (!invocation) {
    throw new Error(`Proveedor de IA desconocido: "${provider}".`);
  }
  return invocation;
}

export function buildProviderCall(provider, prompt) {
  const invocation = getProviderInvocation(provider);
  const args = invocation.promptVia === 'arg' ? [...invocation.baseArgs, prompt] : invocation.baseArgs;
  const input = invocation.promptVia === 'stdin' ? prompt : undefined;
  return { args, input, shell: invocation.shell };
}
