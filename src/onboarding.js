export function buildOnboardingMessage({ roles }) {
  const label = (provider) => provider ?? '— sin asignar';

  return `
Bienvenido a Kebel. Así funciona en este proyecto:

- coder (${label(roles.coder)}): escribe el código.
- reviewer (${label(roles.reviewer)}): revisa cada diff antes de que entre a
  la rama base. Si no hay reviewer, "kb review --staged" te lo pide a ti.
- solomon (${label(roles.solomon)}): arbitra solo si discrepas de un rechazo
  del reviewer ("kb solomon").

Antes de cada commit: "kb review --staged". Las tareas se siguen con
"kb card add/list/move", las decisiones de diseño con "kb adr add/list", y
"kb doctor" da un diagnóstico completo del setup en cualquier momento.
`;
}
