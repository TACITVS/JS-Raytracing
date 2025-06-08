import { createWorld, addEntity, addComponent } from 'bitecs';
import { Transform, Mesh } from './ecs/components';
import { TransformSystem } from './ecs/systems';
import { initWebGPU, createRenderPipeline, render } from './renderer/gpu';

async function main() {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas element not found');
  const gpu = await initWebGPU(canvas);
  if (!gpu) return;

  const { device, context, format } = gpu;

  const pipeline = createRenderPipeline(device, format);

  const world = createWorld();

  // Example entity creation
  const eid = addEntity(world);
  addComponent(world, Transform, eid);
  addComponent(world, Mesh, eid);

  function frame() {
    TransformSystem(world);
    render(device, context, pipeline);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((err) => console.error(err));
