// File: src/shaders/lit.wgsl

// This struct will be sent from the vertex shader to the fragment shader.
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) world_pos: vec3<f32>,
};

// Uniforms that are the same for all objects in a draw call.
struct SceneUniforms {
    view_proj_matrix: mat4x4<f32>,
    light_pos: vec4<f32>,
    camera_pos: vec4<f32>,
};

// Uniforms that can be different for each object.
struct ModelUniforms {
    model_matrix: mat4x4<f32>,
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> model: ModelUniforms;

@vertex
fn vs_main(
    @location(0) pos: vec3<f32>,
    @location(1) normal: vec3<f32>
) -> VertexOutput {
    var output: VertexOutput;
    let world_pos = model.model_matrix * vec4<f32>(pos, 1.0);
    output.world_pos = world_pos.xyz;
    output.position = scene.view_proj_matrix * world_pos;
    // Transform the normal into world space
    output.normal = (model.model_matrix * vec4<f32>(normal, 0.0)).xyz;
    return output;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.normal);
    let light_dir = normalize(scene.light_pos.xyz - in.world_pos);
    let view_dir = normalize(scene.camera_pos.xyz - in.world_pos);
    
    // Ambient light
    let ambient_strength = 0.1;
    let ambient = ambient_strength * model.color;

    // Diffuse light
    let diffuse_strength = max(dot(normal, light_dir), 0.0);
    let diffuse = diffuse_strength * model.color;

    // Specular (Blinn-Phong)
    let halfway_dir = normalize(light_dir + view_dir);
    let spec_angle = max(dot(normal, halfway_dir), 0.0);
    let specular_strength = pow(spec_angle, 32.0);
    let specular = specular_strength * vec4(1.0, 1.0, 1.0, 1.0);

    return ambient + diffuse + specular;
}
