// File: src/shaders/composition.wgsl
// Tag: COMPOSITION_SHADER_FIXED
// Description: Corrects a WebGPU binding error by removing the unused gbuffer_position
// texture, which was being optimized away by the compiler.

// **FIXED**: Removed unused gbuffer_position at binding 0.
// Bindings have been re-numbered to be contiguous (0, 1, 2, 3).
@group(0) @binding(0) var gbuffer_normal: texture_2d<f32>;
@group(0) @binding(1) var gbuffer_albedo: texture_2d<f32>;
@group(0) @binding(2) var raytracing_output: texture_2d<f32>;
@group(0) @binding(3) var screen_sampler: sampler;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) tex_coord: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> VertexOutput {
    // A standard trick to generate a full-screen triangle without needing vertex buffers.
    var output: VertexOutput;
    let x = f32(in_vertex_index % 2u) * 2.0;
    let y = f32(in_vertex_index / 2u) * 2.0;
    output.position = vec4<f32>(x - 1.0, 1.0 - y, 0.0, 1.0);
    output.tex_coord = vec2<f32>(x * 0.5, y * 0.5);
    return output;
}

@fragment
fn fs_main(@location(0) tex_coord: vec2<f32>) -> @location(0) vec4<f32> {
    // We now use the re-numbered bindings.
    let normal = textureSample(gbuffer_normal, screen_sampler, tex_coord).xyz;
    let albedo = textureSample(gbuffer_albedo, screen_sampler, tex_coord).rgb;
    let raytraced_reflection = textureSample(raytracing_output, screen_sampler, tex_coord).rgb;

    // A simple directional light for demonstration.
    let light_dir = normalize(vec3<f32>(0.5, 1.0, -0.5));
    let diffuse_strength = max(dot(normal, light_dir), 0.0);
    
    // Basic lighting model.
    let ambient_light = vec3<f32>(0.1) * albedo;
    let diffuse_light = diffuse_strength * albedo;

    // Combine the rasterized lighting with the raytraced reflections.
    let final_color = ambient_light + diffuse_light + raytraced_reflection;
    
    // Apply gamma correction for a more realistic look.
    let corrected_color = pow(final_color, vec3<f32>(1.0 / 2.2));

    return vec4<f32>(corrected_color, 1.0);
}