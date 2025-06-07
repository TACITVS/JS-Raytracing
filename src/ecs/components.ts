import { defineComponent, Types } from 'bitecs';

export const Transform = defineComponent({
  position: { x: Types.f32, y: Types.f32, z: Types.f32 },
  rotation: { x: Types.f32, y: Types.f32, z: Types.f32, w: Types.f32 },
  scale: { x: Types.f32, y: Types.f32, z: Types.f32 }
});

export const Mesh = defineComponent({
  vertexBuffer: Types.ui32,
  indexBuffer: Types.ui32,
  material: Types.ui32,
  boundingBox: { min: Types.f32, max: Types.f32 }
});
