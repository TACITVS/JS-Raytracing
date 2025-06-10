// File: src/ecs/systems/RasterRenderSystem.ts
// Path: src/ecs/systems/RasterRenderSystem.ts
// Description: Enhanced raster rendering system using ResourceManager for optimal pipeline and resource management.
// Now uses proper resource caching, better error handling, and follows WebGPU samples patterns.

import { IWorld, defineQuery } from 'bitecs';
import { Renderer } from '../../renderer/Renderer.js';
import { GBuffer, GBUFFER_FORMATS } from '../../renderer/GBuffer.js';
import { Mesh, Transform } from '../components.js';
import { mat4, vec3, quat } from 'gl-matrix';

const renderQuery = defineQuery([Mesh, Transform]);

// Pipeline caching - now managed more efficiently
const pipelineCache: Map<string, GPURenderPipeline> = new Map();

async function getPipeline(renderer: Renderer): Promise<GPURenderPipeline> {
    const key = 'gbuffer';
    if (pipelineCache.has(key)) {
        return pipelineCache.get(key)!;
    }

    console.log('Creating G-Buffer render pipeline...');

    // Enhanced shader loading with better error handling
    const res = await fetch('./dist/shaders/gbuffer.wgsl');
    if (!res.ok) {
        throw new Error(`Failed to fetch shader: gbuffer.wgsl - ${res.statusText}`);
    }
    const shaderCode = await res.text();
    
    // Use ResourceManager for shader module creation
    const shaderModule = await renderer.resources.createShaderModule('gbuffer', shaderCode);

    // Create bind group layouts for scene and model uniforms
    const sceneBindGroupLayout = renderer.device.createBindGroupLayout({
        label: 'Scene Bind Group Layout',
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' }
        }]
    });

    const modelBindGroupLayout = renderer.device.createBindGroupLayout({
        label: 'Model Bind Group Layout', 
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' }
        }]
    });

    // Create pipeline layout
    const pipelineLayout = renderer.device.createPipelineLayout({
        label: 'G-Buffer Pipeline Layout',
        bindGroupLayouts: [sceneBindGroupLayout, modelBindGroupLayout]
    });

    const pipeline = renderer.device.createRenderPipeline({
        label: 'G-Buffer Pipeline',
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 6 * 4, // 3 for pos, 3 for normal
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
                    { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' }, // normal
                ],
            }],
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [
                { format: GBUFFER_FORMATS.position as GPUTextureFormat },
                { format: GBUFFER_FORMATS.normal as GPUTextureFormat },
                { format: GBUFFER_FORMATS.albedo as GPUTextureFormat },
            ],
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

    pipelineCache.set(key, pipeline);
    console.log('G-Buffer pipeline created successfully');
    return pipeline;
}

export async function RasterRenderSystem(
    world: IWorld, 
    renderer: Renderer, 
    gbuffer: GBuffer,
    vertexBuffer: GPUBuffer,
    indexBuffer: GPUBuffer
) {
    const entities = renderQuery(world);
    if (entities.length === 0) {
        console.log('RasterRenderSystem: No entities to render');
        return;
    }

    console.log(`RasterRenderSystem: Rendering ${entities.length} entities`);

    try {
        const pipeline = await getPipeline(renderer);
        
        // Use ResourceManager for uniform buffer creation
        const sceneUniformBuffer = renderer.resources.createUniformBuffer(
            'scene_uniforms_raster',
            80 // 64 bytes for matrix + 16 bytes for camera position
        );
        
        const modelUniformBuffer = renderer.resources.createUniformBuffer(
            'model_uniforms_raster', 
            80 // 64 bytes for matrix + 16 bytes for color
        );
        
        // Create bind groups using the pipeline layouts
        const sceneBindGroup = renderer.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
            label: 'Scene Bind Group'
        });

        const modelBindGroup = renderer.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: modelUniformBuffer } }],
            label: 'Model Bind Group'
        });

        // Set up camera and projection matrices
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, renderer.canvas.width / renderer.canvas.height, 0.1, 100.0);
        
        const viewMatrix = mat4.create();
        const cameraPos = vec3.fromValues(0, 0, 10);
        mat4.lookAt(viewMatrix, cameraPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        
        const viewProjMatrix = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix);
        
        // Update scene uniforms
        renderer.device.queue.writeBuffer(sceneUniformBuffer, 0, viewProjMatrix as Float32Array);
        renderer.device.queue.writeBuffer(sceneUniformBuffer, 64, cameraPos as Float32Array);

        // Create depth texture using ResourceManager
        const depthTexture = renderer.resources.createTexture('depth_buffer_raster', {
            size: [renderer.canvas.width, renderer.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            label: 'Depth Buffer'
        });

        // Begin rendering
        const commandEncoder = renderer.device.createCommandEncoder({
            label: 'Raster Render Command Encoder'
        });

        const renderPassDescriptor = gbuffer.getRenderPassDescriptor();
        renderPassDescriptor.depthStencilAttachment = {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        // REMOVED: passEncoder.setLabel('G-Buffer Render Pass'); - not supported in older types
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, sceneBindGroup);

        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setIndexBuffer(indexBuffer, 'uint16');

        console.log('Rendering entities with G-Buffer pipeline...');

        // Render each entity
        for (let i = 0; i < entities.length; i++) {
            const eid = entities[i];
            
            // Build model matrix from transform
            const rotationQuat = quat.fromValues(
                Transform.rotation.x[eid],
                Transform.rotation.y[eid],
                Transform.rotation.z[eid],
                Transform.rotation.w[eid]
            );
            
            const modelMatrix = mat4.fromRotationTranslationScale(
                mat4.create(),
                rotationQuat,
                [Transform.position.x[eid], Transform.position.y[eid], Transform.position.z[eid]],
                [Transform.scale.x[eid] || 1, Transform.scale.y[eid] || 1, Transform.scale.z[eid] || 1]
            );
            
            // Generate a color based on entity ID for variety
            const hue = (eid * 137.5) % 360; // Golden angle for good distribution
            const color = new Float32Array([
                0.5 + 0.5 * Math.cos((hue * Math.PI) / 180),
                0.5 + 0.5 * Math.cos(((hue + 120) * Math.PI) / 180), 
                0.5 + 0.5 * Math.cos(((hue + 240) * Math.PI) / 180),
                1.0
            ]);

            // Update model uniforms
            renderer.device.queue.writeBuffer(modelUniformBuffer, 0, modelMatrix as Float32Array);
            renderer.device.queue.writeBuffer(modelUniformBuffer, 64, color);
            
            passEncoder.setBindGroup(1, modelBindGroup);
            passEncoder.drawIndexed(Mesh.indexCount[eid]);
        }

        passEncoder.end();
        renderer.device.queue.submit([commandEncoder.finish()]);
        
        console.log(`Successfully rendered ${entities.length} entities to G-Buffer`);

        // Clean up temporary resources (ResourceManager will handle this automatically)
        
    } catch (error) {
        console.error('Error in RasterRenderSystem:', error);
        console.log('Renderer resource stats:', renderer.resources.getResourceStats());
        throw error;
    }
}