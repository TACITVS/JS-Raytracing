// File: src/simple_gbuffer_test.ts
// Test your actual RasterRenderSystem without texture lifecycle issues

import { addComponent, addEntity, createWorld, IWorld } from "bitecs";
import { quat } from "gl-matrix";
import { AABB, Mesh, Transform } from "./ecs/components.js";
import { TransformSystem } from "./ecs/systems/TransformSystem.js";
import { GBuffer } from './renderer/GBuffer.js';
import { Renderer } from './renderer/Renderer.js';
import { RasterRenderSystem } from './ecs/systems/RasterRenderSystem.js';

export class SimpleGBufferTest {
    renderer!: Renderer;
    world: IWorld;
    gbuffer!: GBuffer;

    // Demo scene resources
    cubeVertexBuffer!: GPUBuffer;
    cubeIndexBuffer!: GPUBuffer;
    cubeIndexCount = 0;
    
    private frameCount = 0;

    constructor() {
        this.world = createWorld();
    }

    async startup() {
        console.log("🧪 Starting SimpleGBufferTest...");
        
        const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        if (!canvas) throw new Error('Canvas element with ID "webgpu-canvas" not found.');

        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;
        console.log(`📐 Canvas: ${canvas.width}x${canvas.height}`);

        this.renderer = await Renderer.getInstance(canvas);
        this.gbuffer = new GBuffer(this.renderer);
        
        await this.createScene();
        
        console.log("🎬 Starting G-Buffer test loop...");
        requestAnimationFrame(this.update.bind(this));
    }

    async createScene() {
        console.log("🏗️ Creating scene...");
        
        // Same cube geometry as your original
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
        
        console.log("✅ Scene created with 3 cube entities");
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
    }

    private async update() {
        try {
            this.frameCount++;
            
            if (this.frameCount % 60 === 0) {
                console.log(`🧪 G-Buffer test frame ${this.frameCount}`);
            }

            // Run transform system
            TransformSystem(this.world);

            // TEST: Run your actual RasterRenderSystem
            console.log("🎯 Testing RasterRenderSystem...");
            await RasterRenderSystem(this.world, this.renderer, this.gbuffer, this.cubeVertexBuffer, this.cubeIndexBuffer);
            console.log("✅ RasterRenderSystem completed");
            
            // Instead of trying to display the G-Buffer, just clear to green to show it's working
            const commandEncoder = this.renderer.device.createCommandEncoder();
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.renderer.context.getCurrentTexture().createView(),
                    clearValue: { r: 0, g: 1, b: 0, a: 1 }, // Bright green = working
                    loadOp: 'clear',
                    storeOp: 'store',
                }],
            });
            renderPass.end();
            this.renderer.device.queue.submit([commandEncoder.finish()]);
            
            if (this.frameCount === 1) {
                console.log("🧪 If you see green background, RasterRenderSystem is working!");
            }
            
        } catch (error) {
            console.error("💥 G-Buffer test error:", error);
            
            // Show error as red screen
            const commandEncoder = this.renderer.device.createCommandEncoder();
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.renderer.context.getCurrentTexture().createView(),
                    clearValue: { r: 1, g: 0, b: 0, a: 1 }, // Red = error
                    loadOp: 'clear',
                    storeOp: 'store'
                }]
            });
            renderPass.end();
            this.renderer.device.queue.submit([commandEncoder.finish()]);
            
            if (this.frameCount === 1) {
                console.log("🧪 Red background = RasterRenderSystem failed!");
            }
            return;
        }
        
        requestAnimationFrame(this.update.bind(this));
    }
}

export default SimpleGBufferTest;