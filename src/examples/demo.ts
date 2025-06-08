import { createWorld, addEntity, addComponent } from 'bitecs';
import { Transform, Mesh } from '../ecs/components';
import { TransformSystem } from '../ecs/systems';
import { initWebGPU, createRenderPipeline, render } from '../renderer/gpu';

export async function runDemo() {
  // Select the canvas by its ID
  const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas element with ID "webgpu-canvas" not found');

  // Make the canvas visually sharp on high-DPI displays
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;

  const gpu = await initWebGPU(canvas);
  if (!gpu) return;

  const { device, context, format } = gpu;

  const pipeline = createRenderPipeline(device, format);

  const world = createWorld();
  const entities: number[] = [];

  // Create a few sample entities
  for (let i = 0; i < 3; i++) {
    const eid = addEntity(world);
    addComponent(world, Transform, eid);
    addComponent(world, Mesh, eid);
    Transform.position.x[eid] = (i - 1) * 1.5; // Center the entities
    entities.push(eid);
  }

  function frame() {
    TransformSystem(world);
    render(device, context, pipeline);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

runDemo().catch((err) => console.error(err));
