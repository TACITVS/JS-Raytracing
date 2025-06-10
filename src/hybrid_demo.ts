// File: src/hybrid_demo.ts
// Path: src/hybrid_demo.ts
// Description: Enhanced hybrid demo using ResourceManager for optimal GPU resource management.
// Now uses the new resource management patterns and provides better error handling and debugging.

import { addComponent, addEntity, createWorld, IWorld } from "bitecs";
import { quat } from "gl-matrix";
import { AABB, Mesh, Transform } from "./ecs/components.js";
import { TransformSystem } from "./ecs/systems/TransformSystem.js";
import { BVH } from './acceleration/BVH.js';
import { GBuffer } from './renderer/GBuffer.js';
import { Renderer } from './renderer/Renderer.js';
import { RasterRenderSystem } from './ecs/systems/RasterRenderSystem.js';
import { RaytracingSystem } from './ecs/systems/RaytracingSystem.js';
import { CompositionSystem } from './ecs/systems/CompositionSystem.js';

export class HybridDemo {
    renderer!: Renderer;
    world: IWorld;
    gbuffer!: GBuffer;
    bvh!: BVH;
    raytracingOutput!: GPUTexture;

    // Demo scene resources - now managed by ResourceManager
    cubeVertexBuffer!: GPUBuffer;
    cubeIndexBuffer!: GPUBuffer;
    cubeIndexCount = 0;

    // Standard sampler for texture operations
    standardSampler!: GPUSampler;

    constructor() {
        this.world = createWorld();
    }

    async startup() {
        const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        if (!canvas) throw new Error('Canvas element with ID "webgpu-canvas" not found.');

        // Initialize the enhanced renderer with ResourceManager
        this.renderer = await Renderer.getInstance(canvas);
        console.log('=== Hybrid Demo Initialization ===');
        console.log('Renderer capabilities:', this.renderer.capabilities);

        // Initialize rendering components
        this.gbuffer = new GBuffer(this.renderer);
        this.bvh = new BVH(this.world);
        
        // Create standard sampler for texture operations
        this.standardSampler = this.renderer.createStandardSampler('Demo Sampler');
        
        // Use ResourceManager to create raytracing output texture
        this.raytracingOutput = this.renderer.resources.createStorageTexture(
            'raytracing_output',
            canvas.width,
            canvas.height,
            'rgba8unorm'
        );

        console.log('Created raytracing output texture:', {
            width: canvas.width,
            height: canvas.height,
            format: 'rgba8unorm'
        });
        
        await this.createScene();
        
        console.log('=== Demo Scene Created ===');
        console.log('Resource stats after scene creation:', this.renderer.resources.getResourceStats());
        console.log('===============================');
        
        requestAnimationFrame(this.update.bind(this));
    }

    async createScene() {
        console.log('Creating demo scene geometry...');

        // Create cube geometry data
        const cubeVertexData = new Float32Array([
            //-x face
            -1,-1,-1, -1,0,0,  -1,-1,1,  -1,0,0,  -1,1,1,  -1,0,0,  -1,1,-1,  -1,0,0,
            //+x face
            1,1,-1,  1,0,0,  1,1,1,  1,0,0,  1,-1,1,  1,0,0,  1,-1,-1,  1,0,0,
            //-y face
            -1,-1,-1, 0,-1,0,  1,-1,-1, 0,-1,0,  1,-1,1,  0,-1,0,  -1,-1,1,  0,-1,0,
            //+y face
            -1,1,1,  0,1,0,  1,1,1,  0,1,0,  1,1,-1,  0,1,0,  -1,1,-1,  0,1,0,
            //-z face
            1,-1,-1,  0,0,-1, -1,-1,-1,  0,0,-1,  -1,1,-1,  0,0,-1,  1,1,-1,  0,0,-1,
            //+z face
            -1,1,1,  0,0,1,  1,1,1,  0,0,1,  1,-1,1,  0,0,1,  -1,-1,1,  0,0,1,
        ]);

        const cubeIndexData = new Uint16Array([
            0,1,2, 0,2,3,    4,5,6, 4,6,7,       // -x and +x faces
            8,9,10, 8,10,11, 12,13,14, 12,14,15, // -y and +y faces
            16,17,18, 16,18,19, 20,21,22, 20,22,23 // -z and +z faces
        ]);
        this.cubeIndexCount = cubeIndexData.length;

        console.log('Cube geometry:', {
            vertices: cubeVertexData.length / 6, // 6 floats per vertex (pos + normal)
            indices: cubeIndexData.length,
            triangles: cubeIndexData.length / 3
        });

        // Use ResourceManager for optimized buffer creation
        this.cubeVertexBuffer = this.renderer.resources.createBuffer('cube_vertices', {
            size: cubeVertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            data: cubeVertexData,
            label: 'Cube Vertex Buffer'
        });

        this.cubeIndexBuffer = this.renderer.resources.createBuffer('cube_indices', {
            size: cubeIndexData.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            data: cubeIndexData,
            label: 'Cube Index Buffer'
        });

        console.log('Created GPU buffers:', {
            vertexBuffer: this.cubeVertexBuffer.label,
            indexBuffer: this.cubeIndexBuffer.label,
            vertexBytes: cubeVertexData.byteLength,
            indexBytes: cubeIndexData.byteLength
        });
        
        // Create entities in the world
        this.addCubeEntity([-3, 0, 0], 'Left Cube');
        this.addCubeEntity([0, 0, -2], 'Center Cube');
        this.addCubeEntity([3, 0, 0], 'Right Cube');

        console.log('Added 3 cube entities to the world');
    }

    addCubeEntity(position: [number, number, number], name?: string) {
        const eid = addEntity(this.world);
        
        // Set up transform component
        addComponent(this.world, Transform, eid);
        Transform.position.x[eid] = position[0];
        Transform.position.y[eid] = position[1];
        Transform.position.z[eid] = position[2];
        
        // Set up rotation
        const rotation = quat.create();
        quat.fromEuler(rotation, 20, 50, 0);
        Transform.rotation.x[eid] = rotation[0];
        Transform.rotation.y[eid] = rotation[1];
        Transform.rotation.z[eid] = rotation[2];
        Transform.rotation.w[eid] = rotation[3];

        // Set up scale
        Transform.scale.x[eid] = 1;
        Transform.scale.y[eid] = 1;
        Transform.scale.z[eid] = 1;

        // Set up mesh component
        addComponent(this.world, Mesh, eid);
        Mesh.vertexBuffer[eid] = 0; // Will be handled by the rendering system
        Mesh.indexBuffer[eid] = 0;  // Will be handled by the rendering system
        Mesh.indexCount[eid] = this.cubeIndexCount;
        Mesh.materialId[eid] = 0;

        // Set up AABB component for BVH
        addComponent(this.world, AABB, eid);
        AABB.min.x[eid] = position[0] - 1;
        AABB.min.y[eid] = position[1] - 1;
        AABB.min.z[eid] = position[2] - 1;
        AABB.max.x[eid] = position[0] + 1;
        AABB.max.y[eid] = position[1] + 1;
        AABB.max.z[eid] = position[2] + 1;

        if (name) {
            console.log(`Created entity ${eid} (${name}) at position [${position.join(', ')}]`);
        }
    }

    private async update() {
        try {
            // --- Logic Pass ---
            TransformSystem(this.world);

            // --- Acceleration Structure Pass ---
            this.bvh.build();
            
            // --- Rendering Passes ---
            
            // 1. Rasterization Pass (G-Buffer generation)
            await RasterRenderSystem(
                this.world, 
                this.renderer, 
                this.gbuffer, 
                this.cubeVertexBuffer, 
                this.cubeIndexBuffer
            );
            
            // 2. Raytracing Pass (compute shader)
            await RaytracingSystem(
                this.world, 
                this.renderer, 
                this.gbuffer, 
                this.bvh, 
                this.raytracingOutput
            );
            
            // 3. Composition Pass (final output)
            await CompositionSystem(
                this.renderer, 
                this.gbuffer, 
                this.raytracingOutput
            );
            
        } catch (error) {
            console.error('Error in update loop:', error);
            // Log current resource state for debugging
            console.log('Resource stats at error:', this.renderer.resources.getResourceStats());
            // Re-throw to stop the update loop on critical errors
            throw error;
        }
        
        requestAnimationFrame(this.update.bind(this));
    }

    /**
     * Clean up demo resources
     */
    destroy(): void {
        console.log('=== Hybrid Demo Cleanup ===');
        console.log('Final resource stats:', this.renderer.resources.getResourceStats());
        
        // The ResourceManager will handle cleanup automatically
        if (this.renderer) {
            this.renderer.destroy();
        }
        
        console.log('Demo cleanup complete');
    }

    /**
     * Get demo statistics for debugging
     */
    getStats(): {
        entities: number;
        resources: {
            buffers: number;
            textures: number;
            bindGroups: number;
            pipelines: number;
            shaderModules: number;
        };
        bvhNodes: number;
    } {
        return {
            entities: Object.keys(this.world).length,
            resources: this.renderer.resources.getResourceStats(),
            bvhNodes: this.bvh.nodes.length
        };
    }
}