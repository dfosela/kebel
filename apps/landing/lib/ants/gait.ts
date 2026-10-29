// Trípode alterno: las patas de índice par forman un trípode y las impares
// el otro, en anti-fase — mientras uno empuja hacia atrás, el otro avanza.
export function legPhase(legIndex: number): number {
  return (legIndex % 2) * Math.PI;
}

export interface LegSwingOptions {
  time: number;
  legIndex: number;
  frequency?: number;
  amplitude?: number;
}

export function legSwingAngle({ time, legIndex, frequency = 6, amplitude = 0.5 }: LegSwingOptions): number {
  return Math.sin(time * frequency + legPhase(legIndex)) * amplitude;
}
