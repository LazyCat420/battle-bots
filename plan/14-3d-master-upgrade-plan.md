# 3D Battle Bots — Master Upgrade Plan

## Vision

Transform the current 2D Canvas battle arena into a **3D Three.js arena** where bots are assembled from 3D mesh parts generated via SAM3D/TripoSR. The LLM generates bot concepts, the pipeline builds 3D models from parts, and bots fight in a 3D arena with rigged animations.

---

## Current Architecture (What We're Migrating From)

```
┌──────────────────────────────────────────────────┐
│ Next.js App                                      │
│                                                  │
│  ArenaCanvas.tsx ──── Canvas 2D rendering         │
│       │              (drawCode per bot)           │
│       ▼                                          │
│  GameEngine.ts ────── tick loop, damage, AI       │
│       │                                          │
│       ▼                                          │
│  PhysicsWorld ─────── 2D physics interface        │
│       │              (Vec2, shapes)              │
│       ▼                                          │
│  MatterAdapter.ts ─── Matter.js backend          │
│                                                  │
│  LLM → prompt.ts → BotDefinition (2D drawCode)  │
└──────────────────────────────────────────────────┘
```

### Key files that need to change

| File | Current | 3D Equivalent |
|------|---------|---------------|
| `ArenaCanvas.tsx` | Canvas 2D rendering | Three.js WebGL scene |
| `physics-types.ts` | Vec2, 2D shapes | Vec3, 3D collision meshes |
| `matter-adapter.ts` | Matter.js 2D | Cannon.js/Rapier3D/Ammo.js |
| `game-engine.ts` | 2D tick loop | 3D tick loop (mostly same) |
| `bot.ts` | drawCode (Canvas2D) | modelParts (GLB assembly) |
| `prompt.ts` | Canvas drawing instructions | Part selection + rigging |
| `attack-effects.ts` | 2D particles | 3D particle system |

---

## Experiments — Test These First (in order)

Each experiment is a standalone proof-of-concept. **Don't proceed to the next until the current one works.**

### Experiment 1: Can Three.js Render a GLB in Our App?

**Goal**: Get a single .glb model loading and spinning in a Next.js page.

**Test steps**:

1. `npm install three @types/three`
2. Create `/app/lab/page.tsx` (isolated test page)
3. Set up Three.js scene with camera, lights, orbit controls
4. Load any free robot .glb from the internet (e.g., from Sketchfab)
5. Render it spinning in the browser

**Success criteria**: Model visible, rotatable, no errors
**Estimated time**: 1-2 hours
**VRAM**: None (WebGL runs on GPU natively)

---

### Experiment 2: Can We Merge Two GLB Meshes?

**Goal**: Load two separate .glb files and combine them into one model.

**Test steps**:

1. Download two simple .glb files (robot body + saw blade)
2. Load both with `GLTFLoader`
3. Position saw at body's "hand" location
4. Try both approaches:
   - Simple: `scene.add(body); body.add(saw)` (parent-child hierarchy)
   - CSG: `CSG.union(bodyMesh, sawMesh)` (boolean merge)
5. Verify merged model renders correctly

**Success criteria**: Two models appear as one assembled bot
**Estimated time**: 2-3 hours
**Dependencies**: Experiment 1

---

### Experiment 3: Can SAM3D/TripoSR Generate a 3D Model Locally?

**Goal**: Run image-to-3D on a single image and get a .glb file.

**Test steps**:

1. Create `tools/3d-gen/` Python project with venv
2. Install TripoSR (lighter weight than SAM3D, good for testing)
3. Feed it a reference image of a robot/saw/wheel
4. Export generated mesh as .glb
5. Load that .glb in Experiment 1's viewer

**Success criteria**: Generated .glb loads in browser and looks reasonable
**Estimated time**: 3-4 hours
**VRAM**: ~6-8GB (must unload LLM first)

---

### Experiment 4: Can We Swap VRAM Between LLM and 3D Gen?

**Goal**: Build the VRAM manager that loads/unloads models.

**Test steps**:

1. Create `tools/vram-manager/` Python service
2. Implement: `POST /unload-llm` → signals LM Studio to unload
3. Implement: `POST /generate-3d` → loads TripoSR, generates, unloads
4. Implement: `POST /reload-llm` → signals LM Studio to reload
5. Measure: VRAM usage before/after each step

**Success criteria**: VRAM drops after unload, 3D gen succeeds, LLM reloads
**Estimated time**: 4-6 hours
**Key risk**: LM Studio may not support external unload commands — may need API
**Fallback**: Manual unload/reload or use Ollama instead

---

### Experiment 5: Can We Run Physics in 3D?

**Goal**: Replace 2D physics with 3D physics for two colliding boxes.

**Test steps**:

1. Install `cannon-es` (Cannon.js ES module — popular 3D physics)
2. Create `cannon-adapter.ts` implementing `PhysicsWorld3D` interface
3. Drop two boxes in a 3D scene, verify collision
4. Add arena walls (floor + 4 walls)
5. Two bots moving and colliding

**Success criteria**: 3D physics collisions work, bots bounce off walls
**Estimated time**: 3-4 hours
**Dependencies**: Experiment 1

---

### Experiment 6: Can the LLM Generate Part Assembly Instructions?

**Goal**: Get the LLM to output a bot definition referencing 3D parts.

**Test steps**:

1. Define new schema: `modelParts: [{partId, position, rotation, scale}]`
2. Update prompt with available parts catalog
3. Test with LM Studio — does the LLM produce valid part lists?
4. Feed the output to the Three.js assembler from Experiment 2

**Success criteria**: LLM consistently generates valid part assembly JSON
**Estimated time**: 2-3 hours
**Dependencies**: Parts library exists (plan 12)

---

## Full Architecture (Target State)

```
┌───────────────────── BROWSER ─────────────────────────────┐
│                                                           │
│  Arena3D.tsx ──── Three.js WebGL scene                    │
│       │          (loads assembled .glb bots)              │
│       ▼                                                   │
│  GameEngine3D.ts ── tick loop, damage, 3D AI              │
│       │                                                   │
│       ▼                                                   │
│  PhysicsWorld3D ── 3D physics interface (Vec3)            │
│       │                                                   │
│       ▼                                                   │
│  CannonAdapter.ts ── Cannon.js / Rapier3D backend         │
│                                                           │
└───────────────────────────────────────────────────────────┘
         ▲ fetches assembled .glb
         │
┌───────────────────── SERVER ──────────────────────────────┐
│                                                           │
│  /api/generate-bot ──── Next.js API                       │
│       │                                                   │
│  1. LLM generates concept + part list                     │
│       │                                                   │
│  2. BotAssembler3D picks parts from cache                 │
│       │    ├─ Cache hit? → use cached .glb                │
│       │    └─ Cache miss? → call 3D gen pipeline          │
│       │                                                   │
│  3. MeshMerger combines parts → final .glb                │
│       │                                                   │
│  4. Save to /public/bots/{bot-id}.glb                     │
│                                                           │
└───────────────────────────────────────────────────────────┘
         │ (cache miss only)
         ▼
┌───────────────────── PYTHON SERVICE ──────────────────────┐
│                                                           │
│  VRAMManager ──── controls GPU allocation                 │
│       │                                                   │
│  1. Unload LLM from VRAM                                  │
│  2. Load TripoSR/SAM3D                                    │
│  3. Generate .glb from reference image                    │
│  4. Unload TripoSR                                        │
│  5. Reload LLM                                            │
│       │                                                   │
│  Pre-Generated Parts Cache                                │
│  └─ /parts-cache/{part-name}.glb                          │
│     50-100 pre-made parts for instant assembly            │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## New Bot Schema (3D)

```typescript
interface BotDefinition3D {
    name: string;
    // Physical stats (same as 2D)
    size: number;        // 1-5 → scales the model
    speed: number;       // 1-10
    armor: number;       // 1-10
    weapon: WeaponConfig;
    attackEffect: AttackEffect3D;

    // NEW: 3D model assembly
    modelParts: ModelPart[];

    // NEW: 3D behavior code (same API, adds Y-axis)
    behaviorCode: string;
    strategyDescription: string;
}

interface ModelPart {
    partId: string;        // references parts cache, e.g. "chassis_rect"
    position: Vec3;        // {x, y, z} offset from bot center
    rotation: Vec3;        // euler angles in radians
    scale: Vec3;           // {x, y, z} scale factors
    color?: string;        // override color for this part
    animated?: boolean;    // should this part have idle animation
    animationType?: "spin" | "pulse" | "bob" | "extend";
}

interface Vec3 {
    x: number;
    y: number;
    z: number;
}

interface AttackEffect3D {
    color: string;
    secondaryColor: string;
    particleShape: "sphere" | "spark" | "star" | "cube";
    intensity: number;
    trailLength: number;
}
```

---

## New Physics Interface (3D)

```typescript
interface PhysicsWorld3D {
    step(dt: number): void;
    destroy(): void;

    createBody(config: BodyConfig3D): BodyHandle;
    removeBody(handle: BodyHandle): void;

    // Position & Rotation (3D)
    getPosition(handle: BodyHandle): Vec3;
    setPosition(handle: BodyHandle, pos: Vec3): void;
    getQuaternion(handle: BodyHandle): Quaternion;
    setQuaternion(handle: BodyHandle, q: Quaternion): void;

    // Velocity (3D)
    getVelocity(handle: BodyHandle): Vec3;
    setVelocity(handle: BodyHandle, vel: Vec3): void;

    // Forces (3D)
    applyForce(handle: BodyHandle, force: Vec3): void;
    applyImpulse(handle: BodyHandle, impulse: Vec3): void;

    getMass(handle: BodyHandle): number;
    onCollisionStart(callback: CollisionCallback3D): void;

    // Arena
    createStaticBox(pos: Vec3, size: Vec3, label?: string): BodyHandle;
    createStaticPlane(normal: Vec3, offset: number): BodyHandle;
}
```

---

## Implementation Phases

### Phase 0: Lab Environment (Experiments 1-2) ✅

- [x] Install Three.js + types
- [x] Create `/app/lab/page.tsx` test page
- [x] Load and render .glb models
- [x] Merge models via parent-child hierarchy
- [x] Add orbit camera controls
- [ ] Test CSG boolean merge

### Phase 1: 3D Parts Cache (Experiments 3-4) ✅

- [x] Set up `tools/3d-gen/` Python project
- [x] Install and test TripoSR locally
- [x] Generate .glb for each part type in plan 12
- [x] Build parts cache in `/public/parts/`
- [x] Create VRAM manager (lazy load/unload in server.py)
- [ ] Test unload LLM → generate → reload cycle

### Phase 2: 3D Arena Renderer (Experiment 5) ⬜ NEXT

- [ ] Create `Arena3D.tsx` component (Three.js scene)
- [ ] 3D arena with floor, walls, lighting, camera
- [ ] Load assembled bot .glb models into scene
- [ ] Install `@dimforge/rapier3d-compat` for 3D physics
- [ ] Create `rapier-adapter.ts` implementing `PhysicsWorld3D`
- [ ] Bot movement in 3D (constrained to arena floor)

### Phase 3: LLM Integration (Experiment 6) ✅

- [x] Define `BotAssembly3D` schema in `bot.ts`
- [x] Update `prompt.ts` with 3D part selection instructions
- [x] Create assembly validator + auto-fill
- [x] Update `/api/generate-bot/route.ts` for 3D pipeline
- [x] Validator for 3D bot definitions

### Phase 4: 3D Combat System ⬜

- [ ] Port `game-engine.ts` to use `PhysicsWorld3D`
- [ ] 3D behavior API (add Y-axis sensing)
- [ ] 3D weapon range detection
- [ ] 3D attack effects (particle system with Three.js)
- [ ] 3D HUD overlay (health bars above models)

### Phase 5: Rigging & Animation ⬜

- [x] Skinned mesh loader (`skinned-mesh-loader.ts`)
- [ ] Simple idle animations (weapon spin, body bob)
- [ ] Attack animations per weapon type
- [ ] Hit reaction animations
- [x] Auto-rigging with UniRig pipeline
- [ ] Skeleton merging for Frankenstein models

### Phase 6: Frontend ↔ Backend Wiring ⬜

- [ ] Add "Generate 3D" button to Lab page → calls `POST /generate`
- [ ] Add "Rig Bot" button → calls `POST /rig`
- [ ] Add SkeletonHelper visualization toggle
- [ ] Wire up VRAM status display from `GET /status`
- [ ] Full end-to-end test: LLM → TripoSR → merge → UniRig → SkinnedMesh

---

## Key Decisions (Resolved)

1. **3D Physics Engine**: `@dimforge/rapier3d-compat` — Rust-based WASM, fastest, modern TS support

2. **Keep 2D Mode?**: Yes — 2D stays as default, 3D via toggle or dedicated Lab page

3. **Bot Behavior in 3D**: Same flat arena floor — behaviorCode barely changes

4. **LM Studio VRAM Control**: Lazy Python-side management in `server.py` — TripoSR loads on first use, unloads when UniRig needs VRAM

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| TripoSR output quality too low | High | Use SAM3D instead, or pre-model parts manually |
| VRAM swapping too slow (>30s) | Medium | Pre-generate parts library (cache everything) |
| CSG mesh merge produces artifacts | Medium | Fall back to parent-child hierarchy (no boolean) |
| Rigging breaks on merged meshes | High | Skip rigging, use simple transform animations only |
| Three.js performance with complex models | Medium | LOD system, mesh decimation, instancing |
| LLM can't produce valid part assemblies | Medium | Strict validation + auto-correction + few-shot examples |
