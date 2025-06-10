// File: src/ecs/systems/DebugCompositionSystem.ts
// Debug version that shows individual render targets

import { Renderer } from '../../renderer/Renderer.js';
import { GBuffer } from '../../renderer/GBuffer.js';

let pipeline: GPURenderPipeline | null = null;
let sampler: GPUSampler | null = null;

async function getPipeline(renderer: Renderer): Promise<GPURenderPipeline> {
    if (pipeline) return pipeline;

    // Debug shader that can show different render targets
    const shaderCode = `
        @group(0) @binding(0) var debug_texture: texture_2d<f32>;
        @group(0) @binding(1) var debug_sampler: sampler;
        @group(0) @binding(2) var<uniform> debug_mode: u32;

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) tex_coord: vec2<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> VertexOutput {
            var output: VertexOutput;
            let x = f32(in_vertex_index % 2u) * 2.0;
            let y = f32(in_vertex_index / 2u) * 2.0;
            output.position = vec4<f32>(x - 1.0, 1.0 - y, 0.0, 1.0);
            output.tex_coord = vec2<f32>(x * 0.5, y * 0.5);
            return output;
        }

        @fragment
        fn fs_main(@location(0) tex_coord: vec2<f32>) -> @location(0) vec4<f32> {
            let sampled = textureSample(debug_texture, debug_sampler, tex_coord);
            
            // Different debug modes
            switch (debug_mode) {
                case 0u: { // Show raw texture
                    return vec4<f32>(sampled.rgb, 1.0);
                }
                case 1u: { // Show normals as colors
                    return vec4<f32>(sampled.xyz * 0.5 + 0.5, 1.0);
                }
                case 2u: { // Show alpha channel
                    return vec4<f32>(sampled.aaa, 1.0);
                }
                case 3u: { // Show as grayscale
                    let gray = dot(sampled.rgb, vec3<f32>(0.299, 0.587, 0.114));
                    return vec4<f32>(gray, gray, gray, 1.0);
                }
                default: { // Fallback - bright magenta to indicate error
                    return vec4<f32>(1.0, 0.0, 1.0, 1.0);
                }
            }
        }
    `;
    
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
 * Debug composition system that shows individual render targets
 */
export async function DebugCompositionSystem(
    renderer: Renderer,
    gbuffer: GBuffer,
    raytracingOutput: GPUTexture,
    debugMode: number = 0 // 0=albedo, 1=normal, 2=position, 3=raytracing
) {
    console.log(`🔍 Debug composition mode ${debugMode}`);
    
    const debugPipeline = await getPipeline(renderer);
    const debugSampler = getSampler(renderer);

    // Choose which texture to display
    let textureView: GPUTextureView;
    let mode: number;
    
    switch (debugMode) {
        case 0:
            textureView = gbuffer.views.albedo;
            mode = 0; // Raw texture
            console.log("🔍 Showing G-Buffer Albedo");
            break;
        case 1:
            textureView = gbuffer.views.normal;
            mode = 1; // Normals as colors
            console.log("🔍 Showing G-Buffer Normals");
            break;
        case 2:
            textureView = gbuffer.views.position;
            mode = 3; // Grayscale (positions are usually large numbers)
            console.log("🔍 Showing G-Buffer Position");
            break;
        case 3:
            textureView = raytracingOutput.createView();
            mode = 0; // Raw texture
            console.log("🔍 Showing Raytracing Output");
            break;
        default:
            textureView = gbuffer.views.albedo;
            mode = 4; // Error mode (magenta)
            console.log("🔍 Invalid debug mode, showing error");
    }

    // Create debug mode uniform buffer
    const debugModeBuffer = renderer.device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    renderer.device.queue.writeBuffer(debugModeBuffer, 0, new Uint32Array([mode]));

    const bindGroup = renderer.device.createBindGroup({
        layout: debugPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: textureView },
            { binding: 1, resource: debugSampler },
            { binding: 2, resource: { buffer: debugModeBuffer } },
        ],
    });

    const commandEncoder = renderer.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: renderer.context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0.5, g: 0.0, b: 0.5, a: 1.0 }, // Purple background to see if nothing renders
        }],
    });

    passEncoder.setPipeline(debugPipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(3); // Full screen triangle
    passEncoder.end();
    renderer.device.queue.submit([commandEncoder.finish()]);
    
    // Clean up
    debugModeBuffer.destroy();
}