"""
3D Bot Pipeline — FastAPI Backend Server

Unified API for the 3D bot generation pipeline:
- POST /generate    — Image → 3D mesh via TripoSG
- POST /search-image — Search + background removal
- POST /merge       — Merge multiple GLBs via trimesh
- POST /rig         — Auto-rig via UniRig pipeline
- GET  /status      — GPU/VRAM status
- GET  /health      — Health check

Usage:
    cd tools/3d-gen
    .\\venv\\Scripts\\activate
    uvicorn server:app --host 0.0.0.0 --port 8100 --reload
"""

import json
import logging
import os
import subprocess
import sys
import time
import uuid
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path

import numpy as np
import trimesh
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image
from pydantic import BaseModel

# ── Logging ──────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("pipeline")

# ── Config ───────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent  # battle-bots/
TOOLS_DIR = PROJECT_ROOT / "tools"
UNIRIG_DIR = TOOLS_DIR / "UniRig"
OUTPUT_DIR = PROJECT_ROOT / "public" / "parts" / "generated"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── TripoSG paths ────────────────────────────────────────

TRIPOSG_DIR = Path(__file__).resolve().parent / "TripoSG-model"
TRIPOSG_WEIGHTS = TRIPOSG_DIR / "pretrained_weights" / "TripoSG"
RMBG_WEIGHTS = TRIPOSG_DIR / "pretrained_weights" / "RMBG-1.4"

# Add TripoSG source paths
sys.path.insert(0, str(TRIPOSG_DIR))
sys.path.insert(0, str(TRIPOSG_DIR / "scripts"))

# ── TripoSG lazy loading ────────────────────────────────

triposg_pipe = None
rmbg_net = None


def get_triposg_models():
    """Lazy-load TripoSG pipeline + RMBG on first use."""
    global triposg_pipe, rmbg_net
    if triposg_pipe is not None:
        return triposg_pipe, rmbg_net

    try:
        import torch
        from huggingface_hub import snapshot_download
        from triposg.pipelines.pipeline_triposg import TripoSGPipeline
        from briarmbg import BriaRMBG

        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32

        # Download model weights if not cached
        log.info("Loading TripoSG model (first time downloads ~3GB)...")
        snapshot_download(repo_id="VAST-AI/TripoSG", local_dir=str(TRIPOSG_WEIGHTS))
        snapshot_download(repo_id="briaai/RMBG-1.4", local_dir=str(RMBG_WEIGHTS))

        # Load RMBG for background removal
        rmbg_net = BriaRMBG.from_pretrained(str(RMBG_WEIGHTS)).to(device)
        rmbg_net.eval()
        log.info("RMBG-1.4 loaded for background removal")

        # Load TripoSG pipeline
        triposg_pipe = TripoSGPipeline.from_pretrained(
            str(TRIPOSG_WEIGHTS)
        ).to(device, dtype)
        log.info(f"TripoSG loaded on {device}")

        return triposg_pipe, rmbg_net
    except ImportError as e:
        log.warning(f"TripoSG not installed — /generate unavailable: {e}")
        return None, None
    except Exception as e:
        log.error(f"TripoSG load failed: {e}")
        return None, None


def unload_triposg():
    """Free TripoSG from VRAM when needed by other models."""
    global triposg_pipe, rmbg_net
    if triposg_pipe is not None or rmbg_net is not None:
        import torch

        del triposg_pipe, rmbg_net
        triposg_pipe = None
        rmbg_net = None
        torch.cuda.empty_cache()
        log.info("TripoSG unloaded, VRAM freed")


# ── App ──────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("3D Pipeline Server starting...")
    log.info(f"Output directory: {OUTPUT_DIR}")
    yield
    unload_triposg()
    log.info("3D Pipeline Server stopped")


app = FastAPI(
    title="3D Bot Pipeline",
    description="Local 3D bot generation pipeline: TripoSG + trimesh + UniRig",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ───────────────────────────────────────────────


class GenerateRequest(BaseModel):
    """Request for /generate — image is uploaded as multipart."""

    resolution: int = 256
    bake_texture: bool = False


class MergeRequest(BaseModel):
    """Request for /merge — merge multiple GLB files."""

    parts: list[dict]  # [{path: str, position: [x,y,z], rotation: [x,y,z]}]
    output_name: str = "merged_bot"


class RigRequest(BaseModel):
    """Request for /rig — auto-rig a GLB mesh."""

    glb_path: str
    output_name: str = "rigged_bot"


class SearchImageRequest(BaseModel):
    """Request for /search-image — search + background removal."""

    query: str
    remove_bg: bool = True


# ── Health & Status ──────────────────────────────────────


@app.get("/health")
async def health():
    """Health check."""
    return {"status": "ok", "timestamp": time.time()}


@app.get("/status")
async def status():
    """GPU and VRAM status."""
    gpu_info: dict = {"available": False}
    try:
        import torch

        if torch.cuda.is_available():
            gpu_info = {
                "available": True,
                "name": torch.cuda.get_device_name(0),
                "total_vram_gb": round(
                    torch.cuda.get_device_properties(0).total_mem / 1e9, 2
                ),
                "allocated_gb": round(torch.cuda.memory_allocated(0) / 1e9, 2),
                "reserved_gb": round(torch.cuda.memory_reserved(0) / 1e9, 2),
                "free_gb": round(
                    (
                        torch.cuda.get_device_properties(0).total_mem
                        - torch.cuda.memory_reserved(0)
                    )
                    / 1e9,
                    2,
                ),
            }
    except Exception as e:
        log.warning(f"GPU status check failed: {e}")
        gpu_info = {"available": False, "error": str(e)}

    try:
        generated = len(list(OUTPUT_DIR.glob("*.glb")))
    except Exception:
        generated = 0

    return {
        "gpu": gpu_info,
        "triposg_loaded": triposg_pipe is not None,
        "output_dir": str(OUTPUT_DIR),
        "generated_parts": generated,
    }


# ── POST /generate — Image → 3D Mesh ────────────────────


@app.post("/generate")
async def generate_3d(
    file: UploadFile = File(...),
    num_inference_steps: int = 50,
    guidance_scale: float = 7.0,
    seed: int = 42,
    faces: int = -1,
):
    """Generate a 3D .glb mesh from an uploaded image using TripoSG."""
    pipe, rmbg = get_triposg_models()
    if pipe is None:
        raise HTTPException(
            503,
            "TripoSG model not available. Install dependencies first.",
        )

    try:
        import torch
        from image_process import prepare_image
        import tempfile

        # Read image and save to temp file (prepare_image needs file path)
        image_data = await file.read()
        image = Image.open(BytesIO(image_data))
        log.info(
            f"Generating 3D from image: {file.filename} ({image.size[0]}x{image.size[1]})"
        )

        # Save to temp file for prepare_image
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            image.save(tmp, format="PNG")
            tmp_path = tmp.name

        try:
            # TripoSG preprocessing: bg removal + crop + pad
            img_pil = prepare_image(
                tmp_path,
                bg_color=np.array([1.0, 1.0, 1.0]),
                rmbg_net=rmbg,
            )
            log.info("Image preprocessed (bg removed, cropped, padded)")
        finally:
            os.unlink(tmp_path)

        # Run TripoSG inference
        start = time.time()
        with torch.no_grad():
            outputs = pipe(
                image=img_pil,
                generator=torch.Generator(device=pipe.device).manual_seed(seed),
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
            ).samples[0]

        mesh = trimesh.Trimesh(
            outputs[0].astype(np.float32),
            np.ascontiguousarray(outputs[1]),
        )

        # Optional face reduction
        if faces > 0 and mesh.faces.shape[0] > faces:
            try:
                import pymeshlab
                ms = pymeshlab.MeshSet()
                ms.add_mesh(pymeshlab.Mesh(
                    vertex_matrix=mesh.vertices,
                    face_matrix=mesh.faces,
                ))
                ms.meshing_merge_close_vertices()
                ms.meshing_decimation_quadric_edge_collapse(targetfacenum=faces)
                cm = ms.current_mesh()
                mesh = trimesh.Trimesh(
                    vertices=cm.vertex_matrix(),
                    faces=cm.face_matrix(),
                )
                log.info(f"Mesh simplified to {faces} faces")
            except Exception as e:
                log.warning(f"Face reduction failed, using full mesh: {e}")

        elapsed = time.time() - start
        log.info(f"TripoSG inference: {elapsed:.1f}s")

        # Save GLB
        part_id = f"gen_{uuid.uuid4().hex[:8]}"
        output_path = OUTPUT_DIR / f"{part_id}.glb"
        mesh.export(str(output_path))
        log.info(f"Saved GLB: {output_path} ({os.path.getsize(output_path)} bytes)")

        return {
            "part_id": part_id,
            "glb_path": f"/parts/generated/{part_id}.glb",
            "vertices": len(mesh.vertices),
            "faces": len(mesh.faces),
            "elapsed_s": round(elapsed, 2),
        }

    except Exception as e:
        log.error(f"Generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Generation failed: {str(e)}")


# ── POST /search-image — DuckDuckGo + rembg ─────────────


@app.post("/search-image")
async def search_image(req: SearchImageRequest):
    """Search for a reference image and optionally remove background."""
    try:
        from duckduckgo_search import DDGS

        log.info(f"Searching images for: {req.query}")
        with DDGS() as ddgs:
            results = list(ddgs.images(req.query, max_results=5))

        if not results:
            return {"images": [], "message": "No images found"}

        # Download first result
        import httpx

        image_url = results[0]["image"]
        log.info(f"Downloading: {image_url}")

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()

        image = Image.open(BytesIO(resp.content)).convert("RGBA")

        # Remove background if requested
        if req.remove_bg:
            try:
                import rembg

                image = rembg.remove(image)
                log.info("Background removed")
            except ImportError:
                log.warning("rembg not installed")

        # Save to temp
        img_id = f"ref_{uuid.uuid4().hex[:8]}"
        img_path = OUTPUT_DIR / f"{img_id}.png"
        image.save(str(img_path))

        return {
            "image_id": img_id,
            "image_path": f"/parts/generated/{img_id}.png",
            "source_url": image_url,
            "size": [image.size[0], image.size[1]],
            "all_results": [
                {"url": r["image"], "title": r.get("title", "")} for r in results[:5]
            ],
        }

    except ImportError:
        raise HTTPException(
            503,
            "duckduckgo_search not installed. pip install duckduckgo_search httpx",
        )
    except Exception as e:
        log.error(f"Image search failed: {e}")
        raise HTTPException(500, f"Image search failed: {str(e)}")


# ── POST /merge — Combine GLB Parts ─────────────────────


@app.post("/merge")
async def merge_parts(req: MergeRequest):
    """Merge multiple GLB parts into a single mesh using trimesh."""
    log.info(f"Merging {len(req.parts)} parts into '{req.output_name}'")

    combined = trimesh.Scene()
    for i, part in enumerate(req.parts):
        part_path = PROJECT_ROOT / part["path"].lstrip("/")
        if not part_path.exists():
            raise HTTPException(404, f"Part not found: {part['path']}")

        mesh = trimesh.load(str(part_path))
        pos = part.get("position", [0, 0, 0])
        rot = part.get("rotation", [0, 0, 0])

        # Apply transform
        transform = trimesh.transformations.compose_matrix(
            translate=pos,
            angles=[np.radians(r) for r in rot],
        )

        if isinstance(mesh, trimesh.Scene):
            for name, geom in mesh.geometry.items():
                combined.add_geometry(geom, transform=transform, node_name=f"part_{i}_{name}")
        else:
            combined.add_geometry(mesh, transform=transform, node_name=f"part_{i}")

    # Export merged
    output_path = OUTPUT_DIR / f"{req.output_name}.glb"
    combined.export(str(output_path))
    log.info(
        f"Merged mesh saved: {output_path} ({os.path.getsize(output_path)} bytes)"
    )

    return {
        "merged_path": f"/parts/generated/{req.output_name}.glb",
        "parts_count": len(req.parts),
        "file_size": os.path.getsize(output_path),
    }


# ── POST /rig — Auto-Rig via UniRig ─────────────────────


@app.post("/rig")
async def rig_bot(req: RigRequest):
    """Auto-rig a GLB mesh using the UniRig pipeline."""
    glb_path = PROJECT_ROOT / req.glb_path.lstrip("/")
    if not glb_path.exists():
        raise HTTPException(404, f"GLB not found: {req.glb_path}")

    # Ensure TripoSR is unloaded (UniRig needs VRAM)
    unload_triposr()

    log.info(f"Rigging: {glb_path}")

    try:
        # UniRig work directory
        work_dir = OUTPUT_DIR / f"rig_{req.output_name}"
        work_dir.mkdir(parents=True, exist_ok=True)

        # Step 1: Locate UniRig scripts
        skin_export_script = UNIRIG_DIR / "export_skin_json.py"

        # Step 2: Run UniRig skeleton prediction
        unirig_python = UNIRIG_DIR / "venv" / "Scripts" / "python.exe"
        if not unirig_python.exists():
            unirig_python = sys.executable  # fallback

        # Run predict skeleton
        skel_cmd = [
            str(unirig_python),
            "-m",
            "src.main",
            f"input.mesh_path={str(glb_path)}",
            "resources.skeleton_config=configs/task/quick_inference_skel_win.yaml",
            f"output.directory={str(work_dir)}",
        ]
        log.info("Running skeleton prediction...")
        skel_result = subprocess.run(
            skel_cmd,
            cwd=str(UNIRIG_DIR),
            capture_output=True,
            text=True,
            timeout=120,
        )
        if skel_result.returncode != 0:
            log.error(f"Skeleton prediction failed:\n{skel_result.stderr}")
            raise HTTPException(500, f"Skeleton prediction failed: {skel_result.stderr[:500]}")

        # Run predict skin
        skin_cmd = [
            str(unirig_python),
            "-m",
            "src.main",
            f"input.mesh_path={str(glb_path)}",
            "resources.skin_config=configs/task/quick_inference_skin_win.yaml",
            f"output.directory={str(work_dir)}",
        ]
        log.info("Running skin prediction...")
        skin_result = subprocess.run(
            skin_cmd,
            cwd=str(UNIRIG_DIR),
            capture_output=True,
            text=True,
            timeout=120,
        )
        if skin_result.returncode != 0:
            log.error(f"Skin prediction failed:\n{skin_result.stderr}")
            raise HTTPException(500, f"Skin prediction failed: {skin_result.stderr[:500]}")

        # Step 3: Export skin JSON
        skin_json_path = work_dir / "skin.json"
        if skin_export_script.exists():
            export_cmd = [
                str(unirig_python),
                str(skin_export_script),
                str(work_dir / "predict_skin.npz"),
                str(skin_json_path),
            ]
            export_result = subprocess.run(
                export_cmd,
                cwd=str(UNIRIG_DIR),
                capture_output=True,
                text=True,
                timeout=30,
            )
            if export_result.returncode != 0:
                log.warning(f"Skin JSON export failed: {export_result.stderr[:300]}")

        # Check results
        result = {
            "output_dir": str(work_dir),
            "glb_input": req.glb_path,
        }

        if skin_json_path.exists():
            with open(skin_json_path) as f:
                skin_data = json.load(f)
            result["skin_json"] = f"/parts/generated/rig_{req.output_name}/skin.json"
            result["bone_count"] = len(skin_data.get("bones", []))
            result["vertex_count"] = len(skin_data.get("weights", []))
            log.info(
                f"Rigging complete: {result['bone_count']} bones, {result['vertex_count']} weighted vertices"
            )
        else:
            result["skin_json"] = None
            result["message"] = "Rigging completed but skin.json not generated"

        return result

    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Rigging timed out (120s limit)")
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Rigging failed: {e}")
        raise HTTPException(500, f"Rigging failed: {str(e)}")


# ── Static file serving for generated parts ──────────────


@app.get("/parts/generated/{filename}")
async def serve_generated(filename: str):
    """Serve generated files from the output directory."""
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, f"File not found: {filename}")
    return FileResponse(str(file_path))


# ── Main ─────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8100)
