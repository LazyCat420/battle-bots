# 3D Bot Generation Pipeline — Full Local Architecture

## The Vision

LLM generates a bot concept → user provides/searches for reference images → local AI converts images to 3D meshes → parts merge into one robot → UniRig auto-rigs with skeleton + skin weights → Three.js + Rapier physics powers browser combat.

**All stages run locally. No cloud APIs.**

---

## Pipeline Flow

```text
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  1. LLM     │───►│ 2. Reference │───►│ 3. Image→3D  │
│  Bot JSON   │    │ Image        │    │ TripoSR      │
│  (LM Studio)│    │ (upload/     │    │ (6-8GB VRAM) │
│  ~20GB VRAM │    │  search)     │    │ 8-15s/part   │
└─────────────┘    └──────────────┘    └──────┬───────┘
                                              │ .glb per part
                                              ▼
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  6. FIGHT!  │◄───│ 5. Auto-Rig  │◄───│ 4. Merge     │
│  Three.js + │    │ UniRig       │    │ Parts        │
│  Rapier     │    │ (~8GB VRAM)  │    │ trimesh/CPU  │
│  (browser)  │    │ ~2.5min      │    │ <1s          │
└─────────────┘    └──────────────┘    └──────────────┘
```

---

## Implementation Status

| Stage | Component | Status | Location |
| --- | --- | --- | --- |
| 1. LLM | `assembly3d` schema in prompt | ✅ Done | `lib/llm/prompt.ts` |
| 1. LLM | `BotAssembly3D` type | ✅ Done | `lib/types/bot.ts` |
| 1. LLM | Assembly validator + auto-fill | ✅ Done | `lib/validation/bot-validator.ts` |
| 1. LLM | Assembly3d logging | ✅ Done | `app/api/generate-bot/route.ts` |
| 2. Reference | DuckDuckGo search + rembg | ✅ Done | `tools/3d-gen/server.py` `/search-image` |
| 3. Image→3D | TripoSR FastAPI endpoint | ✅ Done | `tools/3d-gen/server.py` `/generate` |
| 4. Merge | trimesh CPU merge | ✅ Done | `tools/3d-gen/server.py` `/merge` |
| 5. Auto-Rig | UniRig skeleton + skin | ✅ Done | `tools/3d-gen/server.py` `/rig` |
| 5. Auto-Rig | Skin weights JSON export | ✅ Done | `tools/UniRig/export_skin_json.py` |
| 6. Viewer | 14 procedural parts library | ✅ Done | `lib/3d/parts-library.ts` |
| 6. Viewer | 3D Bot Builder Lab page | ✅ Done | `app/lab/page.tsx` |
| 6. Viewer | Skinned mesh loader | ✅ Done | `lib/3d/skinned-mesh-loader.ts` |
| 6. Combat | 3D Arena renderer | ⬜ Not Started | — |
| 6. Combat | Rapier3D physics | ⬜ Not Started | — |
| 6. Combat | Fight loop + animations | ⬜ Not Started | — |

---

## VRAM Requirements (Sequential — Only One at a Time)

| Component | VRAM | Duration | Notes |
| --- | --- | --- | --- |
| LM Studio LLM | ~20GB | ~2s generate | Unload before mesh gen |
| TripoSR | 6-8GB | 8-15s/part | ~3 parts per bot |
| rembg (bg removal) | ~1GB | <2s | Can run alongside TripoSR |
| UniRig skeleton | ~6-8GB | ~30s | Predicts bone hierarchy |
| UniRig skin | ~8GB | ~2.5min | Predicts vertex weights |
| Three.js rendering | 0 (WebGL) | realtime | Runs in browser |

**Peak VRAM**: ~20GB (only when LLM is loaded). Everything else fits in 8GB.

---

## Stage 1: LLM Bot Concept ✅

**Tool**: LM Studio (already running)

The LLM outputs `assembly3d` in its JSON response:

```json
{
  "assembly3d": {
    "body": "body_tank",
    "weapon": "weapon_spinner",
    "weaponSlot": "weapon_top",
    "locomotion": "locomotion_treads",
    "armor": "armor_plow",
    "armorSlot": "armor_front"
  }
}
```

Parts manifest in prompt covers 4 bodies, 5 weapons, 3 locomotion, 2 armor = **14 parts**.

---

## Stage 2: Reference Image ✅

**Two paths, no AI needed:**

1. **User Upload** — drag image into Lab page
2. **Search Engine** — `POST /search-image` → DuckDuckGo + rembg

---

## Stage 3: Image → 3D Mesh (TripoSR) ✅

| Property | Value |
| --- | --- |
| Repo | [VAST-AI/TripoSR](https://github.com/VAST-AI/TripoSR) |
| VRAM | 6-8GB (resolution 256) |
| Speed | 8-15 seconds per mesh |
| Output | `.glb` mesh |
| License | MIT |

**Alternative (higher quality)**: Hunyuan3D 2.1 — 12-16GB VRAM, 30-60s, PBR textures

---

## Stage 4: Merge Parts (trimesh, CPU) ✅

```python
import trimesh

body = trimesh.load("body.glb")
saw = trimesh.load("saw.glb")
saw.apply_translation([-0.5, 0.3, 0])  # left arm socket
merged = trimesh.util.concatenate([body, saw])
merged.export("merged_bot.glb")
```

LLM JSON includes attachment points. Merge script positions each part.

---

## Stage 5: Auto-Rigging (UniRig) ✅

Pipeline already patched and tested:

1. Extract mesh → `raw_data.npz`
2. Predict skeleton → `.fbx` with bones
3. Extract skeleton → `predict_skeleton.npz`
4. Predict skin weights → `predict_skin.npz` → `skin.json`

The JSON contains bone names, parents, positions, and per-vertex skin weights (4 max influences) — exactly what Three.js `SkinnedMesh` needs.

---

## Stage 6: Three.js Combat ⬜ (NEXT)

### 6A: Arena Renderer

- `Arena3D.tsx` — Three.js scene replaces canvas
- Floor plane with grid, metallic walls, dramatic lighting
- Camera: follow-cam or top-down toggle
- Two assembled bots loaded as `SkinnedMesh`

### 6B: Physics — Rapier3D

- `@dimforge/rapier3d-compat` — WASM physics in browser
- Collision detection for weapon hits
- Rigid body knockbacks
- Arena walls as static colliders

### 6C: Fight Loop

- HP system, damage per weapon type
- Attack animations per weapon (spin, slam, flip, poke, saw)
- Hit reactions, knockback forces
- Death animation + arena victory screen
- 3D HUD: health bars floating above bots

### 6D: Pre-Made Animations

Small Blender library, retargetable to any skeleton:

- `idle.glb`, `attack_saw.glb`, `attack_hammer.glb`, `hit_reaction.glb`, `death.glb`

---

## VRAM Swapping Sequence

```text
LLM (20GB) → generate JSON → UNLOAD
TripoSR (8GB) → generate 3 meshes → UNLOAD
UniRig (8GB) → skeleton + skin → UNLOAD
Browser (0GB) → render + fight
LLM (20GB) → RELOAD for next round
```

VRAM manager calls `torch.cuda.empty_cache()` between stages, and uses LM Studio API to unload/reload the LLM model.

---

## Python Backend (Running ✅)

**Server**: `tools/3d-gen/server.py` on port 8100

```bash
cd tools/3d-gen
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8100 --reload
```

| Endpoint | Method | Description |
| --- | --- | --- |
| `/health` | GET | Health check |
| `/status` | GET | GPU/VRAM info |
| `/generate` | POST | Image → GLB via TripoSR |
| `/search-image` | POST | DuckDuckGo + rembg |
| `/merge` | POST | Combine GLBs via trimesh |
| `/rig` | POST | UniRig auto-rigging |
| `/docs` | GET | Swagger UI (auto-generated) |

---

## Phased Build Order

### Phase 1: Static Bot Assembly ✅

- [x] Pre-made procedural parts library (14 parts)
- [x] LLM picks parts via `assembly3d`
- [x] Three.js Lab page assembles and renders

### Phase 2: Image → 3D Mesh Generation ✅

- [x] Python FastAPI server with TripoSR
- [x] VRAM manager with lazy load/unload
- [x] DuckDuckGo image search + rembg

### Phase 3: Auto-Rigging + Skin Weights ✅

- [x] UniRig pipeline integration
- [x] Export skin weights as JSON
- [x] Three.js SkinnedMesh loader

### Phase 4: 3D Arena + Combat System ⬜ (NEXT)

- [ ] Install `@dimforge/rapier3d-compat`
- [ ] Create `Arena3D.tsx` (Three.js WebGL scene)
- [ ] Create `rapier-adapter.ts` implementing physics interface
- [ ] Port `game-engine.ts` for 3D tick loop
- [ ] 3D behavior API (mostly same as 2D — flat arena floor)
- [ ] Weapon attack animations per type
- [ ] Hit reactions + knockback
- [ ] 3D HUD overlay (health bars above models)

### Phase 5: Polish + Deployment

- [ ] LOD system for complex models
- [ ] Animation library (Blender exports)
- [ ] Victory/death screens
- [ ] 2D↔3D mode toggle

---

## Key Local Dependencies

| Package | Purpose | Install |
| --- | --- | --- |
| `trimesh` | Mesh merge (CPU) | `pip install trimesh` |
| `rembg` | Background removal | `pip install rembg` |
| `duckduckgo_search` | Image search | `pip install duckduckgo_search` |
| TripoSR | Image → 3D mesh | `git clone` + `pip install` |
| UniRig | Auto-rigging | Already set up ✅ |
| `@dimforge/rapier3d-compat` | Physics (browser) | `npm install` |
| Three.js | 3D rendering | Already installed ✅ |
| `fastapi` + `uvicorn` | Python API server | `pip install` ✅ |
