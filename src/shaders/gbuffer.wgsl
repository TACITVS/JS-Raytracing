// File: src/shaders/gbuffer.wgsl
// Tag: GBUFFER_SHADER
// Description: A shader that performs the G-Buffer rasterization pass. It outputs
// world position, normal, and albedo to multiple render targets.

struct SceneUniforms {
    view_proj_matrix: mat4x4<f32>,
    camera_pos: vec3<f32>,
};

struct ModelUniforms {
    model_matrix: mat4x4<f32>,
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> model: ModelUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) world_pos: vec3<f32>,
    @location(1) normal: vec3<f32>,
};

@vertex
fn vs_main(
    @location(0) pos: vec3<f32>,
    @location(1) normal: vec3<f32>
) -> VertexOutput {
    var output: VertexOutput;
    let world_pos = model.model_matrix * vec4<f32>(pos, 1.0);
    output.world_pos = world_pos.xyz;
    output.position = scene.view_proj_matrix * world_pos;
    output.normal = (model.model_matrix * vec4<f32>(normal, 0.0)).xyz;
    return output;
}

// This struct defines the output of our fragment shader.
// Each field corresponds to a color attachment in the render pass.
struct GBufferOutput {
    @location(0) position: vec4<f32>,
    @location(1) normal: vec4<f32>,
    @location(2) albedo: vec4<f32>,
};

@fragment
fn fs_main(in: VertexOutput) -> GBufferOutput {
    var output: GBufferOutput;
    // Store the world position, xyz are position, w can be used for other data if needed.
    output.position = vec4<f32>(in.world_pos, 1.0);
    // Store the normalized normal vector.
    output.normal = vec4<f32>(normalize(in.normal), 1.0);
    // Store the object's base color (albedo).
    output.albedo = model.color;
    return output;
}