import { createWorld, addEntity, addComponent, defineQuery } from 'bitecs';
import { mat4, vec3, quat, vec4 } from 'gl-matrix';
import { Transform } from './ecs/components.js';

// --- WebGPU Boilerplate (can be moved to gpu.ts) ---

async function initWebGPU(canvas: HTMLCanvasElement) {
    if (!navigator.gpu) throw new Error('WebGPU not supported.');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found.');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('Could not get WebGPU context.');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    const depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return { device, context, format, depthTexture };
}

// --- Main 3D Scene Logic ---

async function main() {
    const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas element not found');
    
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    const { device, context, format, depthTexture } = await initWebGPU(canvas);

    // --- Shader and Pipeline Setup ---
    // Corrected Path: We now fetch from the 'dist' folder where the build script copies the file.
    const shaderCode = await fetch('./dist/shaders/lit.wgsl').then(res => res.text());
    const shaderModule = device.createShaderModule({ code: shaderCode });

    const pipeline = device.createRenderPipeline({
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
            targets: [{ format }],
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

    // --- Geometry Data ---
    const cubeVertexData = new Float32Array([
        //-x
        -1,-1,-1, -1,0,0,  -1,-1,1,  -1,0,0,  -1,1,1,  -1,0,0,  -1,1,-1,  -1,0,0,
        //+x
        1,1,-1,  1,0,0,  1,1,1,  1,0,0,  1,-1,1,  1,0,0,  1,-1,-1,  1,0,0,
        //-y
        -1,-1,-1, 0,-1,0,  1,-1,-1, 0,-1,0,  1,-1,1,  0,-1,0,  -1,-1,1,  0,-1,0,
        //+y
        -1,1,1,  0,1,0,  1,1,1,  0,1,0,  1,1,-1,  0,1,0,  -1,1,-1,  0,1,0,
        //-z
        1,-1,-1,  0,0,-1, -1,-1,-1,  0,0,-1,  -1,1,-1,  0,0,-1,  1,1,-1,  0,0,-1,
        //+z
        -1,1,1,  0,0,1,  1,1,1,  0,0,1,  1,-1,1,  0,0,1,  -1,-1,1,  0,0,1,
    ]);
    const cubeIndexData = new Uint16Array([
        0,1,2, 0,2,3,    4,5,6, 4,6,7,
        8,9,10, 8,10,11, 12,13,14, 12,14,15,
        16,17,18, 16,18,19, 20,21,22, 20,22,23
    ]);
    
    const vertexBuffer = device.createBuffer({
        size: cubeVertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(cubeVertexData);
    vertexBuffer.unmap();

    const indexBuffer = device.createBuffer({
        size: cubeIndexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Uint16Array(indexBuffer.getMappedRange()).set(cubeIndexData);
    indexBuffer.unmap();


    // --- Uniform Buffers and Bind Groups ---
    const sceneUniformBuffer = device.createBuffer({
        size: 16 * 4 + 4 * 4 + 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    const modelUniformBuffer = device.createBuffer({
        size: 16 * 4 + 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const sceneBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
    });

    const modelBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: { buffer: modelUniformBuffer } }],
    });

    // --- ECS Setup ---
    const world = createWorld();
    const transformQuery = defineQuery([Transform]);
    const cubeColors = [
        vec4.fromValues(1, 0, 0, 1), vec4.fromValues(0, 1, 0, 1), vec4.fromValues(0, 0, 1, 1),
        vec4.fromValues(1, 1, 0, 1), vec4.fromValues(1, 0, 1, 1), vec4.fromValues(0, 1, 1, 1),
    ];
    for (let i = 0; i < 6; i++) {
        const eid = addEntity(world);
        addComponent(world, Transform, eid);
        Transform.position.x[eid] = (Math.random() - 0.5) * 10;
        Transform.position.y[eid] = (Math.random() - 0.5) * 10;
        Transform.position.z[eid] = (Math.random() - 0.5) * 10;
        Transform.scale.x[eid] = 1;
        Transform.scale.y[eid] = 1;
        Transform.scale.z[eid] = 1;
    }

    // --- Render Loop ---
    const projectionMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const viewProjMatrix = mat4.create();
    const modelMatrix = mat4.create();
    const rotation = quat.create();

    function frame() {
        const aspectRatio = canvas.width / canvas.height;
        mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspectRatio, 1, 100.0);
        
        const time = performance.now() / 2000;
        const cameraPos = vec3.fromValues(Math.sin(time) * 10, 4, Math.cos(time) * 10);
        mat4.lookAt(viewMatrix, cameraPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        mat4.multiply(viewProjMatrix, projectionMatrix, viewMatrix);
        
        const lightPos = vec4.fromValues(Math.sin(time * 2) * 20, 10, Math.cos(time * 2) * 20, 1);
        
        device.queue.writeBuffer(sceneUniformBuffer, 0, viewProjMatrix as Float32Array);
        device.queue.writeBuffer(sceneUniformBuffer, 64, lightPos as Float32Array);
        device.queue.writeBuffer(sceneUniformBuffer, 80, cameraPos as Float32Array);

        const commandEncoder = device.createCommandEncoder();
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setIndexBuffer(indexBuffer, 'uint16');
        passEncoder.setBindGroup(0, sceneBindGroup);

        const entities = transformQuery(world);
        for (let i = 0; i < entities.length; i++) {
            const eid = entities[i];

            quat.fromEuler(rotation, time * 20 * (i + 1), time * 30 * (i + 1), 0);
            mat4.fromRotationTranslationScale(
                modelMatrix,
                rotation,
                [Transform.position.x[eid], Transform.position.y[eid], Transform.position.z[eid]],
                [Transform.scale.x[eid], Transform.scale.y[eid], Transform.scale.z[eid]]
            );

            device.queue.writeBuffer(modelUniformBuffer, 0, modelMatrix as Float32Array);
            device.queue.writeBuffer(modelUniformBuffer, 64, cubeColors[i] as Float32Array);
            passEncoder.setBindGroup(1, modelBindGroup);
            
            passEncoder.drawIndexed(cubeIndexData.length);
        }

        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

main().catch(err => console.error(err));
