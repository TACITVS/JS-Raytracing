// File: src/debug_hybrid_demo.ts
// Version of HybridDemo that shows individual render targets for debugging

import { addComponent, addEntity, createWorld, IWorld } from "bitecs";
import { quat } from "gl-matrix";
import { AABB, Mesh, Transform } from "./ecs/components.js";
import { TransformSystem } from "./ecs/systems/TransformSystem.js";
import { BVH } from './acceleration/BVH.js';
import { GBuffer } from './renderer/GBuffer.js';
import { Renderer } from './renderer/Renderer.js';
import { RasterRenderSystem } from './ecs/systems/RasterRenderSystem.js';
import { RaytracingSystem } from './ecs/systems/RaytracingSystem.js';
import { DebugCompositionSystem } from './ecs/systems/DebugCompositionSystem.js';

export class DebugHybridDemo {
    renderer!: Renderer;
    world: IWorld;
    gbuffer!: GBuffer;
    bvh!: BVH;
    raytracingOutput!: GPUTexture;

    // Demo scene resources
    cubeVertexBuffer!: GPUBuffer;
    cubeIndexBuffer!: GPUBuffer;
    cubeIndexCount = 0;
    
    // Debug state
    private bvhNeedsRebuild = true;
    private frameCount = 0;
    private debugMode = 0; // 0=albedo, 1=normal, 2=position, 3=raytracing
    private lastModeChange = 0;

    constructor() {
        this.world = createWorld();
    }

    async startup() {
        console.log("🔍 Starting DebugHybridDemo...");
        
        const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        if (!canvas) throw new Error('Canvas element with ID "webgpu-canvas" not found.');

        // Set up canvas dimensions
        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;
        console.log(`📐 Canvas size: ${canvas.width}x${canvas.height}`);

        this.renderer = await Renderer.getInstance(canvas);
        this.gbuffer = new GBuffer(this.renderer);
        this.bvh = new BVH(this.world);
        
        this.raytracingOutput = this.renderer.device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
        });
        
        await this.createScene();
        
        // Add click handler to cycle debug modes
        canvas.addEventListener('click', () => {
            this.debugMode = (this.debugMode + 1) % 4;
            console.log(`🔍 Switched to debug mode ${this.debugMode}: ${this.getDebugModeName()}`);
        });
        
        console.log("🔍 Debug controls: Click canvas to cycle through render targets");
        console.log(`🔍 Starting with mode ${this.debugMode}: ${this.getDebugModeName()}`);
        
        requestAnimationFrame(this.update.bind(this));
    }

    getDebugModeName(): string {
        const names = ['G-Buffer Albedo', 'G-Buffer Normals', 'G-Buffer Position', 'Raytracing Output'];
        return names[this.debugMode] || 'Unknown';
    }

    async createScene() {
        // Create cube geometry (same as before)
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
        
        // Add entities positioned clearly in view
        this.addCubeEntity([0, 0, -8], "center");
        this.addCubeEntity([-4, 0, -8], "left");  
        this.addCubeEntity([4, 0, -8], "right");
        
        console.log("✅ Debug scene created with 3 cube entities");
    }

    addCubeEntity(position: [number, number, number], name: string) {
        const eid = addEntity(this.world);
        console.log(`➕ Adding ${name} cube at [${position.join(', ')}]`);
        
        addComponent(this.world, Transform, eid);
        Transform.position.x[eid] = position[0];
        Transform.position.y[eid] = position[1];
        Transform.position.z[eid] = position[2];
        
        const rotation = quat.create();
        quat.fromEuler(rotation, 0, 0, 0);
        Transform.rotation.x[eid] = rotation[0];
        Transform.rotation.y[eid] = rotation[1];
        Transform.rotation.z[eid] = rotation[2];
        Transform.rotation.w[eid] = rotation[3];
        
        Transform.scale.x[eid] = 1;
        Transform.scale.y[eid] = 1;
        Transform.scale.z[eid] = 1;

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
        
        this.bvhNeedsRebuild = true;
    }

    private async update() {
        try {
            this.frameCount++;
            
            // Auto-cycle debug modes every 3 seconds for demo
            const now = performance.now();
            if (now - this.lastModeChange > 3000) {
                this.debugMode = (this.debugMode + 1) % 4;
                this.lastModeChange = now;
                console.log(`🔍 Auto-switched to mode ${this.debugMode}: ${this.getDebugModeName()}`);
            }
            
            // Show debug info periodically
            if (this.frameCount % 180 === 0) { // Every 3 seconds at 60fps
                console.log(`🔍 Frame ${this.frameCount}, showing: ${this.getDebugModeName()}`);
                console.log(`🔍 Click canvas to manually cycle debug modes`);
            }

            // --- Logic Pass ---
            TransformSystem(this.world);

            // --- Acceleration Structure Pass ---
            if (this.bvhNeedsRebuild) {
                console.log("🌳 Rebuilding BVH...");
                this.bvh.build();
                this.bvhNeedsRebuild = false;
            }
            
            // --- Rendering Passes ---
            
            // 1. Raster Pass (always run to populate G-Buffer)
            await RasterRenderSystem(this.world, this.renderer, this.gbuffer, this.cubeVertexBuffer, this.cubeIndexBuffer);
            
            // 2. Raytracing Pass (always run to populate raytracing output)
            await RaytracingSystem(this.world, this.renderer, this.gbuffer, this.bvh, this.raytracingOutput);
            
            // 3. Debug Composition Pass (show selected render target)
            await DebugCompositionSystem(this.renderer, this.gbuffer, this.raytracingOutput, this.debugMode);
            
        } catch (error) {
            console.error("💥 Error in debug render loop:", error);
            
            // Show error as red screen
            const commandEncoder = this.renderer.device.createCommandEncoder();
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.renderer.context.getCurrentTexture().createView(),
                    clearValue: { r: 1, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }]
            });
            renderPass.end();
            this.renderer.device.queue.submit([commandEncoder.finish()]);
            
            return; // Stop render loop on error
        }
        
        requestAnimationFrame(this.update.bind(this));
    }
}

export default DebugHybridDemo;