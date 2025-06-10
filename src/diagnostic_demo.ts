// File: src/diagnostic_demo.ts
// Simplified version without bitecs dependency - focuses on canvas presentation

import { Renderer } from './renderer/Renderer.js';
import { GBuffer } from './renderer/GBuffer.js';
import { CompositionSystem } from './ecs/systems/CompositionSystem.js';

/**
 * Simplified diagnostic demo for testing canvas presentation
 */
export class DiagnosticDemo {
    private renderer!: Renderer;
    private gbuffer!: GBuffer;
    private raytracingOutput!: GPUTexture;
    private startTime: number = 0;
    private frameCount: number = 0;
    private lastFpsTime: number = 0;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        console.log('🚀 Starting DiagnosticDemo...');
        
        if (!canvas) {
            throw new Error('Canvas element is required');
        }
        
        this.canvas = canvas;
        this.logCanvasInfo();
    }

    private logCanvasInfo() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        console.log(`📐 Canvas size: ${this.canvas.width}x${this.canvas.height}, DPR: ${dpr}`);
        console.log(`📐 Client size: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
        console.log(`📐 Canvas rect:`, rect);
    }

    async startup(): Promise<void> {
        try {
            console.log('🔧 Initializing renderer...');
            this.renderer = await Renderer.getInstance(this.canvas);

            console.log('🎯 Creating GBuffer...');
            this.gbuffer = new GBuffer(this.renderer);
            
            // DIAGNOSTIC: Inspect GBuffer immediately after creation
            console.log('🔍 GBuffer created. Inspecting structure...');
            this.inspectGBuffer();

            console.log('🎨 Creating raytracing output texture...');
            this.createRaytracingTexture();

            console.log('🧪 Testing simple clear...');
            await this.testSimpleClear();

            console.log('🎬 Starting render loop...');
            this.startTime = performance.now();
            this.lastFpsTime = this.startTime;
            this.renderLoop();

        } catch (error) {
            console.error('❌ Error during startup:', error);
            throw error;
        }
    }

    private inspectGBuffer() {
        const gbAny = this.gbuffer as any;
        
        console.log('📊 GBuffer Analysis:');
        console.log('  - Type:', typeof this.gbuffer);
        console.log('  - Constructor:', this.gbuffer.constructor.name);
        console.log('  - Properties:', Object.keys(gbAny));
        console.log('  - Property count:', Object.keys(gbAny).length);
        
        // DEEP INSPECTION: Check each property thoroughly
        Object.keys(gbAny).forEach(key => {
            const value = gbAny[key];
            console.log(`  - ${key}:`, typeof value, value?.constructor?.name);
            
            if (Array.isArray(value)) {
                console.log(`    📦 Array length: ${value.length}`);
                value.forEach((item, i) => {
                    console.log(`    [${i}]:`, typeof item, item?.constructor?.name, item?.label);
                });
            } else if (value && typeof value === 'object') {
                console.log(`    📦 Object properties:`, Object.keys(value));
                
                // Check if it's a texture-like object
                if (value.createView) {
                    console.log(`    ✅ This is a GPU texture: ${value.label || 'unlabeled'}`);
                } else {
                    // Check if object contains textures
                    Object.keys(value).forEach(subKey => {
                        const subValue = value[subKey];
                        console.log(`      - ${subKey}:`, typeof subValue, subValue?.constructor?.name);
                        if (subValue && subValue.createView) {
                            console.log(`      ✅ Found texture at ${key}.${subKey}: ${subValue.label || 'unlabeled'}`);
                        }
                    });
                }
            }
        });
    }

    private createRaytracingTexture() {
        const { width, height } = this.canvas;
        
        // FIXED: Ensure ALL necessary usage flags are included
        this.raytracingOutput = this.renderer.device.createTexture({
            size: { width, height },
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING | 
                   GPUTextureUsage.TEXTURE_BINDING | 
                   GPUTextureUsage.RENDER_ATTACHMENT | // CRITICAL: For render passes
                   GPUTextureUsage.COPY_DST |
                   GPUTextureUsage.COPY_SRC, // For debugging/capture
            label: 'Raytracing Output'
        });

        console.log(`✅ Created raytracing texture: ${width}x${height} with RENDER_ATTACHMENT usage`);
    }

    private async testSimpleClear() {
        const commandEncoder = this.renderer.device.createCommandEncoder();
        const canvasTexture = this.renderer.context.getCurrentTexture();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: canvasTexture.createView(),
                clearValue: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 }, // Magenta
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });
        renderPass.end();

        this.renderer.device.queue.submit([commandEncoder.finish()]);
        console.log('🧪 Simple clear test submitted (should see magenta for 2 seconds)');

        // Wait 2 seconds before starting actual rendering
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    private async renderLoop() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.startTime) / 1000.0;

        try {
            // Create some dummy data in the GBuffer by clearing it with colors
            console.log('🎯 Creating test G-Buffer data...');
            await this.createTestGBufferData();

            // Create test raytracing data
            console.log('✨ Creating test raytracing data...');
            await this.createTestRaytracingData();
            
            console.log('🎨 Running CompositionSystem...');
            await CompositionSystem(this.renderer, this.gbuffer, this.raytracingOutput);

            // FPS tracking
            this.frameCount++;
            if (currentTime - this.lastFpsTime >= 1000) {
                const fps = (this.frameCount * 1000) / (currentTime - this.lastFpsTime);
                const elapsed = (currentTime - this.startTime) / 1000;
                console.log(`🎬 Frame ${this.frameCount}, elapsed: ${elapsed.toFixed(1)}s, FPS: ${fps.toFixed(1)}`);
                this.frameCount = 0;
                this.lastFpsTime = currentTime;
            }

            console.log('✅ All render systems completed successfully');

        } catch (error) {
            console.error('❌ Error in render loop:', error);
            if (error instanceof Error) {
                console.error('Stack trace:', error.stack);
            }
            return; // Stop render loop on error
        }

        // Continue render loop
        requestAnimationFrame(() => this.renderLoop());
    }

    private async createTestGBufferData() {
        // CRITICAL FIX: The GBuffer textures don't have CopyDst usage!
        // Instead of trying to copy to them, create new textures with proper usage
        const gbAny = this.gbuffer as any;
        
        console.log('🔍 GBuffer has properties:', Object.keys(gbAny));
        
        if (gbAny.textures && typeof gbAny.textures === 'object' && !Array.isArray(gbAny.textures)) {
            console.log(`📦 Found textures object with properties:`, Object.keys(gbAny.textures));
            
            // Get the dimensions from existing textures
            const existingTexture = Object.values(gbAny.textures)[0] as GPUTexture;
            const width = existingTexture.width;
            const height = existingTexture.height;
            
            console.log(`🔧 Creating new textures with CopyDst usage: ${width}x${height}`);
            
            // Create new textures with proper usage flags that include CopyDst
            const textureDescriptor = {
                size: { width, height },
                format: 'rgba8unorm' as GPUTextureFormat,
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
                label: 'Test Texture'
            };
            
            // Replace textures with new ones that support copying
            const newTextures: any = {};
            let textureIndex = 0;
            
            for (const key of Object.keys(gbAny.textures)) {
                console.log(`🎯 Creating new ${key} texture with CopyDst usage`);
                
                // Create new texture with proper usage
                const newTexture = this.renderer.device.createTexture({
                    ...textureDescriptor,
                    label: `Test ${key} Texture`
                });
                
                // Fill with test pattern
                await this.fillTextureWithTestPattern(newTexture, textureIndex);
                
                // Replace in GBuffer
                newTextures[key] = newTexture;
                textureIndex++;
            }
            
            // Replace the entire textures object
            gbAny.textures = newTextures;
            
            // Also update views if they exist
            if (gbAny.views) {
                const newViews: any = {};
                for (const key of Object.keys(newTextures)) {
                    newViews[key] = newTextures[key].createView();
                }
                gbAny.views = newViews;
            }
            
            console.log('✅ Successfully replaced GBuffer textures with test-capable versions');
            
        } else {
            console.log('⚠️ No textures object found in GBuffer, skipping test data creation');
        }
    }

    private async fillTextureWithTestPattern(texture: GPUTexture, index: number) {
        // FIXED: Use the ACTUAL texture dimensions, not canvas dimensions
        const textureWidth = texture.width;
        const textureHeight = texture.height;
        const bytesPerPixel = 4; // RGBA
        
        console.log(`🔧 Texture ${index}: Using actual texture size ${textureWidth}x${textureHeight} instead of canvas size`);
        
        // FIXED: Ensure bytesPerRow is aligned to 256 bytes
        const unalignedBytesPerRow = textureWidth * bytesPerPixel;
        const bytesPerRow = Math.ceil(unalignedBytesPerRow / 256) * 256; // Round up to multiple of 256
        const imageSize = bytesPerRow * textureHeight;
        
        console.log(`🔧 Texture ${index}: ${textureWidth}x${textureHeight}, bytesPerRow: ${unalignedBytesPerRow} -> ${bytesPerRow} (aligned)`);
        
        // Create test pattern data with proper row padding
        const testData = new Uint8Array(imageSize);
        
        for (let y = 0; y < textureHeight; y++) {
            for (let x = 0; x < textureWidth; x++) {
                const pixelIndex = y * bytesPerRow + x * 4; // Use aligned bytesPerRow
                
                if (index === 0) {
                    // Position texture - red gradient
                    testData[pixelIndex + 0] = 255; // R - red base
                    testData[pixelIndex + 1] = Math.floor((x / textureWidth) * 128); // G
                    testData[pixelIndex + 2] = Math.floor((y / textureHeight) * 128); // B
                    testData[pixelIndex + 3] = 255; // A
                } else if (index === 1) {
                    // Normal texture - blue gradient
                    testData[pixelIndex + 0] = Math.floor((x / textureWidth) * 128); // R
                    testData[pixelIndex + 1] = Math.floor((y / textureHeight) * 128); // G
                    testData[pixelIndex + 2] = 255; // B - blue base
                    testData[pixelIndex + 3] = 255; // A
                } else {
                    // Albedo texture - orange gradient
                    testData[pixelIndex + 0] = 255; // R - orange base
                    testData[pixelIndex + 1] = Math.floor((x / textureWidth) * 128 + 64); // G
                    testData[pixelIndex + 2] = Math.floor((y / textureHeight) * 64); // B
                    testData[pixelIndex + 3] = 255; // A
                }
            }
        }
        
        // Create buffer for the data
        const buffer = this.renderer.device.createBuffer({
            size: imageSize,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true
        });
        
        new Uint8Array(buffer.getMappedRange()).set(testData);
        buffer.unmap();
        
        // Copy to texture with properly aligned bytesPerRow
        const commandEncoder = this.renderer.device.createCommandEncoder();
        commandEncoder.copyBufferToTexture(
            {
                buffer,
                bytesPerRow, // Use aligned value
                rowsPerImage: textureHeight
            },
            { texture },
            { width: textureWidth, height: textureHeight } // Use actual texture dimensions
        );
        
        this.renderer.device.queue.submit([commandEncoder.finish()]);
        
        // Clean up
        buffer.destroy();
        
        console.log(`✅ Created test pattern for texture ${index}: ${texture.label || 'unlabeled'}`);
    }

    private async createTestRaytracingData() {
        // FIXED: Use the ACTUAL raytracing texture dimensions, not canvas dimensions
        const textureWidth = this.raytracingOutput.width;
        const textureHeight = this.raytracingOutput.height;
        const bytesPerPixel = 4; // RGBA
        
        console.log(`🔧 Raytracing: Using actual texture size ${textureWidth}x${textureHeight} instead of canvas size`);
        
        // FIXED: Ensure bytesPerRow is aligned to 256 bytes
        const unalignedBytesPerRow = textureWidth * bytesPerPixel;
        const bytesPerRow = Math.ceil(unalignedBytesPerRow / 256) * 256; // Round up to multiple of 256
        const imageSize = bytesPerRow * textureHeight;
        
        console.log(`🔧 Raytracing: ${textureWidth}x${textureHeight}, bytesPerRow: ${unalignedBytesPerRow} -> ${bytesPerRow} (aligned)`);
        
        // Create green gradient test pattern with proper row padding
        const testData = new Uint8Array(imageSize);
        
        for (let y = 0; y < textureHeight; y++) {
            for (let x = 0; x < textureWidth; x++) {
                const pixelIndex = y * bytesPerRow + x * 4; // Use aligned bytesPerRow
                
                // Green raytracing pattern with some variation
                testData[pixelIndex + 0] = Math.floor((x / textureWidth) * 64); // R
                testData[pixelIndex + 1] = 200; // G - green base  
                testData[pixelIndex + 2] = Math.floor((y / textureHeight) * 128); // B
                testData[pixelIndex + 3] = 255; // A
            }
        }
        
        // Create buffer for the data
        const buffer = this.renderer.device.createBuffer({
            size: imageSize,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true
        });
        
        new Uint8Array(buffer.getMappedRange()).set(testData);
        buffer.unmap();
        
        // Copy to raytracing texture with properly aligned bytesPerRow
        const commandEncoder = this.renderer.device.createCommandEncoder();
        commandEncoder.copyBufferToTexture(
            {
                buffer,
                bytesPerRow, // Use aligned value
                rowsPerImage: textureHeight
            },
            { texture: this.raytracingOutput },
            { width: textureWidth, height: textureHeight } // Use actual texture dimensions
        );
        
        this.renderer.device.queue.submit([commandEncoder.finish()]);
        
        // Clean up
        buffer.destroy();
        
        console.log('✅ Created raytracing test pattern with proper alignment');
    }

    /**
     * Get diagnostic information
     */
    getDiagnosticInfo() {
        return {
            frameCount: this.frameCount,
            elapsedTime: (performance.now() - this.startTime) / 1000,
            canvasSize: {
                width: this.canvas.width,
                height: this.canvas.height,
                clientWidth: this.canvas.clientWidth,
                clientHeight: this.canvas.clientHeight
            }
        };
    }
}

// Auto-start when loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) {
            throw new Error('Canvas element not found - make sure your HTML has <canvas id="canvas"></canvas>');
        }

        console.log('✅ Canvas element found, starting demo...');
        
        const demo = new DiagnosticDemo(canvas);
        await demo.startup();

        // Make demo available globally for debugging
        (window as any).demo = demo;

    } catch (error) {
        console.error('❌ Failed to start diagnostic demo:', error);
        
        // Show error on page
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: absolute; top: 10px; left: 10px; background: red; color: white; padding: 10px; font-family: monospace; z-index: 1000; border-radius: 4px;';
        if (error instanceof Error) {
            errorDiv.textContent = `Error: ${error.message}`;
        } else {
            errorDiv.textContent = `Error: ${String(error)}`;
        }
        document.body.appendChild(errorDiv);
    }
});