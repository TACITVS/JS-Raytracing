import { createWorld, addEntity, addComponent } from 'bitecs';
import { Transform, Mesh } from '../ecs/components';
import { TransformSystem } from '../ecs/systems';
import { initWebGPU } from '../renderer/gpu';

export async function runDemo() {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas element not found');
  const device = await initWebGPU(canvas);
  if (!device) return;

  const world = createWorld();
  const entities: number[] = [];

  // Create a few sample entities
  for (let i = 0; i < 3; i++) {
    const eid = addEntity(world);
    addComponent(world, Transform, eid);
    addComponent(world, Mesh, eid);
    Transform.position.x[eid] = i * 1.5;
    entities.push(eid);
  }

  function frame() {
    for (const eid of entities) {
      // Rotate each entity a little every frame
      Transform.rotation.y[eid] += 0.01;
    }

    TransformSystem(world);
    // Rendering would occur here
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

runDemo().catch((err) => console.error(err));
