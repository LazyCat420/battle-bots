# 3D Bot Generation Pipeline — Feasibility Analysis

## The Vision

Use image-to-3D AI (SAM3D or alternatives) to generate 3D mesh parts from reference images, merge them into Frankenstein bot models (e.g., robot body + saw hands), and render in-browser using Three.js.

---

## Is It Possible? — YES, with caveats

### What Works Well

1. **Image → 3D mesh**: SAM3D, TripoSR, and similar models output standard `.glb`/`.obj` files from single images
2. **Mesh merging**: Three.js CSG libraries can boolean-union static meshes programmatically
3. **Browser rendering**: Three.js `GLTFLoader` can load and render `.glb` models with animation
4. **VRAM swapping**: Models can be loaded/unloaded from GPU with `torch.cuda.empty_cache()`

### What's Hard

1. **Rigging merged meshes** is extremely complex — you need to combine skeletons, remap skin weights
2. **VRAM budget**: Running LLM (20GB) + 3D gen (6-8GB) simultaneously won't fit in most GPUs
3. **Quality**: Single-image 3D has artifacts, especially for small mechanical parts (saws, weapons)
4. **Pipeline time**: Each 3D generation takes 8-45 seconds per part

---

## VRAM Requirements

| Component | VRAM Needed | Notes |
|-----------|------------|-------|
| LM Studio LLM | ~20GB | Currently running |
| SAM3D / TripoSR | 6-8GB (low-res) | Can't run simultaneously |
| Three.js rendering | ~0 (CPU/WebGL) | Runs in browser, no VRAM |

**Total if simultaneous: 26-28GB** — doesn't fit most consumer GPUs.

---

## Architecture Options

### Option A: Sequential Pipeline with VRAM Swapping (Recommended)

```
Step 1: LLM generates bot concept + part list → unload LLM from VRAM
Step 2: For each part, find/generate reference image
Step 3: Load TripoSR → generate 3D meshes → unload TripoSR
Step 4: Merge meshes on CPU (Three.js CSG or Python trimesh)
Step 5: Reload LLM for next request
```

**Pros**: Works on single GPU, reuses existing infrastructure
**Cons**: Slow (30-60s per bot), model swap overhead (~5-10s per swap)

**VRAM Manager Pattern:**

```python
import gc, torch

def unload_model(model):
    """Free GPU memory by deleting model and clearing cache."""
    del model
    gc.collect()
    torch.cuda.empty_cache()

def load_3d_generator():
    """Load TripoSR for 3D generation phase."""
    from triposr import TripoSR
    model = TripoSR.from_pretrained("stabilityai/TripoSR")
    return model.cuda()
```

### Option B: Pre-Generated Parts Library (Simplest)

```
Pre-generate a library of 50-100 common 3D parts (saw, wheel, hammer, etc.)
LLM selects parts from library + specifies assembly positions
Three.js merges and renders selected parts in browser
```

**Pros**: No runtime 3D generation, no VRAM swapping needed, instant assembly
**Cons**: Limited to pre-made parts, less unique bots

### Option C: Separate GPU / Cloud API (Most Powerful)

```
LLM runs on local GPU
3D generation runs on cloud API (Tripo3D API, Stability AI)
or on a second machine/GPU
```

**Pros**: Can run simultaneously, best quality
**Cons**: Requires API costs or second GPU

---

## Frankensteining: How Mesh Merging Works

### Static Mesh Merge (Simpler — recommended to start)

```javascript
// Three.js CSG boolean union
import { CSG } from 'three-csg-ts';

const bodyMesh = loadGLB('robot_body.glb');
const sawMesh = loadGLB('saw_blade.glb');

// Position the saw at the hand location
sawMesh.position.set(1.2, 0.5, 0); // right hand position
sawMesh.rotation.z = Math.PI / 4;

// Merge via boolean union
const merged = CSG.union(bodyMesh, sawMesh);
scene.add(merged);
```

### Rigged Mesh Merge (Very Complex — future phase)

To merge rigged meshes while keeping animation:

1. Combine individual `Skeleton` objects into one
2. Merge `BufferGeometry` instances
3. Remap `skinIndex` and `skinWeight` attributes (bone → vertex mapping)
4. Create new `SkinnedMesh` with merged skeleton
5. Blend animations from both source models

> **Recommendation**: Start with static meshes first. Add rigging only if/when needed.

---

## Recommended Phased Approach

### Phase 1: Pre-Generated Parts + Three.js Assembly (No AI needed)

- Create 3D models for each part in the Robot Parts Library (saw disc, hammer, wheels, etc.)
- Could use existing free 3D assets or generate them once with TripoSR
- LLM picks parts + positions via JSON
- Three.js assembles and renders in browser
- **Effort**: Medium | **VRAM**: None at runtime

### Phase 2: On-Demand 3D Generation with VRAM Swapping

- Add TripoSR pipeline behind a Python API
- VRAM manager loads/unloads models on demand
- LLM describes → image search/gen → TripoSR → merge
- **Effort**: High | **VRAM**: Sequential swapping

### Phase 3: Rigging & Animation

- Auto-rig merged meshes with Mixamo or custom skeleton
- Add attack animations per weapon type
- **Effort**: Very High | **VRAM**: Same as Phase 2

---

## Key Libraries & Tools

| Tool | Purpose | Link |
|------|---------|------|
| **TripoSR** | Image → 3D mesh (fast, open-source) | github.com/VAST-AI/TripoSR |
| **SAM3D** | Image → 3D mesh (Meta, high quality) | github.com/facebookresearch/sam-3d-objects |
| **Three.js** | Browser 3D rendering | threejs.org |
| **three-csg-ts** | Boolean mesh merging in Three.js | npm: three-csg-ts |
| **GLTFLoader** | Load .glb models in Three.js | three/examples/jsm/loaders |
| **trimesh** (Python) | Mesh manipulation on server | trimesh.org |

---

## Honest Assessment

| Question | Answer |
|----------|--------|
| Can we do image → 3D? | ✅ Yes, SAM3D/TripoSR both work |
| Can we merge 3D parts? | ✅ Yes, via CSG or BufferGeometryUtils |
| Can we rig merged models? | ⚠️ Possible but very complex |
| Can we run alongside LLM? | ❌ Not simultaneously on single GPU |
| Is VRAM swapping viable? | ✅ Yes, adds ~10s per swap |
| Can we render in browser? | ✅ Yes, Three.js handles .glb natively |
| Best starting point? | Pre-generated parts lib (Phase 1) |
