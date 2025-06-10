// File: src/Engine.ts
// Path: src/Engine.ts
// Description: Enhanced Engine class that leverages the new ResourceManager and capability detection.
// Provides better debugging information and prepares the foundation for optimized rendering systems.

import { createWorld, IWorld } from 'bitecs';
import { Renderer } from './renderer/Renderer.js';
import { TransformSystem } from './ecs/systems/TransformSystem.js';

export class Engine {
    public world: IWorld;
    public renderer!: Renderer;

    private lastTime = 0;

    constructor() {
        this.world = createWorld();
    }

    /**
     * Initializes the engine, sets up the renderer, and starts the main loop.
     * Now includes enhanced capability detection and resource management logging.
     */
    async startup() {
        const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        if (!canvas) throw new Error('Canvas element with ID "webgpu-canvas" not found.');

        // Initialize the enhanced renderer
        this.renderer = await Renderer.getInstance(canvas);

        // Enhanced logging for debugging WebGPU setup
        console.log('=== Engine Initialization Complete ===');
        console.log('Canvas size:', this.renderer.canvasSize);
        console.log('Preferred format:', this.renderer.format);
        
        // Log WebGPU capabilities for debugging browser/GPU issues
        const debugInfo = this.renderer.getDebugInfo();
        console.log('WebGPU Capabilities:', {
            timestamps: debugInfo.capabilities.supportsTimestamps,
            f16: debugInfo.capabilities.supportsF16,
            maxWorkgroupInvocations: debugInfo.capabilities.computeWorkgroupLimits.maxInvocations,
            maxStorageBufferSize: debugInfo.capabilities.storageBufferLimits.maxBindingSize
        });

        // Log initial resource state
        console.log('Initial resource stats:', debugInfo.resourceStats);
        console.log('=====================================');

        // TODO: Initialize entities and other systems here.
        // For example:
        // - Create a camera entity
        // - Load a scene using the AssetManager
        // - Add Rasterization and Raytracing systems to the update loop

        this.lastTime = performance.now();
        requestAnimationFrame(this.update.bind(this));
    }

    /**
     * The main application loop, called every frame.
     * Enhanced with performance monitoring and resource tracking.
     */
    private update(now: number) {
        const deltaTime = (now - this.lastTime) / 1000.0;
        this.lastTime = now;

        // --- Run all ECS systems in order ---

        // 1. Input System (when implemented)

        // 2. Logic/Update Systems
        TransformSystem(this.world);
        // PhysicsSystem(this.world, deltaTime); // (when implemented)

        // 3. Rendering Systems
        // RasterRenderSystem(this.world, this.renderer); // (when implemented)
        // RaytracingSystem(this.world, this.renderer); // (when implemented)
        // PostProcessingSystem(this.renderer); // (when implemented)

        // Optional: Log resource stats periodically for debugging
        if (Math.floor(now / 1000) % 10 === 0 && Math.floor(now) % 1000 < 16) {
            const stats = this.renderer.resources.getResourceStats();
            if (stats.buffers > 0 || stats.textures > 0) {
                console.log('Resource usage:', stats);
            }
        }

        requestAnimationFrame(this.update.bind(this));
    }

    /**
     * Clean up resources when the engine is destroyed
     */
    destroy(): void {
        console.log('Engine cleanup started...');
        if (this.renderer) {
            const finalStats = this.renderer.resources.getResourceStats();
            console.log('Final resource stats before cleanup:', finalStats);
            this.renderer.destroy();
        }
        console.log('Engine cleanup complete.');
    }

    /**
     * Get current engine statistics for debugging
     */
    getStats(): {
        frameTime: number;
        renderer: ReturnType<Renderer['getDebugInfo']>;
    } {
        return {
            frameTime: this.lastTime,
            renderer: this.renderer.getDebugInfo()
        };
    }
}