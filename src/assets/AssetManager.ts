// @ts-ignore
import { GltfLoader, GltfAsset } from 'gltf-loader-ts';
import { IWorld } from 'bitecs';
import { Renderer } from '../renderer/Renderer.js';
import { addEntity, addComponent } from 'bitecs';
import { Transform } from '../ecs/components.js';

export class AssetManager {
    private renderer: Renderer;
    private world: IWorld;
    private loader = new GltfLoader();
    private assetCache: Map<string, any> = new Map();

    constructor(renderer: Renderer, world: IWorld) {
        this.renderer = renderer;
        this.world = world;
    }

    /**
     * Loads a GLTF model from a URL. If already cached, returns the cached asset.
     * After loading, it processes the scene and creates entities in the world.
     * @param url The URL of the .gltf or .glb file.
     * @returns A promise that resolves when the asset is loaded and processed.
     */
    public async loadGltf(url: string) {
        if (this.assetCache.has(url)) {
            console.log(`Returning cached asset: ${url}`);
            return this.assetCache.get(url);
        }

        console.log(`Loading asset: ${url}`);
        const asset: GltfAsset = await this.loader.load(url);
        this.assetCache.set(url, asset);
        
        this.processGltf(asset);
    }

    /**
     * Processes a loaded GLTF asset, creating entities and components.
     * @param asset The GltfAsset to process.
     */
    private processGltf(asset: GltfAsset) {
        console.log('Processing GLTF asset:', asset);

        // This is a simplified example of processing. A full implementation is complex.
        // It would involve traversing the scene graph, creating GPU buffers for meshes,
        // creating materials and textures, and spawning entities with all the correct components.

        // Example: Create entities for each node in the default scene
        const scene = asset.gltf.scenes?.[asset.gltf.scene ?? 0];
        if (scene?.nodes) {
            for (const nodeIndex of scene.nodes) {
                this.processGltfNode(asset, nodeIndex);
            }
        }
    }

    private processGltfNode(asset: GltfAsset, nodeIndex: number) {
        const node = asset.gltf.nodes?.[nodeIndex];
        if (!node) return;

        const eid = addEntity(this.world);
        addComponent(this.world, Transform, eid);

        // Set transform from the GLTF node
        if (node.translation) {
            Transform.position.x[eid] = node.translation[0];
            Transform.position.y[eid] = node.translation[1];
            Transform.position.z[eid] = node.translation[2];
        }
        if (node.rotation) {
            Transform.rotation.x[eid] = node.rotation[0];
            Transform.rotation.y[eid] = node.rotation[1];
            Transform.rotation.z[eid] = node.rotation[2];
            Transform.rotation.w[eid] = node.rotation[3];
        }
        if (node.scale) {
            Transform.scale.x[eid] = node.scale[0];
            Transform.scale.y[eid] = node.scale[1];
            Transform.scale.z[eid] = node.scale[2];
        }

        // TODO: If node has a mesh, create GPU buffers and add a Mesh component.
        // if (node.mesh !== undefined) {
        //     const mesh = asset.gltf.meshes[node.mesh];
        //     // 1. Get vertex/index data using asset.getbufferData(accessor)
        //     // 2. Create GPUBuffer for vertices and indices.
        //     // 3. Add a Mesh component to the entity 'eid' with buffer info.
        // }

        // Recursively process child nodes
        if (node.children) {
            for (const childIndex of node.children) {
                this.processGltfNode(asset, childIndex);
            }
        }
    }
}