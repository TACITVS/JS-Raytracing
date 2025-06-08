// File: src/ecs/systems/RaytracingSystem.ts
// Tag: RAYTRACING_SYSTEM_COMPLETE_FIX
// Description: Complete file with the corrected shader path to resolve the 404 error.

import { IWorld } from 'bitecs';
import { Renderer } from '../../renderer/Renderer.js';
import { GBuffer } from '../../renderer/GBuffer.js';
import { BVH } from '../../acceleration/BVH.js';

let pipeline: GPUComputePipeline | null = null;

async function getPipeline(renderer: Renderer): Promise<GPUComputePipeline> {
    if (pipeline) return pipeline;

    // **FIXED**: The path now correctly points to the 'dist' directory.
    const res = await fetch('./dist/shaders/raytracing.wgsl');
    if (!res.ok) throw new Error(`Failed to fetch shader: ${res.statusText}`);
    const shaderCode = await res.text();

    const shaderModule = renderer.device.createShaderModule({ code: shaderCode });

    pipeline = await renderer.device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: shaderModule,
            entryPoint: 'main',
        },
    });
    return pipeline;
}

/**
 * The main raytracing system function.
 * @param world The ECS world.
 * @param renderer The main renderer.
 * @param gbuffer The G-Buffer containing the scene's surface data.
 * @param bvh The BVH for ray acceleration.
 * @param outputTexture The texture to write raytracing results to.
 */
export async function RaytracingSystem(
    world: IWorld, 
    renderer: Renderer, 
    gbuffer: GBuffer,
    bvh: BVH,
    outputTexture: GPUTexture
) {
    const computePipeline = await getPipeline(renderer);
    
    const bvhBuffer = renderer.device.createBuffer({
        size: bvh.getFlattenedNodes().byteLength || 16, // Ensure buffer is not zero-sized
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Float32Array(bvhBuffer.getMappedRange()).set(bvh.getFlattenedNodes());
    bvhBuffer.unmap();
    
    const uniformBuffer = renderer.device.createBuffer({
        size: 8 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // TODO: This should be replaced with generic vertex/index buffers.
    // For the demo, we create a small placeholder buffer to satisfy the shader binding.
    const sphereData = new Float32Array(8 * 4); // 4 spheres * (vec3 center, radius, vec3 color, material)
    const sphereBuffer = renderer.device.createBuffer({
        size: sphereData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Float32Array(sphereBuffer.getMappedRange()).set(sphereData);
    sphereBuffer.unmap();


    const bindGroup = renderer.device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: sphereBuffer } },
            { binding: 1, resource: { buffer: uniformBuffer } },
            { binding: 2, resource: outputTexture.createView() },
            { binding: 3, resource: { buffer: bvhBuffer } },
        ],
    });

    const uniformData = new Float32Array([
        0, 1, 5, 0, // camera_pos (TODO: get from camera component)
        renderer.canvas.width, renderer.canvas.height, // screen_dims
        performance.now() / 1000.0, // time
        0, // padding
    ]);
    renderer.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const commandEncoder = renderer.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(
        Math.ceil(renderer.canvas.width / 8), 
        Math.ceil(renderer.canvas.height / 8)
    );
    passEncoder.end();
    renderer.device.queue.submit([commandEncoder.finish()]);

    bvhBuffer.destroy();
    uniformBuffer.destroy();
    sphereBuffer.destroy();
}