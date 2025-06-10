// File: src/raster_only_demo.ts
// Version that only does G-Buffer rasterization, then displays albedo directly

import { addComponent, addEntity, createWorld, IWorld } from "bitecs";
import { quat } from "gl-matrix";
import { AABB, Mesh, Transform } from "./ecs/components.js";
import { TransformSystem } from "./ecs/systems/TransformSystem.js";
import { GBuffer } from './renderer/GBuffer.js';
import { Renderer } from './renderer/Renderer.js';
import { RasterRenderSystem } from './ecs/systems/RasterRenderSystem.js';

export class RasterOnlyDemo {
    renderer!: Renderer;
    world: IWorld;
    gbuffer!: GBuffer;

    // Demo scene resources
    cubeVertexBuffer!: GPUBuffer;
    cubeIndexBuffer!: GPUBuffer;
    cubeIndexCount = 0;
    
    // Display pipeline to show G-Buffer
    displayPipeline!: GPURenderPipeline;
    displayBindGroup!: GPUBindGroup;
    
    private frameCount = 0;

    constructor() {
        this.world = createWorld();
    }

    async startup() {
        console.log("🎯 Starting RasterOnlyDemo...");
        
        const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        if (!canvas) throw new Error('Canvas element with ID "webgpu-canvas" not found.');

        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;
        console.log(`📐 Canvas: ${canvas.width}x${canvas.height}`);

        this.renderer = await Renderer.getInstance(canvas);
        this.gbuffer = new GBuffer(this.renderer);
        
        await this.createScene();
        await this.createDisplayPipeline();
        
        console.log("🎬 Starting raster-only render loop...");
        requestAnimationFrame(this.update.bind(this));
    }

    async createDisplayPipeline() {
        console.log("🖼️ Creating display pipeline to show G-Buffer albedo...");
        
        // Simple shader to display G-Buffer albedo texture
        const shaderCode = `
            @group(0) @binding(0) var tex_sampler: sampler;
            @group(0) @binding(1) var albedo_texture: texture_2d<f32>;
            
            struct VertexOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) uv: vec2<f32>,
            };
            
            @vertex
            fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
                var output: VertexOutput;
                let x = f32((vertex_index << 1u) & 2u) - 1.0;
                let y = f32(vertex_index & 2u) - 1.0;
                output.position = vec4<f32>(x, y, 0.0, 1.0);
                output.uv = vec2<f32>(x * 0.5 + 0.5, y * -0.5 + 0.5);
                return output;
            }
            
            @fragment
            fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
                let albedo = textureSample(albedo_texture, tex_sampler, input.uv);
                // If albedo is empty, show a test pattern
                if (length(albedo.rgb) < 0.01) {
                    let grid = step(vec2<f32>(0.5), fract(input.uv * 10.0));
                    return vec4<f32>(grid.x * grid.y, 0.0, 1.0 - grid.x * grid.y, 1.0);
                }
                return vec4<f32>(albedo.rgb, 1.0);
            }
        `;
        
        const shaderModule = this.renderer.device.createShaderModule({ code: shaderCode });
        
        this.displayPipeline = this.renderer.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: this.renderer.format }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        const sampler = this.renderer.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });

        this.displayBindGroup = this.renderer.device.createBindGroup({
            layout: this.displayPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: this.gbuffer.views.albedo },
            ],
        });
        
        console.log("✅ Display pipeline created");
    }

    async createScene() {
        console.log("🏗️ Creating scene...");
        
        // Same cube geometry as before
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
                console.log(`🎯 Raster-only frame ${this.frameCount}`);
            }

            // Run transform system
            TransformSystem(this.world);

            // Run raster system to populate G-Buffer
            await RasterRenderSystem(this.world, this.renderer, this.gbuffer, this.cubeVertexBuffer, this.cubeIndexBuffer);
            
            // Display the G-Buffer albedo directly to screen
            const commandEncoder = this.renderer.device.createCommandEncoder();
            const passEncoder = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.renderer.context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0.2, g: 0.0, b: 0.2, a: 1.0 }, // Purple background
                }],
            });

            passEncoder.setPipeline(this.displayPipeline);
            passEncoder.setBindGroup(0, this.displayBindGroup);
            passEncoder.draw(3); // Fullscreen triangle
            passEncoder.end();
            this.renderer.device.queue.submit([commandEncoder.finish()]);
            
        } catch (error) {
            console.error("💥 Raster-only error:", error);
            
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
            
            return;
        }
        
        requestAnimationFrame(this.update.bind(this));
    }
}

export default RasterOnlyDemo;