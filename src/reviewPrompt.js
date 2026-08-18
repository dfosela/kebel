export function buildReviewPrompt(diff) {
  return `Eres un revisor de código independiente. Revisa el siguiente diff (git diff --cached, ya extraído como texto — no necesitas ejecutar ningún comando) y decide si se aprueba para commit.

Reglas:
- No asumas que el diff es tuyo: evalúalo de forma objetiva.
- Si encuentras un problema de seguridad real (secretos, inyección, vulnerabilidad explotable), marca "security_finding": true y "verdict": "rejected".
- Si el diff es correcto, responde "verdict": "approved".
- Si tiene un problema real no relacionado con seguridad, responde "verdict": "rejected" explicando el motivo en "reason".

Responde ÚNICAMENTE con un JSON exacto de esta forma, sin texto adicional antes ni después:
{"verdict": "approved" | "rejected", "reason": "string breve", "security_finding": true | false}

Diff a revisar:
${diff}
`;
}
