import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnt, LEG_NAMES } from './ant.ts';

test('createAnt builds a named group with head, thorax, abdomen, 2 antennae and 6 legs', () => {
  const ant = createAnt();

  assert.equal(ant.name, 'ant');
  assert.equal(ant.children.length, 11);

  const names = ant.children.map((child) => child.name);
  assert.ok(names.includes('head'));
  assert.ok(names.includes('thorax'));
  assert.ok(names.includes('abdomen'));
  assert.ok(names.includes('antenna-left'));
  assert.ok(names.includes('antenna-right'));
  LEG_NAMES.forEach((legName) => assert.ok(names.includes(legName)));
});

test('createAnt applies the given scale to the whole group', () => {
  const ant = createAnt({ scale: 2 });
  assert.equal(ant.scale.x, 2);
  assert.equal(ant.scale.y, 2);
  assert.equal(ant.scale.z, 2);
});

test('createAnt defaults to scale 1 when not given', () => {
  const ant = createAnt();
  assert.equal(ant.scale.x, 1);
});
