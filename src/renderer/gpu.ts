export async function initWebGPU(canvas: HTMLCanvasElement): Promise<{ device: GPUDevice; context: GPUCanvasContext; format: GPUTextureFormat } | null> {
    const nav: any = navigator as any;
    if (!nav.gpu) {
        console.error("WebGPU not supported.");
        return null;
    }
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
        console.error("Failed to get GPU adapter");
        return null;
    }
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu") as any;
    const format = nav.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });
    return { device, context, format };
}

export function createRenderPipeline(device: GPUDevice, format: GPUTextureFormat) {
    const shaderModule = device.createShaderModule({
        code: `
            @vertex
            fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> @builtin(position) vec4<f32> {
                let x = f32(in_vertex_index) * 0.5 - 1.0;
                let y = f32(in_vertex_index % 2u) * 0.5;
                return vec4<f32>(x, y, 0.0, 1.0);
            }

            @fragment
            fn fs_main() -> @location(0) vec4<f32> {
                return vec4<f32>(1.0, 0.0, 0.0, 1.0);
            }
        `,
    });

    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vs_main",
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fs_main",
            targets: [{ format }],
        },
        primitive: {
            topology: "triangle-list",
        },
    });

    return pipeline;
}

export function render(device: GPUDevice, context: GPUCanvasContext, pipeline: GPURenderPipeline) {
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
            {
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: "clear",
                storeOp: "store",
            },
        ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.draw(3, 1, 0, 0);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
}
