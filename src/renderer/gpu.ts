// File: src/renderer/gpu.ts
// Path: src/renderer/gpu.ts
// Description: Enhanced WebGPU initialization with capability detection, error handling, 
// and optimized configuration for raytracing performance. Based on WebGPU samples patterns.

export async function initWebGPU(canvas: HTMLCanvasElement): Promise<{
    device: GPUDevice;
    context: GPUCanvasContext;
    format: GPUTextureFormat;
    adapter: GPUAdapter;
} | null> {
    // Check for WebGPU support
    if (!navigator.gpu) {
        throw new Error('WebGPU not supported on this browser.');
    }

    // Request adapter with specific requirements for raytracing
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance', // Critical for raytracing performance
        forceFallbackAdapter: false
    });

    if (!adapter) {
        throw new Error('No appropriate GPUAdapter found.');
    }

    // Log adapter info for debugging
    console.log('GPU Adapter Info:', {
        vendor: (adapter as any).info?.vendor || 'Unknown',
        architecture: (adapter as any).info?.architecture || 'Unknown',
        device: (adapter as any).info?.device || 'Unknown'
    });

    // Check required features and limits
    const requiredFeatures: GPUFeatureName[] = [];
    const supportedFeatures = adapter.features;
    
    // Add features if supported (important for advanced raytracing)
    if (supportedFeatures.has('timestamp-query')) {
        requiredFeatures.push('timestamp-query');
    }
    if (supportedFeatures.has('shader-f16')) {
        requiredFeatures.push('shader-f16');
    }

    // Get device with optimized limits for raytracing
    const device = await adapter.requestDevice({
        requiredFeatures,
        requiredLimits: {
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize,
            maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup,
        }
    });

    // Enhanced error handling
    device.addEventListener('uncapturederror', (event) => {
        console.error('Uncaptured WebGPU error:', event.error);
    });

    // Setup canvas context with proper configuration
    const context = canvas.getContext('webgpu');
    if (!context) {
        throw new Error('Failed to get WebGPU context from canvas.');
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format,
        alphaMode: 'premultiplied', // Better for composition
        colorSpace: 'srgb'
    });

    return { device, context, format, adapter };
}

// Feature detection helper
export function checkWebGPUCapabilities(adapter: GPUAdapter): {
    supportsTimestamps: boolean;
    supportsF16: boolean;
    computeWorkgroupLimits: any;
    storageBufferLimits: any;
} {
    return {
        supportsTimestamps: adapter.features.has('timestamp-query'),
        supportsF16: adapter.features.has('shader-f16'),
        computeWorkgroupLimits: {
            maxInvocations: adapter.limits.maxComputeInvocationsPerWorkgroup,
            maxStorageSize: adapter.limits.maxComputeWorkgroupStorageSize,
            maxWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
            maxWorkgroupSizeY: adapter.limits.maxComputeWorkgroupSizeY,
            maxWorkgroupSizeZ: adapter.limits.maxComputeWorkgroupSizeZ
        },
        storageBufferLimits: {
            maxBindingSize: adapter.limits.maxStorageBufferBindingSize,
            maxBuffersPerStage: adapter.limits.maxStorageBuffersPerShaderStage
        }
    };
}

// This function creates a pipeline that simply draws a texture to the entire screen.
// We use this to get the output of our compute shader onto the canvas.
export function createFullScreenQuad(device: GPUDevice, format: GPUTextureFormat, textureView: GPUTextureView) {
    const shaderModule = device.createShaderModule({
        code: `
            @group(0) @binding(0) var mySampler: sampler;
            @group(0) @binding(1) var myTexture: texture_2d<f32>;

            struct VertexOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) tex_coord: vec2<f32>,
            };

            @vertex
            fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> VertexOutput {
                var output: VertexOutput;
                let x = f32(in_vertex_index % 2u) * 2.0 - 1.0;
                let y = f32(in_vertex_index / 2u) * 2.0 - 1.0;
                output.position = vec4<f32>(x, -y, 0.0, 1.0);
                output.tex_coord = vec2<f32>(f32(in_vertex_index % 2u), f32(in_vertex_index / 2u));
                return output;
            }

            @fragment
            fn fs_main(@location(0) tex_coord: vec2<f32>) -> @location(0) vec4<f32> {
                return textureSample(myTexture, mySampler, tex_coord);
            }
        `,
    });

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vs_main' },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: { topology: 'triangle-strip' },
    });
    
    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: textureView },
        ],
    });

    return { pipeline, bindGroup };
}

export function renderFullScreenQuad(commandEncoder: GPUCommandEncoder, context: GPUCanvasContext, pipeline: GPURenderPipeline, bindGroup: GPUBindGroup) {
    const textureView = context.getCurrentTexture().createView();
    const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [{
            view: textureView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
        }],
    };
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(4, 1, 0, 0);
    passEncoder.end();
}