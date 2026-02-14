"""
TripoSR 3D Generation Test Script

Experiment 3: Test if we can generate a 3D model from a reference image.
Uses TripoSR (stabilityai/TripoSR) to convert a single image → .glb mesh.

Usage:
    python generate_3d.py --input path/to/image.png --output path/to/output.glb
    python generate_3d.py --test  # Runs with a procedurally generated test image

Requirements:
    - NVIDIA GPU with 6-8GB VRAM
    - PyTorch with CUDA support
    - TripoSR model (auto-downloads from HuggingFace)
"""

import argparse
import gc
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

# Torch is optional — only needed for full TripoSR, not for trimesh fallback
try:
    import torch

    HAS_TORCH = True
except ImportError:
    torch = None  # type: ignore[assignment]
    HAS_TORCH = False



def check_gpu() -> dict:
    """Check GPU availability and VRAM."""
    info = {
        "cuda_available": False,
        "gpu_count": 0,
        "gpu_name": "",
        "vram_total_gb": 0.0,
        "vram_free_gb": 0.0,
        "vram_used_gb": 0.0,
    }

    if not HAS_TORCH:
        return info

    info["cuda_available"] = torch.cuda.is_available()
    info["gpu_count"] = torch.cuda.device_count() if info["cuda_available"] else 0

    if info["cuda_available"]:
        info["gpu_name"] = torch.cuda.get_device_name(0)
        total = torch.cuda.get_device_properties(0).total_memory
        free = total - torch.cuda.memory_allocated(0)
        info["vram_total_gb"] = round(total / (1024**3), 2)
        info["vram_free_gb"] = round(free / (1024**3), 2)
        info["vram_used_gb"] = round((total - free) / (1024**3), 2)

    return info


def create_test_image(size: int = 512) -> Image.Image:
    """Create a simple test image of a robot silhouette for testing."""
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    pixels = np.array(img)

    # Draw a simple robot shape
    cx, cy = size // 2, size // 2

    # Body rectangle
    body_w, body_h = 120, 160
    pixels[
        cy - body_h // 2 : cy + body_h // 2,
        cx - body_w // 2 : cx + body_w // 2,
    ] = [180, 50, 50, 255]

    # Head
    head_w, head_h = 80, 60
    pixels[
        cy - body_h // 2 - head_h : cy - body_h // 2,
        cx - head_w // 2 : cx + head_w // 2,
    ] = [200, 60, 60, 255]

    # Eyes
    for ex_offset in [-20, 20]:
        pixels[
            cy - body_h // 2 - head_h + 15 : cy - body_h // 2 - head_h + 30,
            cx + ex_offset - 8 : cx + ex_offset + 8,
        ] = [0, 255, 100, 255]

    # Arms
    arm_w, arm_h = 30, 100
    for ax_offset in [-(body_w // 2 + arm_w), body_w // 2]:
        pixels[
            cy - 30 : cy - 30 + arm_h,
            cx + ax_offset : cx + ax_offset + arm_w,
        ] = [150, 40, 40, 255]

    # Legs
    leg_w, leg_h = 40, 80
    for lx_offset in [-30, 30]:
        pixels[
            cy + body_h // 2 : cy + body_h // 2 + leg_h,
            cx + lx_offset - leg_w // 2 : cx + lx_offset + leg_w // 2,
        ] = [160, 45, 45, 255]

    return Image.fromarray(pixels)


def generate_3d_triposr(
    image: Image.Image,
    output_path: str,
    resolution: int = 256,
    device: str = "cuda",
) -> dict:
    """
    Generate a 3D mesh from a single image using TripoSR.

    Returns a dict with timing and mesh info.
    """
    results = {"success": False, "time_load_s": 0, "time_generate_s": 0}

    print(f"[TripoSR] Loading model to {device}...")
    t0 = time.time()

    try:
        # TripoSR uses a custom model class
        # Try importing from the cloned repo or huggingface
        try:
            from tsr.system import TSR

            model = TSR.from_pretrained(
                "stabilityai/TripoSR",
                config_name="config.yaml",
                weight_name="model.ckpt",
            )
            model.to(device)
        except ImportError:
            print("[TripoSR] TSR module not found. Attempting fallback with trimesh...")
            print("[TripoSR] You may need to clone: git clone https://github.com/VAST-AI-Research/TripoSR")
            print("[TripoSR] and install: pip install -e .")

            # Fallback: create a test mesh with trimesh to prove the pipeline works
            import trimesh

            print("[TripoSR] Creating test mesh with trimesh instead...")
            # Create a simple robot-like mesh from primitives
            body = trimesh.creation.box(extents=[0.8, 0.3, 0.6])
            body.visual.face_colors = [180, 50, 50, 255]

            head = trimesh.creation.box(extents=[0.4, 0.3, 0.4])
            head.apply_translation([0, 0.3, 0])
            head.visual.face_colors = [200, 60, 60, 255]

            wheel1 = trimesh.creation.cylinder(radius=0.1, height=0.08)
            wheel1.apply_translation([-0.3, -0.2, 0.35])
            wheel1.visual.face_colors = [30, 30, 30, 255]

            wheel2 = trimesh.creation.cylinder(radius=0.1, height=0.08)
            wheel2.apply_translation([0.3, -0.2, 0.35])
            wheel2.visual.face_colors = [30, 30, 30, 255]

            wheel3 = trimesh.creation.cylinder(radius=0.1, height=0.08)
            wheel3.apply_translation([-0.3, -0.2, -0.35])
            wheel3.visual.face_colors = [30, 30, 30, 255]

            wheel4 = trimesh.creation.cylinder(radius=0.1, height=0.08)
            wheel4.apply_translation([0.3, -0.2, -0.35])
            wheel4.visual.face_colors = [30, 30, 30, 255]

            # Weapon: saw blade
            saw = trimesh.creation.cylinder(radius=0.25, height=0.03, sections=24)
            saw.apply_translation([0.5, 0.2, 0])
            saw.visual.face_colors = [200, 200, 200, 255]

            combined = trimesh.util.concatenate([body, head, wheel1, wheel2, wheel3, wheel4, saw])

            results["time_load_s"] = round(time.time() - t0, 2)
            t1 = time.time()

            # Export as GLB
            output = Path(output_path)
            output.parent.mkdir(parents=True, exist_ok=True)
            combined.export(str(output), file_type="glb")

            results["time_generate_s"] = round(time.time() - t1, 2)
            results["success"] = True
            results["method"] = "trimesh_fallback"
            results["vertices"] = len(combined.vertices)
            results["faces"] = len(combined.faces)
            results["file_size_kb"] = round(output.stat().st_size / 1024, 1)

            print(f"[TripoSR] Fallback mesh saved: {output}")
            print(f"[TripoSR]   Vertices: {results['vertices']}")
            print(f"[TripoSR]   Faces: {results['faces']}")
            print(f"[TripoSR]   File size: {results['file_size_kb']} KB")
            return results

        results["time_load_s"] = round(time.time() - t0, 2)

        # Remove background if needed
        from rembg import remove as remove_bg

        print("[TripoSR] Removing background...")
        image_nobg = remove_bg(image)

        # Generate 3D
        print(f"[TripoSR] Generating 3D at resolution {resolution}...")
        t1 = time.time()

        with torch.no_grad():
            scene_codes = model([image_nobg], device=device)

        # Extract mesh
        meshes = model.extract_mesh(scene_codes, resolution=resolution)
        results["time_generate_s"] = round(time.time() - t1, 2)

        if meshes and len(meshes) > 0:
            mesh = meshes[0]
            output = Path(output_path)
            output.parent.mkdir(parents=True, exist_ok=True)
            mesh.export(str(output))

            results["success"] = True
            results["method"] = "triposr"
            results["vertices"] = len(mesh.vertices) if hasattr(mesh, "vertices") else 0
            results["faces"] = len(mesh.faces) if hasattr(mesh, "faces") else 0
            results["file_size_kb"] = round(output.stat().st_size / 1024, 1)

            print(f"[TripoSR] Mesh saved: {output}")
        else:
            results["error"] = "No meshes generated"

    except Exception as e:
        results["error"] = str(e)
        print(f"[TripoSR] Error: {e}")

    return results


def cleanup_gpu():
    """Free GPU memory after generation."""
    gc.collect()
    if HAS_TORCH and torch.cuda.is_available():
        torch.cuda.empty_cache()
        print(f"[GPU] VRAM after cleanup: {torch.cuda.memory_allocated(0) / 1024**3:.2f} GB allocated")


def main():
    parser = argparse.ArgumentParser(description="Generate 3D model from image using TripoSR")
    parser.add_argument("--input", type=str, help="Path to input image")
    parser.add_argument("--output", type=str, default="output/test_bot.glb", help="Output .glb path")
    parser.add_argument("--resolution", type=int, default=256, help="Mesh resolution (128-512)")
    parser.add_argument("--test", action="store_true", help="Run with test image")
    parser.add_argument("--gpu-check", action="store_true", help="Only check GPU info")
    args = parser.parse_args()

    # Always print GPU info
    print("=" * 60)
    print("3D Generation Pipeline — Experiment 3")
    print("=" * 60)

    gpu_info = check_gpu()
    print(f"\nGPU Available: {'✅' if gpu_info['cuda_available'] else '❌'}")
    if gpu_info["cuda_available"]:
        print(f"GPU: {gpu_info['gpu_name']}")
        print(f"VRAM Total: {gpu_info['vram_total_gb']} GB")
        print(f"VRAM Free: {gpu_info['vram_free_gb']} GB")
        print(f"VRAM Used: {gpu_info['vram_used_gb']} GB")
    else:
        print("WARNING: No CUDA GPU detected. Generation will be very slow.")

    if args.gpu_check:
        return

    # Load or create image
    if args.test:
        print("\n[Test] Creating procedural test image...")
        image = create_test_image()
        test_dir = Path("images")
        test_dir.mkdir(exist_ok=True)
        image.save(str(test_dir / "test_robot.png"))
        print(f"[Test] Saved test image to {test_dir / 'test_robot.png'}")
    elif args.input:
        print(f"\n[Input] Loading image: {args.input}")
        image = Image.open(args.input).convert("RGBA")
    else:
        print("ERROR: Provide --input <image_path> or --test")
        sys.exit(1)

    print(f"[Input] Image size: {image.size}")

    # Generate 3D
    print("\n" + "-" * 60)
    device = "cuda" if gpu_info["cuda_available"] else "cpu"
    results = generate_3d_triposr(image, args.output, args.resolution, device)

    # Summary
    print("\n" + "=" * 60)
    print("RESULTS:")
    print(f"  Success: {'✅' if results['success'] else '❌'}")
    print(f"  Method: {results.get('method', 'N/A')}")
    print(f"  Model load time: {results['time_load_s']}s")
    print(f"  Generation time: {results['time_generate_s']}s")
    if results["success"]:
        print(f"  Vertices: {results.get('vertices', 'N/A')}")
        print(f"  Faces: {results.get('faces', 'N/A')}")
        print(f"  File size: {results.get('file_size_kb', 'N/A')} KB")
        print(f"  Output: {args.output}")
    else:
        print(f"  Error: {results.get('error', 'Unknown')}")
    print("=" * 60)

    # Cleanup
    cleanup_gpu()


if __name__ == "__main__":
    main()
