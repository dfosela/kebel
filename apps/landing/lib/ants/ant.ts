import { Group, Mesh, SphereGeometry, CapsuleGeometry, MeshStandardMaterial } from 'three';

export const LEG_NAMES = ['leg-0', 'leg-1', 'leg-2', 'leg-3', 'leg-4', 'leg-5'] as const;

export interface AntOptions {
  color?: number | string;
  scale?: number;
}

function createLeg(name: string, index: number, material: MeshStandardMaterial): Group {
  const leg = new Group();
  leg.name = name;

  const side = index % 2 === 0 ? 1 : -1;
  const along = Math.floor(index / 2) - 1; // -1 delantera, 0 media, 1 trasera
  leg.position.set(along * 0.4, -0.15, side * 0.45);

  const upper = new Mesh(new CapsuleGeometry(0.04, 0.35, 2, 4), material);
  upper.name = `${name}-upper`;
  upper.rotation.z = (side * Math.PI) / 4;
  leg.add(upper);

  return leg;
}

export function createAnt({ color = 0x1f1b18, scale = 1 }: AntOptions = {}): Group {
  const material = new MeshStandardMaterial({ color });

  const ant = new Group();
  ant.name = 'ant';

  const abdomen = new Mesh(new SphereGeometry(0.5, 8, 8), material);
  abdomen.name = 'abdomen';
  abdomen.position.set(-0.9, 0, 0);

  const thorax = new Mesh(new SphereGeometry(0.3, 8, 8), material);
  thorax.name = 'thorax';

  const head = new Mesh(new SphereGeometry(0.25, 8, 8), material);
  head.name = 'head';
  head.position.set(0.7, 0, 0);

  const antennaGeometry = new CapsuleGeometry(0.02, 0.5, 2, 4);
  const antennaLeft = new Mesh(antennaGeometry, material);
  antennaLeft.name = 'antenna-left';
  antennaLeft.position.set(1, 0.1, 0.1);
  antennaLeft.rotation.z = -Math.PI / 6;

  const antennaRight = new Mesh(antennaGeometry, material);
  antennaRight.name = 'antenna-right';
  antennaRight.position.set(1, 0.1, -0.1);
  antennaRight.rotation.z = Math.PI / 6;

  const legs = LEG_NAMES.map((name, index) => createLeg(name, index, material));

  ant.add(abdomen, thorax, head, antennaLeft, antennaRight, ...legs);
  ant.scale.setScalar(scale);

  return ant;
}
