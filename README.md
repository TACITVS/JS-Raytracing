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

After building, open `index.html` in a WebGPU capable browser. This page
initializes the engine and runs a simple scene.

## Demonstration

After building the project you can load a small demo that creates and animates
several entities. Open `demo.html` in a WebGPU enabled browser:

```bash
npm run build
open demo.html # or use your preferred browser
```

The demo shows multiple entities rotating while being updated by the ECS every
frame.

## Goals

The engine aims to follow the development plan outlined in the project description including hybrid rasterization and compute raytracing in the future.
