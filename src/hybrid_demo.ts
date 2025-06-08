// File: src/hybrid_demo.ts
// Tag: HYBRID_DEMO_SCRIPT_FINAL
// Description: Final version of the demo script with the RasterRenderSystem enabled
// and correctly wired up to draw the scene geometry.

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

    // Demo scene resources
    cubeVertexBuffer!: GPUBuffer;
    cubeIndexBuffer!: GPUBuffer;
    cubeIndexCount = 0;

    constructor() {
        this.world = createWorld();
    }

    async startup() {
        const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        if (!canvas) throw new Error('Canvas element with ID "webgpu-canvas" not found.');

        this.renderer = await Renderer.getInstance(canvas);
        this.gbuffer = new GBuffer(this.renderer);
        this.bvh = new BVH(this.world);
        
        this.raytracingOutput = this.renderer.device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
        });
        
        await this.createScene();
        
        requestAnimationFrame(this.update.bind(this));
    }

    async createScene() {
        // Create cube geometry
        const cubeVertexData = new Float32Array([
            //-x
            -1,-1,-1, -1,0,0,  -1,-1,1,  -1,0,0,  -1,1,1,  -1,0,0,  -1,1,-1,  -1,0,0,
            //+x
            1,1,-1,  1,0,0,  1,1,1,  1,0,0,  1,-1,1,  1,0,0,  1,-1,-1,  1,0,0,
            //-y
            -1,-1,-1, 0,-1,0,  1,-1,-1, 0,-1,0,  1,-1,1,  0,-1,0,  -1,-1,1,  0,-1,0,
            //+y
            -1,1,1,  0,1,0,  1,1,1,  0,1,0,  1,1,-1,  0,1,0,  -1,1,-1,  0,1,0,
            //-z
            1,-1,-1,  0,0,-1, -1,-1,-1,  0,0,-1,  -1,1,-1,  0,0,-1,  1,1,-1,  0,0,-1,
            //+z
            -1,1,1,  0,0,1,  1,1,1,  0,0,1,  1,-1,1,  0,0,1,  -1,-1,1,  0,0,1,
        ]);
        const cubeIndexData = new Uint16Array([
            0,1,2, 0,2,3,    4,5,6, 4,6,7,
            8,9,10, 8,10,11, 12,13,14, 12,14,15,
            16,17,18, 16,18,19, 20,21,22, 20,22,23
        ]);
        this.cubeIndexCount = cubeIndexData.length;

        this.cubeVertexBuffer = this.renderer.device.createBuffer({
            size: cubeVertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.cubeVertexBuffer.getMappedRange()).set(cubeVertexData);
        this.cubeVertexBuffer.unmap();

        this.cubeIndexBuffer = this.renderer.device.createBuffer({
            size: cubeIndexData.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Uint16Array(this.cubeIndexBuffer.getMappedRange()).set(cubeIndexData);
        this.cubeIndexBuffer.unmap();
        
        // Add a few entities to the world
        this.addCubeEntity([-3, 0, 0]);
        this.addCubeEntity([0, 0, -2]);
        this.addCubeEntity([3, 0, 0]);
    }

    addCubeEntity(position: [number, number, number]) {
        const eid = addEntity(this.world);
        
        addComponent(this.world, Transform, eid);
        Transform.position.x[eid] = position[0];
        Transform.position.y[eid] = position[1];
        Transform.position.z[eid] = position[2];
        
        const rotation = quat.create();
        quat.fromEuler(rotation, 20, 50, 0);
        Transform.rotation.x[eid] = rotation[0];
        Transform.rotation.y[eid] = rotation[1];
        Transform.rotation.z[eid] = rotation[2];
        Transform.rotation.w[eid] = rotation[3];

        addComponent(this.world, Mesh, eid);
        Mesh.vertexBuffer[eid] = 0;
        Mesh.indexBuffer[eid] = 0;
        Mesh.indexCount[eid] = this.cubeIndexCount;
        Mesh.materialId[eid] = 0;

        addComponent(this.world, AABB, eid);
        AABB.min.x[eid] = position[0] - 1;
        AABB.min.y[eid] = position[1] - 1;
        AABB.min.z[eid] = position[2] - 1;
        AABB.max.x[eid] = position[0] + 1;
        AABB.max.y[eid] = position[1] + 1;
        AABB.max.z[eid] = position[2] + 1;
    }

    private async update() {
        // --- Logic Pass ---
        TransformSystem(this.world);

        // --- Acceleration Structure Pass ---
        this.bvh.build();
        
        // --- Rendering Passes ---
        
        // **FIXED**: The RasterRenderSystem is now called and awaited.
        // It's passed the vertex and index buffers it needs to draw the scene.
        await RasterRenderSystem(this.world, this.renderer, this.gbuffer, this.cubeVertexBuffer, this.cubeIndexBuffer);
        
        // 2. Raytracing Pass
        await RaytracingSystem(this.world, this.renderer, this.gbuffer, this.bvh, this.raytracingOutput);
        
        // 3. Composition Pass
        await CompositionSystem(this.renderer, this.gbuffer, this.raytracingOutput);
        
        requestAnimationFrame(this.update.bind(this));
    }
}