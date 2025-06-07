export interface GPUDevice {}
export interface GPUCanvasContext {}
export interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
}
export interface NavigatorGPU {
  gpu?: {
    requestAdapter(): Promise<GPUAdapter | null>;
    getPreferredCanvasFormat(): GPUTextureFormat;
  };
}
export type GPUTextureFormat = any;
