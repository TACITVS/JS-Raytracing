// File: src/shaders/composition.wgsl
// Final composition shader that combines G-buffer and raytracing results

// Input textures
@group(0) @binding(0) var normal_texture: texture_2d<f32>;
@group(0) @binding(1) var albedo_texture: texture_2d<f32>;
@group(0) @binding(2) var raytracing_texture: texture_2d<f32>;
@group(0) @binding(3) var linear_sampler: sampler;

// Vertex shader output
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

// Fullscreen triangle vertex shader
@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
    
    // Generate fullscreen triangle
    let x = f32((vertex_index << 1u) & 2u) - 1.0;
    let y = f32(vertex_index & 2u) - 1.0;
    
    out.position = vec4<f32>(x, y, 0.0, 1.0);
    out.uv = vec2<f32>(x * 0.5 + 0.5, 1.0 - (y * 0.5 + 0.5));
    
    return out;
}

// Fragment shader for final composition
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = in.uv;
    
    // Sample all input textures
    let normal = textureSample(normal_texture, linear_sampler, uv).xyz;
    let albedo = textureSample(albedo_texture, linear_sampler, uv).xyz;
    let raytracing = textureSample(raytracing_texture, linear_sampler, uv).xyz;
    
    // Simple composition: blend raytracing over rasterized result
    // You can make this more sophisticated based on your needs
    
    // Use normal length to determine if pixel was rasterized
    let normal_length = length(normal);
    let has_geometry = normal_length > 0.1;
    
    var final_color: vec3<f32>;
    
    if (has_geometry) {
        // For pixels with geometry, blend raytracing with albedo
        // Simple lighting using normal
        let light_dir = normalize(vec3<f32>(1.0, 1.0, 1.0));
        let lighting = max(dot(normal, light_dir), 0.2); // Ambient + diffuse
        let lit_albedo = albedo * lighting;
        
        // Blend with raytracing (additive for reflections/lighting)
        final_color = lit_albedo + raytracing * 0.5;
    } else {
        // For pixels without geometry, use pure raytracing
        final_color = raytracing;
    }
    
    // Tone mapping and gamma correction
    final_color = final_color / (final_color + vec3<f32>(1.0));
    final_color = pow(final_color, vec3<f32>(1.0 / 2.2));
    
    return vec4<f32>(final_color, 1.0);
}