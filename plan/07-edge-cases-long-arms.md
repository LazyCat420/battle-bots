# Edge Case: Very Long Arms/Weapons

## Problem Statement
When a user asks for "a bot with a really long hammer arm" or "extendable lance," naively creating a single rigid body leads to:
- **Physics instability**: High moment of inertia causes wild spinning/jitter.
- **Unfair reach**: A 300px arm dominates the arena.
- **Visual oddness**: Thin 200px+ rectangles look broken.
- **Joint stress**: Single-pivot long arms create massive torque.

## Constraints
- Max single rigid body length: **120px** from pivot point.
- Max total weapon reach: **180px** (including multi-segment).
- Must remain balanced vs non-arm weapons.

---

## Solution 1: Multi-Segment Arms (Chain Bodies)

### Physics Implementation
Break long arms into 2–4 segments connected by **revolute constraints**:

```typescript
interface ArmSegment {
  length: number;        // Max 60px per segment
  width: number;         // Thickness
  mass: number;          // Decreases toward tip
  jointType: 'revolute'; // Hinge joint
  angleLimit: { min: number; max: number }; // Prevent over-bending
  damping: number;       // Joint friction (0.3–0.7)
}

interface ArmWeapon {
  segments: ArmSegment[]; // 1–4 segments
  motorized: boolean;     // Can actively rotate?
  swingSpeed: number;     // If motorized, deg/sec
  tipCollider: ColliderShape; // Hammer head, blade, etc.
}
```

### Example: 150px Hammer
```json
{
  "segments": [
    { "length": 50, "width": 8, "mass": 3, "angleLimit": { "min": -45, "max": 90 } },
    { "length": 50, "width": 6, "mass": 2, "angleLimit": { "min": -30, "max": 30 } },
    { "length": 50, "width": 4, "mass": 1, "angleLimit": { "min": -20, "max": 20 } }
  ],
  "tipCollider": { "type": "circle", "radius": 12 }
}
```

### Matter.js Implementation
```typescript
function createArmChain(chassis: Matter.Body, armConfig: ArmWeapon, mountPoint: Vec2): Matter.Body[] {
  const segments: Matter.Body[] = [];
  let prevBody = chassis;
  let currentX = mountPoint.x;
  let currentY = mountPoint.y;

  for (let i = 0; i < armConfig.segments.length; i++) {
    const seg = armConfig.segments[i];
    
    // Create segment body
    const body = Matter.Bodies.rectangle(
      currentX + seg.length / 2, currentY,
      seg.length, seg.width,
      { 
        mass: seg.mass,
        friction: 0.1,
        restitution: 0.2,
        collisionFilter: { group: -1 } // Prevent self-collision
      }
    );
    segments.push(body);

    // Create revolute constraint
    const constraint = Matter.Constraint.create({
      bodyA: prevBody,
      pointA: i === 0 ? mountPoint : { x: seg.length / 2, y: 0 },
      bodyB: body,
      pointB: { x: -seg.length / 2, y: 0 },
      stiffness: 0.7,
      damping: seg.damping || 0.5,
      length: 0
    });

    // Apply angle limits (requires Matter.js plugin or manual constraint)
    if (seg.angleLimit) {
      // Store for manual enforcement in tick loop
      (constraint as any).angleLimit = seg.angleLimit;
    }

    Matter.World.add(engine.world, [body, constraint]);
    
    prevBody = body;
    currentX += seg.length;
  }

  // Add tip collider (weapon head)
  if (armConfig.tipCollider) {
    const tip = createTipCollider(prevBody, armConfig.tipCollider);
    segments.push(tip);
  }

  return segments;
}
```

### Angle Limit Enforcement (per tick)
```typescript
function enforceJointLimits(constraint: Matter.Constraint) {
  if (!constraint.angleLimit) return;
  
  const bodyA = constraint.bodyA;
  const bodyB = constraint.bodyB;
  if (!bodyA || !bodyB) return;

  const angle = bodyB.angle - bodyA.angle;
  const { min, max } = constraint.angleLimit;

  if (angle < min) {
    Matter.Body.setAngle(bodyB, bodyA.angle + min);
    Matter.Body.setAngularVelocity(bodyB, 0);
  } else if (angle > max) {
    Matter.Body.setAngle(bodyB, bodyA.angle + max);
    Matter.Body.setAngularVelocity(bodyB, 0);
  }
}
```

---

## Solution 2: Visual Extension (Render Longer, Collide Shorter)

For "really long but not multi-segment" weapons (e.g., lance, spear):

### Physics
- Collider: 80px capsule from chassis.

### Rendering
- Draw 150px lance with decorative shaft + glowing tip.
- Only the first 80px is a hitbox.
- Add motion trail that extends beyond physics.

```typescript
interface VisualExtension {
  physicsLength: number;  // Actual collider (clamped)
  renderLength: number;   // Visual length (can exceed)
  trailLength: number;    // Motion blur trail
  glowIntensity: number;  // Tip glow
}
```

### Rendering Code
```typescript
function drawExtendedLance(ctx: CanvasRenderingContext2D, bot: BotState, tick: number) {
  const physics = bot.weapon.physicsLength; // 80px
  const visual = bot.weapon.renderLength;   // 150px
  
  ctx.save();
  
  // Draw shaft (full visual length)
  ctx.strokeStyle = bot.definition.color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(visual, 0);
  ctx.stroke();
  
  // Draw tip glow (at visual end)
  ctx.shadowColor = bot.definition.attackEffect.color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = bot.definition.attackEffect.color;
  ctx.beginPath();
  ctx.arc(visual, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw physics collider bounds (debug only)
  if (DEBUG_MODE) {
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, -3, physics, 6);
  }
  
  ctx.restore();
}
```

---

## Solution 3: Telescoping/Extending Arms

For arms that extend dynamically (like a piston):

### Physics
- Use a **prismatic constraint** (sliding joint).
- Max extension distance: 60px.

### Implementation
```typescript
interface TelescopingArm {
  baseLength: number;      // Retracted: 40px
  maxExtension: number;    // Extended: 100px (60px extension)
  extendSpeed: number;     // 2px/tick
  retractSpeed: number;    // 2px/tick
  mode: 'manual' | 'auto'; // LLM controls or auto on attack?
}

function createTelescopingArm(chassis: Matter.Body, config: TelescopingArm): Matter.Composite {
  const base = Matter.Bodies.rectangle(20, 0, config.baseLength, 6, { mass: 2 });
  const extension = Matter.Bodies.rectangle(config.baseLength, 0, config.maxExtension, 4, { mass: 1 });
  
  const slider = Matter.Constraint.create({
    bodyA: chassis,
    bodyB: base,
    pointA: { x: 0, y: 0 },
    pointB: { x: -config.baseLength / 2, y: 0 },
    stiffness: 1
  });
  
  const prismatic = Matter.Constraint.create({
    bodyA: base,
    bodyB: extension,
    pointA: { x: config.baseLength / 2, y: 0 },
    pointB: { x: -config.maxExtension / 2, y: 0 },
    stiffness: 0.5,
    length: 0 // Can extend up to maxExtension
  });
  
  return Matter.Composite.create({ bodies: [base, extension], constraints: [slider, prismatic] });
}
```

### LLM Control API
```typescript
interface BehaviorAPI {
  extendArm(speed: number): void;  // Positive = extend, negative = retract
  getArmExtension(): number;       // Current extension (0–1)
}
```

---

## LLM Prompt Integration

Update system prompt to explain constraints:

```markdown
### Long Weapons (Arms, Lances, Hammers)

If the user requests a "long" or "extended" weapon:
- Use multi-segment arms for lengths > 100px (max 4 segments).
- Each segment max length: 60px.
- Total weapon reach cannot exceed 180px.
- Add `segments` array to weapon config.
- For visual-only length, use `renderLength` > `physicsLength`.

**Example**:
```json
{
  "weapon": {
    "type": "hammer",
    "segments": [
      { "length": 50, "width": 8, "angleLimit": { "min": -45, "max": 90 } },
      { "length": 50, "width": 6, "angleLimit": { "min": -30, "max": 30 } }
    ],
    "tipCollider": { "type": "circle", "radius": 15 },
    "damage": 8,
    "cooldown": 1200
  }
}
```
```

---

## Validation Rules

```typescript
function validateArmLength(weapon: ArmWeapon): ValidationResult {
  const totalLength = weapon.segments.reduce((sum, seg) => sum + seg.length, 0);
  
  if (totalLength > 180) {
    return { valid: false, error: 'Total arm length exceeds 180px. Clamping to 180px.' };
  }
  
  for (const seg of weapon.segments) {
    if (seg.length > 60) {
      return { valid: false, error: 'Segment length exceeds 60px. Split into multiple segments.' };
    }
  }
  
  if (weapon.segments.length > 4) {
    return { valid: false, error: 'Max 4 segments allowed. Reduce segment count.' };
  }
  
  return { valid: true };
}
```

---

## Summary

| User Request | Solution | Max Reach | Segments |
|--------------|----------|-----------|----------|
| "Long hammer" | Multi-segment arm | 180px | 2-3 |
| "Really long lance" | Visual extension | 150px visual, 80px physics | 1 |
| "Extendable arm" | Prismatic joint | 100px extended | 2 |
| "Whip" | 4-segment chain | 180px | 4 |

All solutions keep physics stable, hitboxes fair, and support rich visual feedback.
