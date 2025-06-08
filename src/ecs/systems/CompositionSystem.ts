// File: src/ecs/systems/CompositionSystem.ts
// Tag: COMPOSITION_SYSTEM_BINDING_FIX
// Description: Corrects the WebGPU binding error by removing the unused texture
// from the bind group to match the updated shader.

import { Renderer } from '../../renderer/Renderer.js';
import { GBuffer } from '../../renderer/GBuffer.js';

let pipeline: GPURenderPipeline | null = null;
let sampler: GPUSampler | null = null;

async function getPipeline(renderer: Renderer): Promise<GPURenderPipeline> {
    if (pipeline) return pipeline;

    const res = await fetch('./dist/shaders/composition.wgsl');
    if (!res.ok) throw new Error(`Failed to fetch shader: composition.wgsl - ${res.statusText}`);
    const shaderCode = await res.text();
    
    const shaderModule = renderer.device.createShaderModule({ code: shaderCode });

    pipeline = await renderer.device.createRenderPipelineAsync({
        layout: 'auto',
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{ format: renderer.format }],
        },
        primitive: {
            topology: 'triangle-list',
        },
    });
    return pipeline;
}

function getSampler(renderer: Renderer): GPUSampler {
    if (sampler) return sampler;
    sampler = renderer.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });
    return sampler;
}

/**
 * The main composition system function.
 * @param renderer The main renderer.
 * @param gbuffer The G-Buffer containing the scene's surface data.
 * @param raytracingOutput The texture containing the raytraced effects.
 */
export async function CompositionSystem(
    renderer: Renderer,
    gbuffer: GBuffer,
    raytracingOutput: GPUTexture
) {
    const compositionPipeline = await getPipeline(renderer);
    const screenSampler = getSampler(renderer);

    // **FIXED**: Removed the gbuffer.views.position entry and re-numbered the bindings
    // to match the updated shader, resolving the mismatch.
    const bindGroup = renderer.device.createBindGroup({
        layout: compositionPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: gbuffer.views.normal },
            { binding: 1, resource: gbuffer.views.albedo },
            { binding: 2, resource: raytracingOutput.createView() },
            { binding: 3, resource: screenSampler },
        ],
    });

    const commandEncoder = renderer.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: renderer.context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        }],
    });

    passEncoder.setPipeline(compositionPipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(3); 
    passEncoder.end();
    renderer.device.queue.submit([commandEncoder.finish()]);
}