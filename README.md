# JS Raytracing Engine

This repository contains an experimental WebGPU based game engine. The project uses a simple Entity Component System (ECS) via [bitECS](https://github.com/NateTheGreatt/bitECS) and demonstrates minimal WebGPU initialization.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript sources:
   ```bash
   npm run build
   ```

3. Open `index.html` in a browser with WebGPU support.

## Goals

The engine aims to follow the development plan outlined in the project description including hybrid rasterization and compute raytracing in the future.
