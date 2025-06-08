import { initWebGPU } from './gpu.js';

/**
 * Manages the core WebGPU device, context, and format.
 * Implemented as a singleton to ensure only one instance controls the GPU.
 */
export class Renderer {
    public device!: GPUDevice;
    public context!: GPUCanvasContext;
    public format!: GPUTextureFormat;
    public canvas: HTMLCanvasElement;

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
        const gpu = await initWebGPU(this.canvas);
        if (!gpu) {
            throw new Error("Could not initialize WebGPU. Your browser may not support it.");
        }
        this.device = gpu.device;
        this.context = gpu.context;
        this.format = gpu.format;

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
}