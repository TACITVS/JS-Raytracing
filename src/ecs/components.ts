import { defineComponent, Types } from 'bitecs';

/**
 * Stores position, rotation, and scale for an entity.
 */
export const Transform = defineComponent({
  position: { x: Types.f32, y: Types.f32, z: Types.f32 },
  rotation: { x: Types.f32, y: Types.f32, z: Types.f32, w: Types.f32 },
  scale: { x: Types.f32, y: Types.f32, z: Types.f32 }
});

/**
 * Stores an Axis-Aligned Bounding Box. Used for culling and raytracing acceleration.
 * The min and max points define the box.
 */
export const AABB = defineComponent({
    min: { x: Types.f32, y: Types.f32, z: Types.f32 },
    max: { x: Types.f32, y: Types.f32, z: Types.f32 }
});

/**
 * Represents a renderable mesh.
 * It holds references (as placeholder numbers for now) to GPU buffers
 * and material information. A real implementation would use a resource handle system.
 */
export const Mesh = defineComponent({
  vertexBuffer: Types.ui32,
  indexBuffer: Types.ui32,
  materialId: Types.ui32, // An ID referencing a material definition
  indexCount: Types.ui32
});