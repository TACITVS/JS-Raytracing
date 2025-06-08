// File: src/ecs/systems/TransformSystem.ts
// Tag: TRANSFORM_SYSTEM_FILE
// Description: The TransformSystem, moved into its own file for consistency.
// This system is responsible for updating entity transformations.

import { IWorld, defineQuery } from 'bitecs';
import { Transform } from '../components.js';

const transformQuery = defineQuery([Transform]);

/**
 * A placeholder system. In a real engine, this would apply transformations
 * based on velocity, user input, or animations. For this demo, it can
 * be used to apply a simple rotation each frame.
 * @param world The ECS world.
 */
export const TransformSystem: (world: IWorld) => IWorld = (world: IWorld) => {
  const entities = transformQuery(world);
  const deltaTime = 1/60; // assume 60fps for demo

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    // This is where you would update entity transforms.
    // For example, to make objects spin:
    // quat.rotateY(Transform.rotation[eid], Transform.rotation[eid], 0.5 * deltaTime);
  }
  return world;
};