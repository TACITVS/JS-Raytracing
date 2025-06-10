// File: src/renderer/Renderer.ts
// Path: src/renderer/Renderer.ts
// Description: Enhanced Renderer class with integrated ResourceManager and capability detection.
// Now provides centralized GPU resource management and better error handling.

import { initWebGPU, checkWebGPUCapabilities } from './gpu.js';
import { ResourceManager } from './ResourceManager.js';

/**
 * Manages the core WebGPU device, context, and format.
 * Implemented as a singleton to ensure only one instance controls the GPU.
 * Now includes ResourceManager integration and capability detection.
 */
export class Renderer {
    public device!: GPUDevice;
    public context!: GPUCanvasContext;
    public format!: GPUTextureFormat;
    public canvas: HTMLCanvasElement;
    
    // NEW: Enhanced properties for better resource management
    public resources!: ResourceManager;
    public adapter!: GPUAdapter;
    public capabilities!: ReturnType<typeof checkWebGPUCapabilities>;

    private static instance: Renderer;

    private constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    /**
     * Gets the single instance of the Renderer, creating it if necessary.
     * @param canvas The HTML canvas element to render to.
     * @returns A promise that resolves to the Renderer instance.
     */
    public static async getInstance(canvas: HTMLCanvasElement): Promise<Renderer> {
        if (!Renderer.instance) {
            Renderer.instance = new Renderer(canvas);
            await Renderer.instance.initialize();
        }
        return Renderer.instance;
    }

    private async initialize() {
        // Enhanced WebGPU initialization
        const gpu = await initWebGPU(this.canvas);
        if (!gpu) {
            throw new Error("Could not initialize WebGPU. Your browser may not support it.");
        }
        
        this.device = gpu.device;
        this.context = gpu.context;
        this.format = gpu.format;
        this.adapter = gpu.adapter;
        
        // NEW: Initialize capability detection and resource management
        this.capabilities = checkWebGPUCapabilities(this.adapter);
        this.resources = new ResourceManager(this.device);
        
        // Log capabilities for debugging
        console.log('WebGPU Capabilities:', this.capabilities);
        console.log('WebGPU Limits:', {
            maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
            maxComputeWorkgroupStorageSize: this.adapter.limits.maxComputeWorkgroupStorageSize,
            maxComputeInvocationsPerWorkgroup: this.adapter.limits.maxComputeInvocationsPerWorkgroup,
            maxTextureDimension2D: this.adapter.limits.maxTextureDimension2D
        });

        // Use a ResizeObserver to handle canvas resizing automatically.
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const canvas = entry.target as HTMLCanvasElement;
                const width = entry.contentBoxSize[0].inlineSize;
                const height = entry.contentBoxSize[0].blockSize;
                
                // Stop observing to prevent infinite loops during resize.
                observer.unobserve(canvas);

                canvas.width = Math.max(1, Math.min(width, this.device.limits.maxTextureDimension2D));
                canvas.height = Math.max(1, Math.min(height, this.device.limits.maxTextureDimension2D));
                
                // Re-observe after the resize has been handled.
                // This is a simple way to debounce and avoid re-triggering.
                requestAnimationFrame(() => observer.observe(canvas));
            }
        });
        observer.observe(this.canvas);
    }

    /**
     * Get current canvas dimensions
     */
    get canvasSize(): { width: number; height: number } {
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }

    /**
     * Create a sampler with commonly used settings
     */
    createStandardSampler(label?: string): GPUSampler {
        return this.device.createSampler({
            label: label || 'Standard Sampler',
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge'
        });
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this.resources) {
            this.resources.destroy();
        }
    }

    /**
     * Get debug information about the renderer state
     */
    getDebugInfo(): {
        canvasSize: { width: number; height: number };
        capabilities: ReturnType<typeof checkWebGPUCapabilities>;
        resourceStats: {
            buffers: number;
            textures: number;
            bindGroups: number;
            pipelines: number;
            shaderModules: number;
        };
    } {
        return {
            canvasSize: this.canvasSize,
            capabilities: this.capabilities,
            resourceStats: this.resources.getResourceStats()
        };
    }
}