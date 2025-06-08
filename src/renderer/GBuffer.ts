// File: src/renderer/GBuffer.ts
// Tag: GBUFFER_CLASS_FIXED
// Description: Corrects TypeScript errors by ensuring that the G-Buffer texture
// formats are correctly typed as GPUTextureFormat, not as generic strings.

import { Renderer } from "./Renderer.js";

// By defining the type explicitly here, we ensure type safety throughout.
export const GBUFFER_FORMATS: { [key: string]: GPUTextureFormat } = {
    // Stores world-space position. High precision is required.
    position: 'rgba32float',
    // Stores world-space normals.
    normal: 'rgba16float',
    // Stores albedo (color) in RGB and a material identifier in A.
    albedo: 'rgba8unorm',
};

export class GBuffer {
    public textures: {
        position: GPUTexture,
        normal: GPUTexture,
        albedo: GPUTexture,
    };
    public views: {
        position: GPUTextureView,
        normal: GPUTextureView,
        albedo: GPUTextureView,
    };

    private renderer: Renderer;

    constructor(renderer: Renderer) {
        this.renderer = renderer;
        this.textures = this.createTextures();
        this.views = this.createTextureViews();

        // Handle resizing
        const observer = new ResizeObserver(() => {
            this.destroy();
            this.textures = this.createTextures();
            this.views = this.createTextureViews();
        });
        observer.observe(renderer.canvas);
    }

    private createTextures() {
        const { device, canvas } = this.renderer;
        const size = [canvas.width, canvas.height];
        const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

        return {
            position: device.createTexture({ size, format: GBUFFER_FORMATS.position, usage }),
            normal: device.createTexture({ size, format: GBUFFER_FORMATS.normal, usage }),
            albedo: device.createTexture({ size, format: GBUFFER_FORMATS.albedo, usage }),
        };
    }

    private createTextureViews() {
        return {
            position: this.textures.position.createView(),
            normal: this.textures.normal.createView(),
            albedo: this.textures.albedo.createView(),
        };
    }

    public getRenderPassDescriptor(): GPURenderPassDescriptor {
        // The targets now correctly infer their type from GBUFFER_FORMATS
        const targets: (GPURenderPassColorAttachment | null)[] = [
            {
                view: this.views.position,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                loadOp: 'clear',
                storeOp: 'store',
            },
            {
                view: this.views.normal,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                loadOp: 'clear',
                storeOp: 'store',
            },
            {
                view: this.views.albedo,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            },
        ];
        
        return { colorAttachments: targets };
    }

    private destroy() {
        this.textures.position.destroy();
        this.textures.normal.destroy();
        this.textures.albedo.destroy();
    }
}