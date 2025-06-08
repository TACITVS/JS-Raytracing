export async function initWebGPU(canvas: HTMLCanvasElement): Promise<{ device: GPUDevice; context: GPUCanvasContext; format: GPUTextureFormat } | null> {
    if (!navigator.gpu) {
        console.error("WebGPU not supported.");
        return null;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("Failed to get GPU adapter");
        return null;
    }
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if(!context) {
        console.error("Failed to get WebGPU context");
        return null;
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });
    return { device, context, format };
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
