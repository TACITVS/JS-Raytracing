// File: src/Engine.ts
// Tag: ENGINE_CLASS_FIXED
// Description: Corrects the import path for TransformSystem to match the new file structure.

import { createWorld, IWorld } from 'bitecs';
import { Renderer } from './renderer/Renderer.js';
// **FIXED**: Corrected the import path to point to the new location of TransformSystem.
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
     */
    async startup() {
        const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        if (!canvas) throw new Error('Canvas element with ID "webgpu-canvas" not found.');

        this.renderer = await Renderer.getInstance(canvas);

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

        requestAnimationFrame(this.update.bind(this));
    }
}