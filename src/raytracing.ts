import { initWebGPU, createFullScreenQuad, renderFullScreenQuad } from './renderer/gpu.js';

async function main() {
    const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
    if (!canvas) {
        throw new Error('Canvas element with ID "webgpu-canvas" not found');
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    const gpu = await initWebGPU(canvas);
    if (!gpu) return;
    const { device, context, format } = gpu;
    
    // Fetch the external shader file.
    // Our new build step ensures this file exists at the target location.
    const shaderCode = await fetch('./shaders/raytracing.wgsl').then(res => res.text());
    const shaderModule = device.createShaderModule({ code: shaderCode });

    const outputTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    });

    const spheres = [
        { center: [0, 0, -1], radius: 0.5, color: [0.8, 0.6, 0.2], material: 1 },
        { center: [0, -100.5, -1], radius: 100, color: [0.2, 0.8, 0.2], material: 0 },
        { center: [-1.2, 0, -1.5], radius: 0.5, color: [0.8, 0.8, 0.8], material: 1 },
        { center: [1.2, 0, -1.5], radius: 0.5, color: [0.8, 0.2, 0.2], material: 0 },
    ];
    
    const sphereData = new Float32Array(spheres.flatMap(s => [...s.center, s.radius, ...s.color, s.material]));
    const sphereBuffer = device.createBuffer({
        size: sphereData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Float32Array(sphereBuffer.getMappedRange()).set(sphereData);
    sphereBuffer.unmap();

    const uniformBuffer = device.createBuffer({
        size: 8 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const computePipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' },
    });

    const computeBindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: sphereBuffer } },
            { binding: 1, resource: { buffer: uniformBuffer } },
            { binding: 2, resource: outputTexture.createView() },
        ],
    });

    const fullScreenQuad = createFullScreenQuad(device, format, outputTexture.createView());

    function frame(cvs: HTMLCanvasElement) {
        const uniformData = new Float32Array([
            0, 1, 5, 0,
            cvs.width, cvs.height,
            performance.now() / 1000.0,
            0,
        ]);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData);

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(computePipeline);
        passEncoder.setBindGroup(0, computeBindGroup);
        passEncoder.dispatchWorkgroups(Math.ceil(cvs.width / 8), Math.ceil(cvs.height / 8));
        passEncoder.end();

        renderFullScreenQuad(commandEncoder, context, fullScreenQuad.pipeline, fullScreenQuad.bindGroup);
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(() => frame(cvs));
    }

    requestAnimationFrame(() => frame(canvas));
}

main().catch(err => console.error(err));
