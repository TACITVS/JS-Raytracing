// Define the data structure for a single sphere
struct Sphere {
    center: vec3<f32>,
    radius: f32,
    color: vec3<f32>,
    material: u32, // 0: Diffuse, 1: Metallic
};

// Uniforms are constant for the entire shader dispatch
struct Uniforms {
    screen_dims: vec2<f32>,
    camera_pos: vec3<f32>,
    time: f32,
};

// This struct holds all the spheres in our scene
@group(0) @binding(0) var<storage, read> spheres: array<Sphere>;
// This holds the uniform data
@group(0) @binding(1) var<uniform> uniforms: Uniforms;
// This is the output texture that our shader will write to
@group(0) @binding(2) var<storage, write> output_texture: texture_storage_2d<rgba8unorm, write>;

// A struct to hold information about a ray-object intersection
struct HitRecord {
    t: f32,
    p: vec3<f32>,
    normal: vec3<f32>,
    color: vec3<f32>,
    material: u32,
};

// The raytracing work happens here. This function is called for every pixel.
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let screen_coords = vec2<f32>(f32(global_id.x), f32(global_id.y));

    // Prevent shader from writing outside the texture bounds
    let screen_dims = textureDimensions(output_texture);
    if (global_id.x >= screen_dims.x || global_id.y >= screen_dims.y) {
        return;
    }

    // Convert pixel coordinates to UV coordinates (0.0 to 1.0)
    let uv = screen_coords / uniforms.screen_dims;
    
    // Create a ray shooting from the camera through the current pixel
    let aspect_ratio = uniforms.screen_dims.x / uniforms.screen_dims.y;
    let ray_dir = normalize(vec3<f32>((uv.x - 0.5) * aspect_ratio, -(uv.y - 0.5), -1.0));
    var ray_origin = uniforms.camera_pos;

    var final_color = vec3(0.0);
    var attenuation = vec3(1.0);
    let max_bounces = 4;

    // Ray bouncing loop for reflections
    for (var i = 0; i < max_bounces; i = i + 1) {
        var hit_rec: HitRecord;
        var closest_so_far = 10000.0;
        var hit = false;

        // Loop through all spheres to find the closest intersection
        for (var s = 0; s < arrayLength(&spheres); s = s + 1) {
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

        if (hit) {
            let light_dir = normalize(vec3(sin(uniforms.time), 1.0, cos(uniforms.time) * 0.5));
            let diffuse_light = max(0.0, dot(hit_rec.normal, light_dir));

            let ambient = 0.1 * hit_rec.color;
            let diffuse = diffuse_light * hit_rec.color;
            
            final_color = final_color + (ambient + diffuse) * attenuation;

            // Handle reflections for metallic spheres
            if (hit_rec.material == 1u) { // Metallic
                ray_origin = hit_rec.p;
                ray_dir = reflect(ray_dir, hit_rec.normal);
                attenuation = attenuation * 0.6; // Energy loss on bounce
            } else { // Diffuse
                break; // Stop bouncing for non-reflective surfaces
            }
        } else {
            // Background color (a simple gradient)
            let unit_dir = normalize(ray_dir);
            let t = 0.5 * (unit_dir.y + 1.0);
            final_color = final_color + ((1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0)) * attenuation;
            break;
        }
    }

    // Write the final calculated color to the output texture
    textureStore(output_texture, global_id.xy, vec4(sqrt(final_color), 1.0)); // Apply gamma correction
}
