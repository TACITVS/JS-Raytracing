// File: src/triangle_test.ts
// A minimal triangle renderer to test basic WebGPU functionality

export class TriangleTest {
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private format!: GPUTextureFormat;
    private pipeline!: GPURenderPipeline;

    async startup() {
        console.log("🔺 Starting triangle test...");
        
        const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        if (!canvas) throw new Error('Canvas not found');

        // Set up WebGPU
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('No adapter');
        
        this.device = await adapter.requestDevice();
        this.context = canvas.getContext('webgpu')!;
        this.format = navigator.gpu.getPreferredCanvasFormat();
        
        this.context.configure({
            device: this.device,
            format: this.format,
        });

        // Create a simple triangle shader
        const shaderCode = `
            @vertex
            fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
                var pos = array<vec2<f32>, 3>(
                    vec2<f32>( 0.0,  0.5),
                    vec2<f32>(-0.5, -0.5),
                    vec2<f32>( 0.5, -0.5)
                );
                return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
            }

            @fragment
            fn fs_main() -> @location(0) vec4<f32> {
                return vec4<f32>(1.0, 0.0, 1.0, 1.0); // Magenta triangle
            }
        `;

        const shaderModule = this.device.createShaderModule({ code: shaderCode });

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: this.format }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        console.log("🔺 Triangle test setup complete, starting render loop...");
        this.render();
    }

    private render = () => {
        const commandEncoder = this.device.createCommandEncoder();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.3, a: 1.0 }, // Dark blue background
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.draw(3); // Draw triangle
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
        
        requestAnimationFrame(this.render);
    };
}

export default TriangleTest;