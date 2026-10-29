import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legPhase, legSwingAngle } from './gait.ts';

test('legPhase alternates between 0 and π for adjacent leg indices (tripod grouping)', () => {
  assert.equal(legPhase(0), 0);
  assert.equal(legPhase(1), Math.PI);
  assert.equal(legPhase(2), 0);
  assert.equal(legPhase(3), Math.PI);
});

test('legSwingAngle stays within [-amplitude, amplitude]', () => {
  for (let t = 0; t < 10; t += 0.37) {
    const angle = legSwingAngle({ time: t, legIndex: 0, amplitude: 0.5 });
    assert.ok(angle <= 0.5 + 1e-9 && angle >= -0.5 - 1e-9);
  }
});

test('legSwingAngle puts the two tripods in exact anti-phase at a quarter cycle', () => {
  const frequency = 1;
  const quarterCycleTime = Math.PI / (2 * frequency);

  const tripodA = legSwingAngle({ time: quarterCycleTime, legIndex: 0, frequency, amplitude: 1 });
  const tripodB = legSwingAngle({ time: quarterCycleTime, legIndex: 1, frequency, amplitude: 1 });

  assert.ok(Math.abs(tripodA - 1) < 1e-9);
  assert.ok(Math.abs(tripodB + 1) < 1e-9);
});

test('legSwingAngle is zero for every leg at time 0 (neutral stance)', () => {
  for (let legIndex = 0; legIndex < 6; legIndex += 1) {
    assert.ok(Math.abs(legSwingAngle({ time: 0, legIndex })) < 1e-9);
  }
});
