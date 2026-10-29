import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createWigglyPoints } from './path.ts';

test('createWigglyPoints returns segments+1 points', () => {
  const points = createWigglyPoints({
    start: new Vector3(0, 0, 0),
    end: new Vector3(10, 0, 0),
    segments: 8,
  });
  assert.equal(points.length, 9);
});

test('createWigglyPoints pins the first and last point exactly to start/end (the envelope tapers to 0)', () => {
  const start = new Vector3(0, 0, 0);
  const end = new Vector3(10, 0, 3);
  const points = createWigglyPoints({ start, end, segments: 10, amplitude: 5 });

  assert.ok(points[0].equals(start));
  assert.ok(points[points.length - 1].equals(end));
});

test('createWigglyPoints with amplitude 0 lies exactly on the straight line', () => {
  const start = new Vector3(0, 0, 0);
  const end = new Vector3(10, 0, 0);
  const points = createWigglyPoints({ start, end, segments: 4, amplitude: 0 });

  points.forEach((point, i) => {
    const expectedX = (10 * i) / 4;
    assert.ok(Math.abs(point.x - expectedX) < 1e-9);
    assert.equal(point.z, 0);
  });
});

test('createWigglyPoints is deterministic for the same seeded random function', () => {
  const options = {
    start: new Vector3(0, 0, 0),
    end: new Vector3(10, 0, 0),
    segments: 12,
    amplitude: 2,
    random: () => 0.42,
  };
  const a = createWigglyPoints(options);
  const b = createWigglyPoints(options);

  a.forEach((point, i) => assert.ok(point.equals(b[i])));
});

test('createWigglyPoints produces a different path for a different random function', () => {
  const base = { start: new Vector3(0, 0, 0), end: new Vector3(10, 0, 0), segments: 12, amplitude: 2 };
  const a = createWigglyPoints({ ...base, random: () => 0.1 });
  const b = createWigglyPoints({ ...base, random: () => 0.9 });

  const differsSomewhere = a.some((point, i) => !point.equals(b[i]));
  assert.ok(differsSomewhere);
});

test('createWigglyPoints never produces NaN coordinates', () => {
  const points = createWigglyPoints({
    start: new Vector3(0, 0, 0),
    end: new Vector3(10, 0, 5),
    segments: 20,
    amplitude: 3,
  });
  points.forEach((point) => {
    assert.ok(Number.isFinite(point.x));
    assert.ok(Number.isFinite(point.y));
    assert.ok(Number.isFinite(point.z));
  });
});
