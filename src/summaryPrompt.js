export function buildSummaryPrompt(diff) {
  return `No hay una segunda IA disponible para revisar este diff, así que un humano va a decidir si lo aprueba.

Escribe un resumen corto (3-6 líneas, lenguaje llano, sin jerga) de este diff (git diff --cached, ya extraído como texto) para esa persona: qué cambia y por qué, qué debería mirar si quiere revisarlo él mismo. No incluyas un veredicto ni código, solo el resumen en texto plano.

Diff:
${diff}
`;
}
