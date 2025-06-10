// File: src/renderer/PipelineManager.ts
// Path: src/renderer/PipelineManager.ts
// Description: Advanced pipeline management system following WebGPU samples patterns.
// Provides centralized pipeline creation, caching, and bind group layout management for complex rendering.

export interface PipelineDescriptor {
    label: string;
    shaderPath: string;
    bindGroupLayouts?: GPUBindGroupLayout[];
    vertexBuffers?: GPUVertexBufferLayout[];
    targets?: GPUColorTargetState[];
    depthStencil?: GPUDepthStencilState;
    primitive?: GPUPrimitiveState;
    multisample?: GPUMultisampleState;
}

export interface ComputePipelineDescriptor {
    label: string;
    shaderPath: string;
    bindGroupLayouts?: GPUBindGroupLayout[];
    entryPoint?: string;
}

export class PipelineManager {
    private device: GPUDevice;
    private renderPipelines: Map<string, GPURenderPipeline> = new Map();
    private computePipelines: Map<string, GPUComputePipeline> = new Map();
    private shaderCache: Map<string, GPUShaderModule> = new Map();
    private bindGroupLayoutCache: Map<string, GPUBindGroupLayout> = new Map();

    constructor(device: GPUDevice) {
        this.device = device;
        console.log('PipelineManager: Initialized');
    }

    // Create optimized bind group layouts (following samples pattern)
    createBindGroupLayout(name: string, entries: GPUBindGroupLayoutEntry[]): GPUBindGroupLayout {
        if (this.bindGroupLayoutCache.has(name)) {
            console.log(`PipelineManager: Reusing cached bind group layout: ${name}`);
            return this.bindGroupLayoutCache.get(name)!;
        }

        const layout = this.device.createBindGroupLayout({
            label: `Bind Group Layout: ${name}`,
            entries
        });

        this.bindGroupLayoutCache.set(name, layout);
        console.log(`PipelineManager: Created bind group layout: ${name}`);
        return layout;
    }

    // Shader loading with caching (from samples)
    async loadShader(path: string): Promise<GPUShaderModule> {
        if (this.shaderCache.has(path)) {
            console.log(`PipelineManager: Reusing cached shader: ${path}`);
            return this.shaderCache.get(path)!;
        }

        try {
            console.log(`PipelineManager: Loading shader: ${path}`);
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load shader: ${path} - ${response.statusText}`);
            }
            const code = await response.text();
            
            const module = this.device.createShaderModule({
                code,
                label: `Shader: ${path}`
            });

            this.shaderCache.set(path, module);
            console.log(`PipelineManager: Shader loaded successfully: ${path}`);
            return module;
        } catch (error) {
            console.error(`PipelineManager: Error loading shader ${path}:`, error);
            throw error;
        }
    }

    // Create render pipeline with optimized defaults (samples pattern)
    async createRenderPipeline(name: string, descriptor: PipelineDescriptor): Promise<GPURenderPipeline> {
        if (this.renderPipelines.has(name)) {
            console.log(`PipelineManager: Reusing cached render pipeline: ${name}`);
            return this.renderPipelines.get(name)!;
        }

        console.log(`PipelineManager: Creating render pipeline: ${name}`);

        const shaderModule = await this.loadShader(descriptor.shaderPath);
        
        // Default bind group layouts if not provided
        const bindGroupLayouts = descriptor.bindGroupLayouts || [
            this.createStandardSceneLayout(),
            this.createStandardModelLayout()
        ];

        const pipelineLayout = this.device.createPipelineLayout({
            label: `Pipeline Layout: ${name}`,
            bindGroupLayouts
        });

        const pipeline = this.device.createRenderPipeline({
            label: descriptor.label,
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: descriptor.vertexBuffers || this.getStandardVertexBuffers()
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: descriptor.targets || [
                    { format: 'bgra8unorm' } // Default canvas format
                ]
            },
            primitive: descriptor.primitive || {
                topology: 'triangle-list',
                cullMode: 'back',
                frontFace: 'ccw'
            },
            depthStencil: descriptor.depthStencil,
            multisample: descriptor.multisample
        });

        this.renderPipelines.set(name, pipeline);
        console.log(`PipelineManager: Render pipeline created: ${name}`);
        return pipeline;
    }

    // Create compute pipeline (following samples patterns)
    async createComputePipeline(name: string, descriptor: ComputePipelineDescriptor): Promise<GPUComputePipeline> {
        if (this.computePipelines.has(name)) {
            console.log(`PipelineManager: Reusing cached compute pipeline: ${name}`);
            return this.computePipelines.get(name)!;
        }

        console.log(`PipelineManager: Creating compute pipeline: ${name}`);

        const shaderModule = await this.loadShader(descriptor.shaderPath);
        
        const bindGroupLayouts = descriptor.bindGroupLayouts || [];
        const pipelineLayout = bindGroupLayouts.length > 0 
            ? this.device.createPipelineLayout({
                label: `Compute Pipeline Layout: ${name}`,
                bindGroupLayouts
            })
            : 'auto';

        const pipeline = this.device.createComputePipeline({
            label: descriptor.label,
            layout: pipelineLayout,
            compute: {
                module: shaderModule,
                entryPoint: descriptor.entryPoint || 'main'
            }
        });

        this.computePipelines.set(name, pipeline);
        console.log(`PipelineManager: Compute pipeline created: ${name}`);
        return pipeline;
    }

    // Standard layouts for common use cases (from samples)
    private createStandardSceneLayout(): GPUBindGroupLayout {
        return this.createBindGroupLayout('scene', [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            }
        ]);
    }

    private createStandardModelLayout(): GPUBindGroupLayout {
        return this.createBindGroupLayout('model', [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            }
        ]);
    }

    // Standard vertex buffer layout (from samples)
    private getStandardVertexBuffers(): GPUVertexBufferLayout[] {
        return [{
            arrayStride: 6 * 4, // position(3) + normal(3)
            attributes: [
                {
                    shaderLocation: 0,
                    offset: 0,
                    format: 'float32x3' // position
                },
                {
                    shaderLocation: 1,
                    offset: 3 * 4,
                    format: 'float32x3' // normal
                }
            ]
        }];
    }

    // G-Buffer pipeline creation (for deferred rendering)
    async createGBufferPipeline(canvasFormat: GPUTextureFormat): Promise<GPURenderPipeline> {
        const bindGroupLayouts = [
            this.createBindGroupLayout('gbuffer_scene', [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }
            ]),
            this.createBindGroupLayout('gbuffer_model', [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }
            ])
        ];

        return this.createRenderPipeline('gbuffer', {
            label: 'G-Buffer Pipeline',
            shaderPath: './dist/shaders/gbuffer.wgsl',
            bindGroupLayouts,
            targets: [
                { format: 'rgba32float' }, // Position
                { format: 'rgba16float' }, // Normal
                { format: 'rgba8unorm' }   // Albedo
            ],
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less'
            }
        });
    }

    // Composition pipeline for final output
    async createCompositionPipeline(canvasFormat: GPUTextureFormat): Promise<GPURenderPipeline> {
        const bindGroupLayout = this.createBindGroupLayout('composition', [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {}
            }
        ]);

        return this.createRenderPipeline('composition', {
            label: 'Composition Pipeline',
            shaderPath: './dist/shaders/composition.wgsl',
            bindGroupLayouts: [bindGroupLayout],
            vertexBuffers: [], // Fullscreen triangle
            targets: [{ format: canvasFormat }]
        });
    }

    // Raytracing compute pipeline
    async createRaytracingPipeline(): Promise<GPUComputePipeline> {
        const bindGroupLayout = this.createBindGroupLayout('raytracing', [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'storage' }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'uniform' }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: 'write-only',
                    format: 'rgba8unorm',
                    viewDimension: '2d'
                }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'storage' }
            }
        ]);

        return this.createComputePipeline('raytracing', {
            label: 'Raytracing Pipeline',
            shaderPath: './dist/shaders/raytracing.wgsl',
            bindGroupLayouts: [bindGroupLayout]
        });
    }

    // Getters
    getRenderPipeline(name: string): GPURenderPipeline | undefined {
        return this.renderPipelines.get(name);
    }

    getComputePipeline(name: string): GPUComputePipeline | undefined {
        return this.computePipelines.get(name);
    }

    getBindGroupLayout(name: string): GPUBindGroupLayout | undefined {
        return this.bindGroupLayoutCache.get(name);
    }

    // Performance monitoring (from samples)
    getPipelineStats(): {
        renderPipelines: number;
        computePipelines: number;
        shaders: number;
        bindGroupLayouts: number;
    } {
        return {
            renderPipelines: this.renderPipelines.size,
            computePipelines: this.computePipelines.size,
            shaders: this.shaderCache.size,
            bindGroupLayouts: this.bindGroupLayoutCache.size
        };
    }

    // Cleanup
    destroy(): void {
        console.log('PipelineManager: Cleaning up pipelines and shaders');
        console.log('Final pipeline stats:', this.getPipelineStats());
        
        this.renderPipelines.clear();
        this.computePipelines.clear();
        this.shaderCache.clear();
        this.bindGroupLayoutCache.clear();
        
        console.log('PipelineManager: Cleanup complete');
    }
}