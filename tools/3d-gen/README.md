# TripoSR 3D Generation — Test Environment

## Overview

This directory contains the Python tools for generating 3D models from reference images using TripoSR (and optionally SAM3D or Hunyuan3D). These models are exported as `.glb` files and loaded by the Three.js frontend.

## Requirements

- Python 3.10+
- NVIDIA GPU with 6-8GB VRAM (for standard resolution)
- CUDA toolkit matching your PyTorch version

## Setup

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows

# Install PyTorch with CUDA
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install TripoSR dependencies
pip install -r requirements.txt
```

## Usage

```bash
# Generate a single 3D model from an image
python generate_3d.py --input images/robot_body.png --output ../public/parts/robot_body.glb

# Generate all parts in batch
python batch_generate.py --input-dir images/parts/ --output-dir ../public/parts/
```

## Model Comparison

| Model | VRAM | Speed | Quality | Windows | Output |
|-------|------|-------|---------|---------|--------|
| TripoSR | 6-8GB | <1s (A100) | Good | ✅ | .glb/.obj |
| SAM3D | 32GB+ | seconds | Best | ❌ Linux only | .ply/.obj |
| Hunyuan3D 2.1 mini | 3-6GB | ~30s | Good | ✅ | .glb/.obj |
| Trellis | 8-16GB | ~15s | Great | ⚠️ Community | .glb |

## Notes

- LLM must be unloaded from VRAM before running 3D generation
- Use VRAM manager script to handle model swapping
- Generated parts are cached in `../public/parts/` for instant reuse
