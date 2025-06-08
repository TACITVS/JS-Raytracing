// File: src/acceleration/BVH.ts
// Tag: BVH_IMPLEMENTATION_SKELETON
// Description: Defines the structure and placeholder for the BVH (Bounding Volume Hierarchy) builder,
// which is essential for accelerating raytracing performance.

import { IWorld, defineQuery } from 'bitecs';
import { AABB, Mesh } from '../ecs/components.js';

// Query for all entities that have a mesh and a bounding box, which are the candidates for the BVH.
const bvhQuery = defineQuery([Mesh, AABB]);

/**
 * Represents a node in the flattened BVH structure that will be sent to the GPU.
 * The layout is optimized for GPU memory access.
 * Each node is 8 floats (2x vec4<f32> in WGSL).
 */
export interface FlatBVHNode {
    // xyz: AABB min, w: leftChild index or first primitive index
    min: [number, number, number, number];
    // xyz: AABB max, w: primitive count (if leaf) or 0 (if internal)
    max: [number, number, number, number];
}

export class BVH {
    public nodes: FlatBVHNode[] = [];
    private world: IWorld;

    constructor(world: IWorld) {
        this.world = world;
    }

    /**
     * Builds the BVH for all relevant entities in the world.
     * This is a complex process that involves partitioning geometry.
     * For now, this is a placeholder for the real implementation.
     */
    build(): void {
        const entities = bvhQuery(this.world);
        if (entities.length === 0) {
            this.nodes = [];
            return;
        }

        console.log(`Building BVH for ${entities.length} entities.`);

        // --- Placeholder for the actual build algorithm ---
        // The real implementation would go here, and it is highly complex.
        // 1. Create a list of "build primitives", containing entity ID, AABB, and center point.
        // 2. Recursively subdivide the list of primitives.
        //    - A good algorithm is the Surface Area Heuristic (SAH) for finding the best split plane.
        //    - A simpler starting point is a median split on the longest axis.
        // 3. As the tree is built, populate the `this.nodes` array with FlatBVHNode objects.
        // 4. The root node will be at index 0.

        // For now, we will create a dummy single-node BVH that encompasses all entities.
        this.createDummyBVH(entities);
    }
    
    /**
     * A temporary function to create a single large bounding box for all entities.
     * This is just to have a valid, albeit inefficient, BVH structure.
     */
    private createDummyBVH(entities: number[]) {
        if (entities.length === 0) return;

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (const eid of entities) {
            minX = Math.min(minX, AABB.min.x[eid]);
            minY = Math.min(minY, AABB.min.y[eid]);
            minZ = Math.min(minZ, AABB.min.z[eid]);
            maxX = Math.max(maxX, AABB.max.x[eid]);
            maxY = Math.max(maxY, AABB.max.y[eid]);
            maxZ = Math.max(maxZ, AABB.max.z[eid]);
        }

        this.nodes = [{
            min: [minX, minY, minZ, 0], // The first primitive is at index 0
            max: [maxX, maxY, maxZ, entities.length] // This is a leaf node containing all entities
        }];
    }

    /**
     * Returns the flattened BVH node array as a Float32Array, ready for the GPU.
     */
    getFlattenedNodes(): Float32Array {
        // Each node has 2 vec4s, which is 8 floats.
        const flatData = new Float32Array(this.nodes.length * 8);
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            flatData.set(node.min, i * 8);
            flatData.set(node.max, i * 8 + 4);
        }
        return flatData;
    }
}