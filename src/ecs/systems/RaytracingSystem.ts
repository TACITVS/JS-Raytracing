// File: src/ecs/systems/RaytracingSystem.ts
// FIXED VERSION - Corrected buffer types to match shader expectations
import { IWorld } from 'bitecs';
import { Renderer } from '../../renderer/Renderer.js';
import { GBuffer } from '../../renderer/GBuffer.js';
import { BVH } from '../../acceleration/BVH.js';

let pipeline: GPUComputePipeline | null = null;
let bindGroupLayout: GPUBindGroupLayout | null = null;

// Optimal workgroup size for compute shaders (from WebGPU samples)
const WORKGROUP_SIZE = 8;

async function getPipeline(renderer: Renderer): Promise<{ pipeline: GPUComputePipeline; layout: GPUBindGroupLayout }> {
    if (pipeline && bindGroupLayout) {
        return { pipeline, layout: bindGroupLayout };
    }

    console.log('Creating raytracing compute pipeline...');

    // Load the enhanced raytracing shader
    const res = await fetch('./dist/shaders/raytracing.wgsl');
    if (!res.ok) {
        throw new Error(`Failed to fetch shader: raytracing.wgsl - ${res.statusText}`);
    }
    const shaderCode = await res.text();

    // Create optimized shader module using ResourceManager
    const shaderModule = await renderer.resources.createShaderModule('raytracing', shaderCode);

    // FIXED: Create bind group layout with correct buffer types to match shader
    bindGroupLayout = renderer.device.createBindGroupLayout({
        label: 'Raytracing Bind Group Layout',
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { 
                    type: 'read-only-storage',  // FIXED: was 'storage'
                    hasDynamicOffset: false 
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'uniform' }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: 'write-only',
                    format: 'rgba8unorm',
                    viewDimension: '2d'
                }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { 
                    type: 'read-only-storage',  // FIXED: was 'storage'
                    hasDynamicOffset: false 
                }
            }
        ]
    });

    // Create pipeline layout
    const pipelineLayout = renderer.device.createPipelineLayout({
        label: 'Raytracing Pipeline Layout',
        bindGroupLayouts: [bindGroupLayout]
    });

    pipeline = await renderer.device.createComputePipelineAsync({
        label: 'Raytracing Compute Pipeline',
        layout: pipelineLayout,
        compute: {
            module: shaderModule,
            entryPoint: 'main',
        },
    });

    console.log('Raytracing pipeline created successfully');
    return { pipeline, layout: bindGroupLayout };
}

/**
 * Enhanced raytracing system with proper resource management and BVH acceleration
 */
export async function RaytracingSystem(
    world: IWorld, 
    renderer: Renderer, 
    gbuffer: GBuffer,
    bvh: BVH,
    outputTexture: GPUTexture
) {
    console.log('RaytracingSystem: Starting compute pass');

    try {
        const { pipeline: computePipeline, layout } = await getPipeline(renderer);
        
        // Create BVH buffer using ResourceManager
        const bvhData = bvh.getFlattenedNodes();
        const bvhBuffer = renderer.resources.createStorageBuffer(
            'bvh_data',
            bvhData.byteLength > 0 ? bvhData : new Float32Array(4), // Ensure non-zero size
            true  // FIXED: Set to true for read-only access
        );
        
        // Create uniform buffer for camera and scene data using ResourceManager
        const uniformBuffer = renderer.resources.createUniformBuffer('raytracing_uniforms', 64);

        // Create sphere data buffer (placeholder for geometry)
        const sphereData = new Float32Array([
            // Sphere 1: center (x,y,z), radius, color (r,g,b), material
            -3, 0, 0, 0.8,  0.8, 0.3, 0.3, 1,  // Red sphere at left cube position
            0, 0, -2, 0.8,  0.3, 0.8, 0.3, 1,  // Green sphere at center cube position  
            3, 0, 0, 0.8,   0.3, 0.3, 0.8, 1,  // Blue sphere at right cube position
            0, -100.5, -1, 100, 0.5, 0.5, 0.5, 0, // Ground plane
        ]);
        
        const sphereBuffer = renderer.resources.createStorageBuffer(
            'sphere_data',
            sphereData,
            true  // FIXED: Set to true for read-only access
        );

        console.log('Created raytracing buffers:', {
            bvhSize: bvhData.byteLength,
            sphereSize: sphereData.byteLength,
            uniformSize: 64,
            outputSize: `${outputTexture.width}x${outputTexture.height}`
        });

        // Create bind group with all resources
        const bindGroup = renderer.device.createBindGroup({
            layout,
            entries: [
                { binding: 0, resource: { buffer: sphereBuffer } },
                { binding: 1, resource: { buffer: uniformBuffer } },
                { binding: 2, resource: outputTexture.createView() },
                { binding: 3, resource: { buffer: bvhBuffer } },
            ],
            label: 'Raytracing Bind Group'
        });

        // Prepare uniform data (camera position, screen dimensions, time)
        const uniformData = new Float32Array([
            0, 1, 5, 0,                                    // camera_pos (vec4)
            renderer.canvas.width, renderer.canvas.height, // screen_dims (vec2)
            performance.now() / 1000.0,                    // time (f32)
            0,                                             // padding
        ]);
        
        // Update uniforms
        renderer.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

        console.log('Uniform data:', {
            cameraPos: [uniformData[0], uniformData[1], uniformData[2]],
            screenDims: [uniformData[4], uniformData[5]],
            time: uniformData[6]
        });

        // Execute compute pass
        const commandEncoder = renderer.device.createCommandEncoder({
            label: 'Raytracing Command Encoder'
        });

        const passEncoder = commandEncoder.beginComputePass({
            label: 'Raytracing Compute Pass'
        });

        passEncoder.setPipeline(computePipeline);
        passEncoder.setBindGroup(0, bindGroup);
        
        // Calculate optimal workgroup dispatch
        const workgroupsX = Math.ceil(renderer.canvas.width / WORKGROUP_SIZE);
        const workgroupsY = Math.ceil(renderer.canvas.height / WORKGROUP_SIZE);
        
        console.log('Dispatching compute workgroups:', {
            workgroupSize: WORKGROUP_SIZE,
            dispatchX: workgroupsX,
            dispatchY: workgroupsY,
            totalWorkgroups: workgroupsX * workgroupsY,
            totalThreads: workgroupsX * workgroupsY * WORKGROUP_SIZE * WORKGROUP_SIZE
        });

        passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY);
        passEncoder.end();
        
        renderer.device.queue.submit([commandEncoder.finish()]);
        
        console.log('RaytracingSystem: Compute pass completed successfully');

    } catch (error) {
        console.error('Error in RaytracingSystem:', error);
        console.log('Renderer capabilities:', renderer.capabilities);
        console.log('Resource stats:', renderer.resources.getResourceStats());
        console.log('Canvas size:', { width: renderer.canvas.width, height: renderer.canvas.height });
        console.log('BVH nodes:', bvh.nodes.length);
        throw error;
    }
}

/**
 * Get raytracing system statistics for debugging
 */
export function getRaytracingStats(): {
    pipelineCreated: boolean;
    workgroupSize: number;
} {
    return {
        pipelineCreated: pipeline !== null,
        workgroupSize: WORKGROUP_SIZE
    };
}