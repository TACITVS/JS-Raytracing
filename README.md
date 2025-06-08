# JS Raytracing Engine

This repository contains an experimental WebGPU based game engine. The project uses a simple Entity Component System (ECS) via [bitECS](https://github.com/NateTheGreatt/bitECS) and demonstrates minimal WebGPU initialization.

## Installation

Ensure you have [Node.js](https://nodejs.org/) version 18 or newer available.
Clone the repository and install the dependencies:

```bash
git clone <repository-url>
cd JS-Raytracing
npm install
```

## Building

Compile the TypeScript sources to JavaScript:

```bash
npm run build
```

The generated files are placed in the `dist/` directory.

## Running the Engine

After running `npm run build` start a simple HTTP server from the project root:

```bash
npx http-server .
# or
python -m http.server
```

Then open `http://localhost:8080/raytracing.html` in a WebGPU enabled browser.
You can also visit `scene3d.html` for the rotating cube example.

## Goals

The engine aims to follow the development plan outlined in the project description including hybrid rasterization and compute raytracing in the future.
