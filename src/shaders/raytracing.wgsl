// File: src/shaders/raytracing.wgsl
// Tag: WGSL_BVH_TRAVERSAL
// Description: Upgrades the raytracing compute shader to use a BVH for acceleration.
// This replaces the simple sphere loop with a stack-based BVH traversal algorithm.

struct Sphere {
    center: vec3<f32>,
    radius: f32,
    color: vec3<f32>,
    material: u32,
};

struct Uniforms {
    camera_pos: vec3<f32>,
    _p1: f32, // Padding
    screen_dims: vec2<f32>,
    time: f32,
    _p2: f32, // Padding
};

// A BVH node structure that matches the layout in BVH.ts
// 8 floats total (2x vec4)
struct BVHNode {
    // min.xyz, min.w = left_child_or_primitive_index
    min: vec4<f32>,
    // max.xyz, max.w = primitive_count (if > 0, it's a leaf)
    max: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> spheres: array<Sphere>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;
@group(0) @binding(2) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<storage, read> bvh: array<BVHNode>;
// TODO: Add storage buffers for vertices and indices for triangle meshes

struct HitRecord {
    t: f32,
    p: vec3<f32>,
    normal: vec3<f32>,
    color: vec3<f32>,
    material: u32,
};

// Function to intersect a ray with an Axis-Aligned Bounding Box (AABB)
fn intersect_ray_aabb(ray_origin: vec3<f32>, inv_dir: vec3<f32>, node: BVHNode) -> bool {
    let tmin = (node.min.xyz - ray_origin) * inv_dir;
    let tmax = (node.max.xyz - ray_origin) * inv_dir;
    let t1 = min(tmin, tmax);
    let t2 = max(tmin, tmax);
    let t_near = max(max(t1.x, t1.y), t1.z);
    let t_far = min(min(t2.x, t2.y), t2.z);
    return t_near <= t_far;
}


@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let screen_dims_u = textureDimensions(output_texture);
    if (global_id.x >= screen_dims_u.x || global_id.y >= screen_dims_u.y) {
        return;
    }

    let screen_coords = vec2<f32>(f32(global_id.x), f32(global_id.y));
    let uv = screen_coords / uniforms.screen_dims;
    
    let aspect_ratio = uniforms.screen_dims.x / uniforms.screen_dims.y;
    var ray_dir = normalize(vec3<f32>((uv.x - 0.5) * aspect_ratio, -(uv.y - 0.5), -1.0));
    var ray_origin = uniforms.camera_pos;

    var final_color = vec3(0.0);
    var attenuation = vec3(1.0);
    let max_bounces = 4;

    for (var i = 0; i < max_bounces; i = i + 1) {
        var hit_rec: HitRecord;
        var closest_so_far = 10000.0;
        var hit = false;
        
        // --- BVH Traversal ---
        var stack: array<i32, 32>;
        var stack_ptr = 0;
        stack[0] = 0; // Start at the root node
        let inv_dir = 1.0 / ray_dir;

        while(stack_ptr >= 0) {
            let node_idx = u32(stack[stack_ptr]);
            stack_ptr = stack_ptr - 1;
            let node = bvh[node_idx];

            if (!intersect_ray_aabb(ray_origin, inv_dir, node)) {
                continue;
            }

            // If node.max.w > 0, this is a leaf node
            if (node.max.w > 0.0) {
                let prim_count = u32(node.max.w);
                let first_prim = u32(node.min.w);

                // --- Placeholder: Intersect with actual geometry (spheres for now) ---
                // TODO: Replace this with ray-triangle intersection using vertex/index buffers
                for (var s = first_prim; s < first_prim + prim_count; s = s + 1u) {
                    let sphere = spheres[s];
                    let oc = ray_origin - sphere.center;
                    let a = dot(ray_dir, ray_dir);
                    let b = 2.0 * dot(oc, ray_dir);
                    let c = dot(oc, oc) - sphere.radius * sphere.radius;
                    let discriminant = b * b - 4.0 * a * c;

                    if (discriminant > 0.0) {
                        let t = (-b - sqrt(discriminant)) / (2.0 * a);
                        if (t > 0.001 && t < closest_so_far) {
                            closest_so_far = t;
                            hit = true;
                            hit_rec.t = t;
                            hit_rec.p = ray_origin + t * ray_dir;
                            hit_rec.normal = normalize(hit_rec.p - sphere.center);
                            hit_rec.color = sphere.color;
                            hit_rec.material = sphere.material;
                        }
                    }
                }
            } else { // This is an internal node, push children to stack
                let left_child_idx = i32(node.min.w);
                // In a contiguous layout, right child is just after the left
                let right_child_idx = left_child_idx + 1;

                // Push right child then left, so we traverse left first
                stack_ptr = stack_ptr + 1;
                stack[stack_ptr] = right_child_idx;
                stack_ptr = stack_ptr + 1;
                stack[stack_ptr] = left_child_idx;
            }
        }
        // --- End BVH Traversal ---


        if (hit) {
            let light_dir = normalize(vec3(sin(uniforms.time * 0.5), 1.0, cos(uniforms.time * 0.5)));
            let diffuse_light = max(0.0, dot(hit_rec.normal, light_dir));
            let ambient = 0.1 * hit_rec.color;
            let diffuse = diffuse_light * hit_rec.color;
            
            final_color = final_color + (ambient + diffuse) * attenuation;

            if (hit_rec.material == 1u) { // Metallic
                ray_origin = hit_rec.p;
                ray_dir = reflect(ray_dir, hit_rec.normal);
                attenuation = attenuation * 0.6;
            } else {
                break;
            }
        } else {
            let unit_dir = normalize(ray_dir);
            let t = 0.5 * (unit_dir.y + 1.0);
            final_color = final_color + ((1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0)) * attenuation;
            break;
        }
    }

    textureStore(output_texture, global_id.xy, vec4(sqrt(final_color), 1.0));
}