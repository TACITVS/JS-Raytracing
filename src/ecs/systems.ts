import { IWorld, defineQuery, System } from 'bitecs';
// Add the .js extension to the relative file import
import { Transform } from './components.js';

const transformQuery = defineQuery([Transform]);

export const TransformSystem: System = (world: IWorld) => {
  const entities = transformQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    // Rotate each entity a little every frame
    Transform.rotation.x[eid] += 0.01;
    Transform.rotation.y[eid] += 0.01;
    Transform.rotation.z[eid] += 0.01;
  }
  return world;
};
