/**
 * Universal CompositionSystem that finds and blends GBuffer textures with raytracing
 * FIXED: Enhanced texture detection and step-by-step debugging
 */

interface GBuffer {
    textures?: any;
    views?: any;
    renderer?: any;
}

/**
 * ENHANCED function to find GBuffer textures with detailed logging
 */
function findGBufferTextures(gbuffer: GBuffer): { normal: GPUTexture; albedo: GPUTexture } {
    const gbAny = gbuffer as any;
    
    console.log('🔍🔍 ENHANCED: Available GBuffer properties:', Object.keys(gbuffer));
    console.log('🔍🔍 ENHANCED: All property names:', Object.getOwnPropertyNames(gbuffer));
    
    let normal: GPUTexture | null = null;
    let albedo: GPUTexture | null = null;
    
    // FIXED: Handle textures as OBJECT (not array) based on logs
    if (gbAny.textures && typeof gbAny.textures === 'object' && !Array.isArray(gbAny.textures)) {
        console.log(`🔍🔍 ENHANCED: GBuffer.textures is an object, inspecting properties...`);
        
        const texturesObj = gbAny.textures;
        const textureKeys = Object.keys(texturesObj);
        console.log(`🔍🔍 ENHANCED: Textures object has keys:`, textureKeys);
        
        // Look for common texture names in the textures object
        const normalCandidates = ['normal', 'normals', 'gbufferNormal', 'normalTexture', '1'];
        const albedoCandidates = ['albedo', 'color', 'diffuse', 'gbufferAlbedo', 'albedoTexture', '2'];
        
        // Find normal texture in textures object
        for (const candidate of normalCandidates) {
            if (texturesObj[candidate] && typeof texturesObj[candidate].createView === 'function') {
                normal = texturesObj[candidate];
                console.log(`✅✅ ENHANCED: Found normal texture at GBuffer.textures.${candidate}: ${normal.label || 'unlabeled'}`);
                break;
            }
        }
        
        // Find albedo texture in textures object
        for (const candidate of albedoCandidates) {
            if (texturesObj[candidate] && typeof texturesObj[candidate].createView === 'function') {
                albedo = texturesObj[candidate];
                console.log(`✅✅ ENHANCED: Found albedo texture at GBuffer.textures.${candidate}: ${albedo.label || 'unlabeled'}`);
                break;
            }
        }
        
        // If no named properties found, try numeric indices or any texture
        if (!normal || !albedo) {
            console.log('🔍🔍 ENHANCED: Trying all properties in textures object...');
            let textureIndex = 0;
            for (const key of textureKeys) {
                const texture = texturesObj[key];
                if (texture && typeof texture.createView === 'function') {
                    console.log(`🔍🔍 ENHANCED: Found texture at textures.${key}:`, texture.label || 'unlabeled');
                    if (!normal) {
                        normal = texture;
                        console.log(`✅✅ ENHANCED: Using textures.${key} as normal texture`);
                    } else if (!albedo && texture !== normal) {
                        albedo = texture;
                        console.log(`✅✅ ENHANCED: Using textures.${key} as albedo texture`);
                    }
                    textureIndex++;
                }
            }
            
            // If we only found one texture, use it for both
            if (normal && !albedo) {
                albedo = normal;
                console.log(`✅✅ ENHANCED: Using same texture for both normal and albedo (testing mode)`);
            }
        }
    }
    
    if (!normal) {
        throw new Error('ENHANCED ERROR: Could not find normal texture in GBuffer. Available properties: ' + Object.keys(gbuffer).join(', '));
    }
    
    if (!albedo) {
        throw new Error('ENHANCED ERROR: Could not find albedo texture in GBuffer. Available properties: ' + Object.keys(gbuffer).join(', '));
    }
    
    console.log('🎯🎯 ENHANCED: Final textures selected:');
    console.log('  - Normal:', normal.label || 'unlabeled');
    console.log('  - Albedo:', albedo.label || 'unlabeled');
    
    return { normal, albedo };
}

async function createCompositionPipeline(device: GPUDevice): Promise<GPURenderPipeline> {
    console.log('🔧🔧 ENHANCED: Starting pipeline creation...');
    
    // Create shaders with detailed logging
    console.log('📝📝 ENHANCED: Creating vertex shader...');
    const vertexShader = device.createShaderModule({
        label: 'Composition Vertex Shader',
        code: `
            @vertex
            fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
                // Fullscreen triangle
                var pos = array<vec2<f32>, 3>(
                    vec2<f32>(-1.0, -1.0),
                    vec2<f32>( 3.0, -1.0), 
                    vec2<f32>(-1.0,  3.0)
                );
                return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
            }
        `
    });
    console.log('✅✅ ENHANCED: Vertex shader created');
    
    console.log('📝📝 ENHANCED: Creating fragment shader...');
    const fragmentShader = device.createShaderModule({
        label: 'Composition Fragment Shader',
        code: `
            @group(0) @binding(0) var texSampler: sampler;
            @group(0) @binding(1) var normalTexture: texture_2d<f32>;
            @group(0) @binding(2) var albedoTexture: texture_2d<f32>;
            @group(0) @binding(3) var raytracingTexture: texture_2d<f32>;
            
            @fragment
            fn fs_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
                let texCoord = coord.xy / vec2<f32>(textureDimensions(normalTexture, 0));
                
                let normal = textureSample(normalTexture, texSampler, texCoord);
                let albedo = textureSample(albedoTexture, texSampler, texCoord);
                let raytraced = textureSample(raytracingTexture, texSampler, texCoord);
                
                // Simple blend: 50% rasterized + 50% raytraced
                let rasterized = normal * albedo;
                let final = mix(rasterized, raytraced, 0.5);
                
                return vec4<f32>(final.rgb, 1.0);
            }
        `
    });
    console.log('✅✅ ENHANCED: Fragment shader created');
    
    console.log('🔧🔧 ENHANCED: Creating render pipeline...');
    const pipeline = device.createRenderPipeline({
        label: 'Composition Pipeline',
        layout: 'auto',
        vertex: {
            module: vertexShader,
            entryPoint: 'vs_main'
        },
        fragment: {
            module: fragmentShader,
            entryPoint: 'fs_main',
            targets: [{
                format: navigator.gpu.getPreferredCanvasFormat()
            }]
        },
        primitive: {
            topology: 'triangle-list'
        }
    });
    console.log('✅✅ ENHANCED: Render pipeline created successfully');
    
    return pipeline;
}

export async function CompositionSystem(gbuffer: GBuffer, raytracingOutput: GPUTexture, canvas: HTMLCanvasElement) {
    console.log('🎬🎬 ENHANCED CompositionSystem: Starting final composition pass');
    
    const gbAny = gbuffer as any;
    const renderer = gbAny.renderer;
    
    if (!renderer || !renderer.device) {
        throw new Error('ENHANCED CompositionSystem: No valid renderer found in GBuffer');
    }
    
    console.log('✅✅ ENHANCED: Renderer found, device available');
    
    try {
        // Step 1: Create pipeline
        console.log('🔧🔧 ENHANCED: Creating composition render pipeline...');
        const pipeline = await createCompositionPipeline(renderer.device);
        console.log('✅✅ ENHANCED: Composition pipeline created successfully');
        
        // Step 2: Create sampler
        console.log('🔧🔧 ENHANCED: Creating composition sampler...');
        const sampler = renderer.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge'
        });
        console.log('✅✅ ENHANCED: Created composition sampler');
        
        // Step 3: Find textures
        console.log('🔍🔍 ENHANCED: Finding GBuffer textures...');
        const { normal, albedo } = findGBufferTextures(gbuffer);
        console.log('✅✅ ENHANCED: Found GBuffer textures');
        
        // Step 4: Create bind group
        console.log('🔧🔧 ENHANCED: Creating bind group...');
        const bindGroup = renderer.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: sampler
                },
                {
                    binding: 1,
                    resource: normal.createView()
                },
                {
                    binding: 2,
                    resource: albedo.createView()
                },
                {
                    binding: 3,
                    resource: raytracingOutput.createView()
                }
            ]
        });
        console.log('✅✅ ENHANCED: Created bind group successfully');
        
        // Step 5: Get canvas context and configure
        console.log('🔧🔧 ENHANCED: Getting canvas context...');
        const context = canvas.getContext('webgpu') as GPUCanvasContext;
        if (!context) {
            throw new Error('ENHANCED: Failed to get WebGPU canvas context');
        }
        console.log('✅✅ ENHANCED: Got canvas context');
        
        console.log('🔧🔧 ENHANCED: Configuring canvas context...');
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
            device: renderer.device,
            format: canvasFormat,
            alphaMode: 'premultiplied'
        });
        console.log(`✅✅ ENHANCED: Configured canvas context with format: ${canvasFormat}`);
        
        // Step 6: Create render pass and render
        console.log('🎬🎬 ENHANCED: Starting render pass...');
        const commandEncoder = renderer.device.createCommandEncoder({ label: 'Composition Command Encoder' });
        
        const renderPass = commandEncoder.beginRenderPass({
            label: 'Composition Render Pass',
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.3, a: 1.0 }, // Dark blue background
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });
        
        console.log('🎨🎨 ENHANCED: Setting pipeline and bind group...');
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        
        console.log('🎨🎨 ENHANCED: Drawing fullscreen quad...');
        renderPass.draw(3); // Fullscreen triangle
        
        console.log('🎬🎬 ENHANCED: Ending render pass...');
        renderPass.end();
        
        console.log('📤📤 ENHANCED: Submitting commands...');
        renderer.device.queue.submit([commandEncoder.finish()]);
        
        console.log('🎉🎉 ENHANCED CompositionSystem: Final composition completed successfully!');
        
    } catch (error) {
        console.error('❌❌ ENHANCED Error in CompositionSystem:', error);
        console.error('❌❌ ENHANCED Stack trace:', error.stack);
        throw error;
    }
}