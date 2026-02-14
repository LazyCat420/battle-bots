# 3D Bot Parts Library

## Overview

This folder contains the modular 3D parts system for BattleBots. Each part is a procedural Three.js mesh group that can be assembled into complete robots.

## Files

- **parts-library.ts** — Part generators, manifest, and assembly system

## Categories

| Category | Parts | Description |
| --- | --- | --- |
| `body` | tank, dome, wedge, biped | Main chassis/body shapes |
| `weapon` | spinner, saw, hammer, lance, flipper | Attack weapons |
| `locomotion` | wheels, treads, hover | Movement systems |
| `armor` | plow, spikes | Defensive add-ons |

## How Assembly Works

1. **Parts Manifest** defines available parts with attachment points
2. **BotAssembly** blueprint specifies which parts to use and where to attach them
3. **assembleBot()** creates the THREE.Group from a blueprint
4. **animateBotWeapons()** handles per-frame weapon animations

## Phase 1 (Current): Procedural Primitives

All parts are built from Three.js geometry primitives (Box, Cylinder, Sphere, etc.)

## Phase 2 (Future): AI-Generated Meshes

Parts will be replaced by TripoSR-generated `.glb` files from reference images.
