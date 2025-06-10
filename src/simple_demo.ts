// File: src/simple_demo.ts
// Bypasses the complex G-Buffer pipeline and renders directly to screen

import { addComponent, addEntity, createWorld, IWorld } from "bitecs";
import { quat, mat4, vec3 } from "gl-matrix";
import { Mesh, Transform } from "./ecs/components.js";
import { Renderer } from './renderer/Renderer.js';

export class SimpleDemo {
    renderer!: Renderer;
    world: IWorld;
    pipeline!: GPURenderPipeline;
    
    // Scene resources
    vertexBuffer!: GPUBuffer;
    indexBuffer!: GPUBuffer;
    indexCount = 0;
    
    // Uniform buffers
    sceneUniformBuffer!: GPUBuffer;
    modelUniformBuffer!: GPUBuffer;
    
    // Bind groups
    sceneBindGroup!: GPUBindGroup;
    modelBindGroup!: GPUBindGroup;

    constructor() {
        this.world = createWorld();
    }

    async startup() {
        console.log("🚀 Starting SimpleDemo (direct rendering)...");
        
        const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        if (!canvas) throw new Error('Canvas element with ID "webgpu-canvas" not found.');

        // Set up canvas dimensions
        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;
        console.log(`📐 Canvas size: ${canvas.width}x${canvas.height}`);

        // Initialize renderer
        this.renderer = await Renderer.getInstance(canvas);
        
        // Create rendering pipeline
        await this.createPipeline();
        
        // Create scene geometry
        await this.createScene();
        
        // Create uniform buffers
        this.createUniforms();
        
        console.log("🎬 Starting render loop...");
        requestAnimationFrame(this.update.bind(this));
    }

    async createPipeline() {
        console.log("🔧 Creating direct render pipeline...");
        
        // Simple shader that renders directly to screen
        const shaderCode = `
            struct SceneUniforms {
                view_proj_matrix: mat4x4<f32>,
                camera_pos: vec3<f32>,
            };

            struct ModelUniforms {
                model_matrix: mat4x4<f32>,
                color: vec4<f32>,
            };

            @group(0) @binding(0) var<uniform> scene: SceneUniforms;
            @group(1) @binding(0) var<uniform> model: ModelUniforms;

            struct VertexOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) world_pos: vec3<f32>,
                @location(1) normal: vec3<f32>,
            };

            @vertex
            fn vs_main(
                @location(0) pos: vec3<f32>,
                @location(1) normal: vec3<f32>
            ) -> VertexOutput {
                var output: VertexOutput;
                let world_pos = model.model_matrix * vec4<f32>(pos, 1.0);
                output.world_pos = world_pos.xyz;
                output.position = scene.view_proj_matrix * world_pos;
                output.normal = (model.model_matrix * vec4<f32>(normal, 0.0)).xyz;
                return output;
            }

            @fragment
            fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
                let normal = normalize(in.normal);
                let light_dir = normalize(vec3<f32>(0.5, 1.0, -0.5));
                let diffuse = max(dot(normal, light_dir), 0.0);
                let ambient = 0.2;
                let lighting = ambient + diffuse * 0.8;
                return vec4<f32>(model.color.rgb * lighting, 1.0);
            }
        `;

        const shaderModule = this.renderer.device.createShaderModule({ code: shaderCode });

        this.pipeline = this.renderer.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 6 * 4, // 3 for pos, 3 for normal
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // pos
                        { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' }, // normal
                    ],
                }],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: this.renderer.format }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });

        console.log("✅ Pipeline created");
    }

    async createScene() {
        console.log("🏗️ Creating scene geometry...");
        
        // Create a simple cube
        const cubeVertexData = new Float32Array([
            // Front face
            -1, -1,  1,  0,  0,  1,
             1, -1,  1,  0,  0,  1,
             1,  1,  1,  0,  0,  1,
            -1,  1,  1,  0,  0,  1,
            
            // Back face
            -1, -1, -1,  0,  0, -1,
            -1,  1, -1,  0,  0, -1,
             1,  1, -1,  0,  0, -1,
             1, -1, -1,  0,  0, -1,
            
            // Top face
            -1,  1, -1,  0,  1,  0,
            -1,  1,  1,  0,  1,  0,
             1,  1,  1,  0,  1,  0,
             1,  1, -1,  0,  1,  0,
            
            // Bottom face
            -1, -1, -1,  0, -1,  0,
             1, -1, -1,  0, -1,  0,
             1, -1,  1,  0, -1,  0,
            -1, -1,  1,  0, -1,  0,
            
            // Right face
             1, -1, -1,  1,  0,  0,
             1,  1, -1,  1,  0,  0,
             1,  1,  1,  1,  0,  0,
             1, -1,  1,  1,  0,  0,
            
            // Left face
            -1, -1, -1, -1,  0,  0,
            -1, -1,  1, -1,  0,  0,
            -1,  1,  1, -1,  0,  0,
            -1,  1, -1, -1,  0,  0,
        ]);

        const cubeIndexData = new Uint16Array([
            0,  1,  2,    0,  2,  3,    // front
            4,  5,  6,    4,  6,  7,    // back
            8,  9,  10,   8,  10, 11,   // top
            12, 13, 14,   12, 14, 15,   // bottom
            16, 17, 18,   16, 18, 19,   // right
            20, 21, 22,   20, 22, 23,   // left
        ]);

        this.indexCount = cubeIndexData.length;

        this.vertexBuffer = this.renderer.device.createBuffer({
            size: cubeVertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(cubeVertexData);
        this.vertexBuffer.unmap();

        this.indexBuffer = this.renderer.device.createBuffer({
            size: cubeIndexData.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Uint16Array(this.indexBuffer.getMappedRange()).set(cubeIndexData);
        this.indexBuffer.unmap();

        // Create entities
        this.addCubeEntity([0, 0, -5], [1, 0, 0, 1]); // Red cube at center
        this.addCubeEntity([-3, 0, -5], [0, 1, 0, 1]); // Green cube on left
        this.addCubeEntity([3, 0, -5], [0, 0, 1, 1]); // Blue cube on right

        console.log(`✅ Scene created with ${this.indexCount} indices`);
    }

    addCubeEntity(position: [number, number, number], color: [number, number, number, number]) {
        const eid = addEntity(this.world);
        
        addComponent(this.world, Transform, eid);
        Transform.position.x[eid] = position[0];
        Transform.position.y[eid] = position[1];
        Transform.position.z[eid] = position[2];
        
        // No rotation for simplicity
        Transform.rotation.x[eid] = 0;
        Transform.rotation.y[eid] = 0;
        Transform.rotation.z[eid] = 0;
        Transform.rotation.w[eid] = 1;
        
        Transform.scale.x[eid] = 1;
        Transform.scale.y[eid] = 1;
        Transform.scale.z[eid] = 1;

        addComponent(this.world, Mesh, eid);
        // Store color in the mesh component (abuse the system a bit)
        Mesh.vertexBuffer[eid] = Math.round(color[0] * 255);
        Mesh.indexBuffer[eid] = Math.round(color[1] * 255);
        Mesh.materialId[eid] = Math.round(color[2] * 255);
        Mesh.indexCount[eid] = Math.round(color[3] * 255);
    }

    createUniforms() {
        console.log("🔧 Creating uniform buffers...");
        
        this.sceneUniformBuffer = this.renderer.device.createBuffer({
            size: 16 * 4 + 4 * 4, // mat4 + vec3 + padding
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        this.modelUniformBuffer = this.renderer.device.createBuffer({
            size: 16 * 4 + 4 * 4, // mat4 + vec4
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.sceneBindGroup = this.renderer.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.sceneUniformBuffer } }],
        });

        this.modelBindGroup = this.renderer.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.modelUniformBuffer } }],
        });

        console.log("✅ Uniforms created");
    }

    private frameCount = 0;

    private update = () => {
        this.frameCount++;
        
        try {
            // Set up camera and view matrices
            const aspectRatio = this.renderer.canvas.width / this.renderer.canvas.height;
            const projectionMatrix = mat4.create();
            mat4.perspective(projectionMatrix, Math.PI / 4, aspectRatio, 0.1, 100.0);
            
            const viewMatrix = mat4.create();
            const time = performance.now() / 1000;
            const cameraPos = vec3.fromValues(
                Math.sin(time * 0.5) * 8, 
                3, 
                Math.cos(time * 0.5) * 8
            );
            mat4.lookAt(viewMatrix, cameraPos, vec3.fromValues(0, 0, -5), vec3.fromValues(0, 1, 0));
            
            const viewProjMatrix = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix);
            
            // Update scene uniforms
            const sceneData = new Float32Array(20);
            sceneData.set(viewProjMatrix as Float32Array, 0);
            sceneData.set(cameraPos as Float32Array, 16);
            this.renderer.device.queue.writeBuffer(this.sceneUniformBuffer, 0, sceneData);

            // Create depth texture
            const depthTexture = this.renderer.device.createTexture({
                size: [this.renderer.canvas.width, this.renderer.canvas.height],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            // Begin rendering
            const commandEncoder = this.renderer.device.createCommandEncoder();
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.renderer.context.getCurrentTexture().createView(),
                    clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }],
                depthStencilAttachment: {
                    view: depthTexture.createView(),
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                },
            });

            renderPass.setPipeline(this.pipeline);
            renderPass.setVertexBuffer(0, this.vertexBuffer);
            renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
            renderPass.setBindGroup(0, this.sceneBindGroup);

            // Render each entity
            const cubeData = [
                { position: vec3.fromValues(0, 0, -5), color: [1, 0, 0, 1] },   // Red center
                { position: vec3.fromValues(-3, 0, -5), color: [0, 1, 0, 1] },  // Green left
                { position: vec3.fromValues(3, 0, -5), color: [0, 0, 1, 1] }    // Blue right
            ];
            
            cubeData.forEach((cube, index) => {
                // Create model matrix
                const modelMatrix = mat4.create();
                
                // Add some rotation
                const rotation = quat.create();
                quat.fromEuler(rotation, time * 20 * (index + 1), time * 30 * (index + 1), 0);
                mat4.fromRotationTranslationScale(
                    modelMatrix,
                    rotation,
                    cube.position,
                    vec3.fromValues(1, 1, 1)
                );

                // Update model uniforms
                const modelData = new Float32Array(20);
                modelData.set(modelMatrix as Float32Array, 0);
                modelData.set(cube.color, 16);
                this.renderer.device.queue.writeBuffer(this.modelUniformBuffer, 0, modelData);
                
                renderPass.setBindGroup(1, this.modelBindGroup);
                renderPass.drawIndexed(this.indexCount);
            });

            renderPass.end();
            this.renderer.device.queue.submit([commandEncoder.finish()]);
            
            // Clean up
            depthTexture.destroy();

            if (this.frameCount % 60 === 0) {
                console.log(`✅ Frame ${this.frameCount} rendered successfully`);
            }

        } catch (error) {
            console.error("💥 Render error:", error);
            
            // Fallback: clear to red
            const commandEncoder = this.renderer.device.createCommandEncoder();
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.renderer.context.getCurrentTexture().createView(),
                    clearValue: { r: 1, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }],
            });
            renderPass.end();
            this.renderer.device.queue.submit([commandEncoder.finish()]);
        }
        
        requestAnimationFrame(this.update);
    };
}

export default SimpleDemo;