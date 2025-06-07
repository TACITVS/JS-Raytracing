export async function initWebGPU(canvas: HTMLCanvasElement): Promise<any> {
  const nav: any = navigator as any;
  if (!nav.gpu) {
    console.error('WebGPU not supported.');
    return null;
  }
  const adapter = await nav.gpu.requestAdapter();
  if (!adapter) {
    console.error('Failed to get GPU adapter');
    return null;
  }
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu') as any;
  const format = nav.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  return device;
}
