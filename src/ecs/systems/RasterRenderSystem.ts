// File: src/ecs/systems/RasterRenderSystem.ts
// Tag: RASTER_RENDER_SYSTEM_FETCH_FIX
// Description: Corrects a runtime error by properly handling the fetch promise to check
// the response status before attempting to read the shader text.

import { IWorld, defineQuery } from 'bitecs';
import { Renderer } from '../../renderer/Renderer.js';
import { GBuffer, GBUFFER_FORMATS } from '../../renderer/GBuffer.js';
import { Mesh, Transform } from '../components.js';
import { mat4, vec3, quat } from 'gl-matrix';

const renderQuery = defineQuery([Mesh, Transform]);

const pipelineCache: Map<string, GPURenderPipeline> = new Map();

async function getPipeline(renderer: Renderer): Promise<GPURenderPipeline> {
    const key = 'gbuffer';
    if (pipelineCache.has(key)) {
        return pipelineCache.get(key)!;
    }

    // **FIXED**: Changed to a two-step await to correctly check the response.
    const res = await fetch('./dist/shaders/gbuffer.wgsl');
    if (!res.ok) throw new Error(`Failed to fetch shader: gbuffer.wgsl - ${res.statusText}`);
    const shaderCode = await res.text();
    
    const shaderModule = renderer.device.createShaderModule({ code: shaderCode });

    const pipeline = renderer.device.createRenderPipeline({
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
    if (entities.length === 0) return;

    const pipeline = await getPipeline(renderer);
    
    const sceneUniformBuffer = renderer.device.createBuffer({
        size: 16 * 4 + 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    const modelUniformBuffer = renderer.device.createBuffer({
        size: 16 * 4 + 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    const sceneBindGroup = renderer.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
    });

    const modelBindGroup = renderer.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: { buffer: modelUniformBuffer } }],
    });

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, renderer.canvas.width / renderer.canvas.height, 0.1, 100.0);
    const viewMatrix = mat4.create();
    const cameraPos = vec3.fromValues(0, 0, 10);
    mat4.lookAt(viewMatrix, cameraPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    const viewProjMatrix = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix);
    
    renderer.device.queue.writeBuffer(sceneUniformBuffer, 0, viewProjMatrix as Float32Array);
    renderer.device.queue.writeBuffer(sceneUniformBuffer, 64, cameraPos as Float32Array);

    const commandEncoder = renderer.device.createCommandEncoder();

    const depthTexture = renderer.device.createTexture({
        size: [renderer.canvas.width, renderer.canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const renderPassDescriptor = gbuffer.getRenderPassDescriptor();
    renderPassDescriptor.depthStencilAttachment = {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, sceneBindGroup);

    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setIndexBuffer(indexBuffer, 'uint16');

    for (const eid of entities) {
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
        
        // This should come from a material component in a real implementation
        const color = new Float32Array([1.0, 0.5, 0.2, 1.0]); 

        renderer.device.queue.writeBuffer(modelUniformBuffer, 0, modelMatrix as Float32Array);
        renderer.device.queue.writeBuffer(modelUniformBuffer, 64, color);
        
        passEncoder.setBindGroup(1, modelBindGroup);
        passEncoder.drawIndexed(Mesh.indexCount[eid]);
    }

    passEncoder.end();
    renderer.device.queue.submit([commandEncoder.finish()]);
    
    depthTexture.destroy();
    sceneUniformBuffer.destroy();
    modelUniformBuffer.destroy();
}