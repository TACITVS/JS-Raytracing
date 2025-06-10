// File: src/renderer/ResourceManager.ts
// FIXED VERSION - Includes all missing methods and proper error handling
export class ResourceManager {
    private device: GPUDevice;
    private buffers: Map<string, GPUBuffer> = new Map();
    private textures: Map<string, GPUTexture> = new Map();
    private bindGroups: Map<string, GPUBindGroup> = new Map();
    private pipelines: Map<string, GPURenderPipeline | GPUComputePipeline> = new Map();
    private shaderModules: Map<string, GPUShaderModule> = new Map();

    constructor(device: GPUDevice) {
        this.device = device;
    }

    // Buffer creation with proper usage patterns from samples
    createBuffer(name: string, descriptor: {
        size: number;
        usage: GPUBufferUsageFlags;
        data?: ArrayBuffer | ArrayBufferView;
        label?: string;
    }): GPUBuffer {
        const buffer = this.device.createBuffer({
            size: descriptor.size,
            usage: descriptor.usage,
            label: descriptor.label || name,
            mappedAtCreation: !!descriptor.data
        });

        if (descriptor.data) {
            const arrayBuffer = descriptor.data instanceof ArrayBuffer 
                ? descriptor.data 
                : descriptor.data.buffer.slice(
                    descriptor.data.byteOffset, 
                    descriptor.data.byteOffset + descriptor.data.byteLength
                );
            new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(arrayBuffer));
            buffer.unmap();
        }

        this.buffers.set(name, buffer);
        return buffer;
    }

    // Storage buffer helper (critical for BVH and geometry data)
    createStorageBuffer(name: string, data: ArrayBufferView, readable = false): GPUBuffer {
        const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | 
                     (readable ? GPUBufferUsage.COPY_SRC : 0);
        
        return this.createBuffer(name, {
            size: data.byteLength,
            usage,
            data,
            label: `Storage Buffer: ${name}`
        });
    }

    // Uniform buffer with alignment (WebGPU samples pattern)
    createUniformBuffer(name: string, size: number): GPUBuffer {
        const alignedSize = Math.ceil(size / 256) * 256; // Align to 256 bytes
        return this.createBuffer(name, {
            size: alignedSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: `Uniform Buffer: ${name}`
        });
    }

    // Texture creation following samples patterns
    createTexture(name: string, descriptor: GPUTextureDescriptor): GPUTexture {
        const texture = this.device.createTexture({
            ...descriptor,
            label: descriptor.label || name
        });
        this.textures.set(name, texture);
        return texture;
    }

    // Storage texture for compute shaders (raytracing output)
    createStorageTexture(name: string, width: number, height: number, format: GPUTextureFormat = 'rgba8unorm'): GPUTexture {
        return this.createTexture(name, {
            size: [width, height],
            format,
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
            label: `Storage Texture: ${name}`
        });
    }

    // G-Buffer creation with proper MRT setup
    createGBuffer(name: string, width: number, height: number): {
        position: GPUTexture;
        normal: GPUTexture;
        albedo: GPUTexture;
        depth: GPUTexture;
    } {
        const position = this.createTexture(`${name}_position`, {
            size: [width, height],
            format: 'rgba32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });

        const normal = this.createTexture(`${name}_normal`, {
            size: [width, height],
            format: 'rgba16float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });

        const albedo = this.createTexture(`${name}_albedo`, {
            size: [width, height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });

        const depth = this.createTexture(`${name}_depth`, {
            size: [width, height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });

        return { position, normal, albedo, depth };
    }

    // Shader module caching (from samples)
    async createShaderModule(name: string, code: string): Promise<GPUShaderModule> {
        if (this.shaderModules.has(name)) {
            return this.shaderModules.get(name)!;
        }

        const module = this.device.createShaderModule({
            code,
            label: `Shader: ${name}`
        });

        this.shaderModules.set(name, module);
        return module;
    }

    // Bind group creation with caching
    createBindGroup(name: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[]): GPUBindGroup {
        const bindGroup = this.device.createBindGroup({
            layout,
            entries,
            label: `Bind Group: ${name}`
        });
        this.bindGroups.set(name, bindGroup);
        return bindGroup;
    }

    // Resource cleanup
    destroyBuffer(name: string): void {
        const buffer = this.buffers.get(name);
        if (buffer) {
            buffer.destroy();
            this.buffers.delete(name);
        }
    }

    destroyTexture(name: string): void {
        const texture = this.textures.get(name);
        if (texture) {
            texture.destroy();
            this.textures.delete(name);
        }
    }

    // Cleanup all resources
    destroy(): void {
        this.buffers.forEach(buffer => buffer.destroy());
        this.textures.forEach(texture => texture.destroy());
        this.buffers.clear();
        this.textures.clear();
        this.bindGroups.clear();
        this.pipelines.clear();
        this.shaderModules.clear();
    }

    // Getters
    getBuffer(name: string): GPUBuffer | undefined {
        return this.buffers.get(name);
    }

    getTexture(name: string): GPUTexture | undefined {
        return this.textures.get(name);
    }

    getBindGroup(name: string): GPUBindGroup | undefined {
        return this.bindGroups.get(name);
    }

    getPipeline(name: string): GPURenderPipeline | GPUComputePipeline | undefined {
        return this.pipelines.get(name);
    }

    // FIXED: This method was missing - Debug/monitoring helper
    getResourceStats(): {
        buffers: number;
        textures: number;
        bindGroups: number;
        pipelines: number;
        shaderModules: number;
    } {
        return {
            buffers: this.buffers.size,
            textures: this.textures.size,
            bindGroups: this.bindGroups.size,
            pipelines: this.pipelines.size,
            shaderModules: this.shaderModules.size
        };
    }
}