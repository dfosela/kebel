export function buildSolomonPrompt({ diff, previousReason }) {
  return `Eres un árbitro independiente de terceros. Un reviewer ya rechazó este diff (git diff --cached, ya extraído como texto) con el motivo: "${previousReason}". El autor original discrepa de ese rechazo y pide arbitraje.

Revisa el diff de forma objetiva y decide si el rechazo original estaba justificado.

Reglas:
- No asumas que el rechazo original es correcto ni que el autor tiene razón: evalúa el diff tú mismo.
- Si encuentras un problema de seguridad real (secretos, inyección, vulnerabilidad explotable), marca "security_finding": true y "verdict": "rejected". Esto nunca se puede overridear, ni en arbitraje.
- Si el rechazo original no estaba justificado y el diff es correcto, responde "verdict": "approved".
- Si el rechazo original sí estaba justificado, responde "verdict": "rejected" explicando el motivo en "reason".

Responde ÚNICAMENTE con un JSON exacto de esta forma, sin texto adicional antes ni después:
{"verdict": "approved" | "rejected", "reason": "string breve", "security_finding": true | false}

Diff a arbitrar:
${diff}
`;
}
