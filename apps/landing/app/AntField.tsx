'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3, Group, CatmullRomCurve3 } from 'three';
import { createWigglyCurve } from '../lib/ants/path';
import { createAnt, LEG_NAMES } from '../lib/ants/ant';
import { legSwingAngle } from '../lib/ants/gait';

const WALK_SPEED = 0.08;

function Ant({ curve, offset }: { curve: CatmullRomCurve3; offset: number }) {
  const groupRef = useRef<Group>(null);
  const antGroup = useMemo(() => createAnt(), []);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const t = (state.clock.elapsedTime * WALK_SPEED + offset) % 1;
    const position = curve.getPointAt(t);
    const lookAhead = curve.getPointAt(Math.min(t + 0.01, 1));

    group.position.copy(position);
    group.lookAt(lookAhead);

    LEG_NAMES.forEach((legName, legIndex) => {
      const leg = antGroup.getObjectByName(legName);
      if (leg) {
        leg.rotation.x = legSwingAngle({ time: state.clock.elapsedTime, legIndex });
      }
    });
  });

  return <primitive ref={groupRef} object={antGroup} />;
}

export default function AntField() {
  const curve = useMemo(
    () => createWigglyCurve({ start: new Vector3(-6, 0, 0), end: new Vector3(6, 0, 0), amplitude: 1.5 }),
    [],
  );
  const ants = useMemo(() => Array.from({ length: 6 }, (_, i) => i / 6), []);

  return (
    <Canvas camera={{ position: [0, 6, 4], fov: 40 }} dpr={[1, 2]}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 2]} intensity={0.6} />
      {ants.map((offset) => (
        <Ant key={offset} curve={curve} offset={offset} />
      ))}
    </Canvas>
  );
}
