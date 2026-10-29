import { Vector3, CatmullRomCurve3 } from 'three';
import { createNoise2D } from 'simplex-noise';

export interface WigglyPathOptions {
  start: Vector3;
  end: Vector3;
  segments?: number;
  amplitude?: number;
  frequency?: number;
  random?: () => number;
}

export function createWigglyPoints({
  start,
  end,
  segments = 12,
  amplitude = 1,
  frequency = 0.6,
  random,
}: WigglyPathOptions): Vector3[] {
  const noise2D = createNoise2D(random);
  const direction = new Vector3().subVectors(end, start);
  const forward = direction.clone().normalize();
  const lateral = new Vector3(-forward.z, 0, forward.x);

  const points: Vector3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    // Clamp the ends exactly to 0 instead of trusting floating-point sin(π) to land on zero.
    const envelope = i === 0 || i === segments ? 0 : Math.sin(Math.PI * t);
    const noiseValue = noise2D(t * frequency * segments, 0);
    const point = new Vector3().copy(start).addScaledVector(direction, t);
    point.addScaledVector(lateral, noiseValue * amplitude * envelope);
    points.push(point);
  }
  return points;
}

export function createWigglyCurve(options: WigglyPathOptions): CatmullRomCurve3 {
  return new CatmullRomCurve3(createWigglyPoints(options));
}
