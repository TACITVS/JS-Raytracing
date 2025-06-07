import { IWorld, defineQuery, System } from 'bitecs';
import { Transform } from './components';

const transformQuery = defineQuery([Transform]);

export const TransformSystem: System = (world: IWorld) => {
  const entities = transformQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    // Placeholder: update transform, apply physics, etc.
    Transform.position.x[eid] += 0;
    Transform.position.y[eid] += 0;
    Transform.position.z[eid] += 0;
  }
  return world;
};
