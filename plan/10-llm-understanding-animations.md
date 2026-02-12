# Teaching the LLM About Complex Animations & Mechanics

## Problem Statement
The LLM needs to understand **when** and **how** to use different weapon systems, not just output JSON. Specifically:
- How does it know a flamethrower needs continuous particles, not a single attack frame?
- How does it know a long arm needs multi-segment physics, not a giant rectangle?
- How does it know spinning weapons need spin-up time and motion blur?

## Core Issue
The prompt must transform **user intent** ("make a flamethrower bot") into **correct technical spec** (mode: continuous, cone hitbox, flowing particles, DoT overlay).

---

## Solution 1: Enhanced System Prompt with Weapon Archetypes

### Archetype-Based Generation
Instead of letting the LLM freeform every weapon, provide archetype templates:

```markdown
# Weapon Archetype Reference

When generating a bot weapon, first identify the **weapon archetype** from user intent, then use the corresponding template.

## Archetype 1: Instant Impact (Hammer, Bat, Flipper)
**Intent keywords**: "hammer", "smash", "bat", "flip", "launch"
**Template**:
```json
{
  "weapon": {
    "type": "hammer",
    "mode": "instant",
    "damage": 6-10,
    "cooldown": 800-1500,
    "range": 40-80,
    "animation": {
      "type": "swing",
      "duration": 300,
      "arc": 120  // degrees
    }
  },
  "attackEffect": {
    "color": "<matching weapon color>",
    "intensity": 3-5,
    "particleShape": "star",  // Impact sparks
    "trailLength": 2
  }
}
```
**Animation logic**: Discrete swing animation over 300ms, then cooldown. Particles spawn on impact.

---

## Archetype 2: Continuous Spray (Flamethrower, Acid, Water)
**Intent keywords**: "flame", "fire", "spray", "acid", "water", "gas", "steam"
**Template**:
```json
{
  "weapon": {
    "type": "flamethrower",
    "mode": "continuous",
    "damage": 10-15,  // Per second, not per hit
    "cooldown": 3000-5000,
    "range": 60-100,
    "continuous": {
      "shape": "cone",
      "width": 30-50,  // Cone angle
      "duration": 1500-2500,  // How long spray lasts
      "particleRate": 6-12,   // Particles per frame
      "dotDuration": 2000-4000,  // Burn/corrosion after
      "dotTickDamage": 0.1-0.3
    }
  },
  "attackEffect": {
    "color": "#ff4400",  // Fire = orange/red, Acid = green
    "secondaryColor": "#ff8800",
    "particleShape": "circle",
    "intensity": 5,
    "trailLength": 3
  }
}
```
**Animation logic**: 
- Particles flow from nozzle to target continuously.
- Cone hitbox active every tick.
- DoT overlay appears on victim.
- Must call `api.startSpraying()` and `api.stopSpraying()` in behavior.

---

## Archetype 3: High-Speed Spinner (Saw, Blade, Drill)
**Intent keywords**: "spin", "blade", "saw", "drill", "fast", "rotating"
**Template**:
```json
{
  "weapon": {
    "type": "spinner",
    "mode": "instant",
    "damage": 5-9,
    "cooldown": 400-800,
    "range": 30-50,
    "spinner": {
      "targetSpeed": 7-10,  // 1-10 scale
      "spinUpRate": 0.5-1.0,
      "bladeRadius": 20-35,
      "bladeCount": 2-6
    }
  },
  "attackEffect": {
    "color": "#00ccff",
    "intensity": 5,
    "particleShape": "spark",
    "trailLength": 5  // Motion blur
  }
}
```
**Animation logic**:
- Weapon must spin up over 0.5s before dealing full damage.
- Motion blur trail scales with current speed.
- Sparks on impact scale with speed.
- Behavior: Call `api.startSpinning()`, wait for `api.isAtMaxSpin()`, then attack.

---

## Archetype 4: Long Reach (Lance, Spear, Whip, Extended Arm)
**Intent keywords**: "long", "extended", "reach", "lance", "spear", "whip", "arm"
**Template (Multi-segment)**:
```json
{
  "weapon": {
    "type": "hammer",  // or "lance"
    "mode": "instant",
    "damage": 6-8,
    "cooldown": 1000-1800,
    "range": 100-180,  // Total reach
    "segments": [
      { "length": 50, "width": 8, "angleLimit": { "min": -45, "max": 90 } },
      { "length": 50, "width": 6, "angleLimit": { "min": -30, "max": 30 } },
      { "length": 50, "width": 4, "angleLimit": { "min": -20, "max": 20 } }
    ],
    "tipCollider": { "type": "circle", "radius": 12 }
  },
  "attackEffect": {
    "color": "#ff3366",
    "intensity": 4,
    "trailLength": 4  // Whoosh trail
  }
}
```
**Animation logic**:
- Arm bends at joints during swing.
- Each segment has angle constraints.
- Tip travels in arc, creating trail.
- Physics uses chained rigid bodies.

---

## Archetype 5: Projectile (Gun, Cannon, Missile)
**Intent keywords**: "gun", "shoot", "projectile", "cannon", "missile", "bullet"
**Template**:
```json
{
  "weapon": {
    "type": "gun",
    "mode": "projectile",
    "damage": 3-6,  // Per projectile
    "cooldown": 300-800,
    "range": 150-250,
    "projectile": {
      "speed": 5-10,  // px per frame
      "size": 3-6,
      "lifetime": 60,  // frames
      "piercing": false,
      "explosive": false,
      "explosionRadius": 0
    }
  },
  "attackEffect": {
    "color": "#ffff00",
    "secondaryColor": "#ff8800",
    "particleShape": "circle",
    "intensity": 3,
    "trailLength": 3  // Tracer
  }
}
```
**Animation logic**:
- Muzzle flash on fire.
- Projectile entity spawned.
- Tracer particles follow projectile.
- Impact spawns explosion/sparks.
```

---

## Solution 2: Intent → Archetype Mapping (Pre-processing)

Add a classification step before main generation:

### Step 1: Extract Intent
```typescript
interface WeaponIntent {
  keywords: string[];        // From user description
  archetype: WeaponArchetype; // Classified type
  attributes: string[];      // "long", "fast", "heavy", etc.
}

enum WeaponArchetype {
  INSTANT_IMPACT = 'instant_impact',
  CONTINUOUS_SPRAY = 'continuous_spray',
  HIGH_SPEED_SPIN = 'high_speed_spin',
  LONG_REACH = 'long_reach',
  PROJECTILE = 'projectile'
}

function classifyWeaponIntent(userDescription: string): WeaponIntent {
  const lower = userDescription.toLowerCase();
  const keywords = lower.split(/\s+/);
  
  // Detect archetype
  let archetype: WeaponArchetype;
  
  if (/flame|fire|spray|acid|water|gas|steam/.test(lower)) {
    archetype = WeaponArchetype.CONTINUOUS_SPRAY;
  } else if (/spin|blade|saw|drill|rotate/.test(lower)) {
    archetype = WeaponArchetype.HIGH_SPEED_SPIN;
  } else if (/long|extended|reach|lance|spear|whip/.test(lower)) {
    archetype = WeaponArchetype.LONG_REACH;
  } else if (/gun|shoot|projectile|cannon|missile/.test(lower)) {
    archetype = WeaponArchetype.PROJECTILE;
  } else {
    archetype = WeaponArchetype.INSTANT_IMPACT;
  }
  
  // Extract attributes
  const attributes: string[] = [];
  if (/fast|quick|speed/.test(lower)) attributes.push('fast');
  if (/long|extended/.test(lower)) attributes.push('long');
  if (/heavy|powerful/.test(lower)) attributes.push('heavy');
  if (/light|agile/.test(lower)) attributes.push('light');
  
  return { keywords, archetype, attributes };
}
```

### Step 2: Inject Archetype Context into Prompt
```typescript
function buildPrompt(userDescription: string): string {
  const intent = classifyWeaponIntent(userDescription);
  const archetypeGuide = getArchetypeTemplate(intent.archetype);
  
  return `
You are generating a BattleBot based on: "${userDescription}"

DETECTED WEAPON ARCHETYPE: ${intent.archetype}

${archetypeGuide}

IMPORTANT ANIMATION REQUIREMENTS FOR THIS ARCHETYPE:
${getAnimationRequirements(intent.archetype)}

Generate the bot JSON following the archetype template above.
`;
}

function getAnimationRequirements(archetype: WeaponArchetype): string {
  switch (archetype) {
    case WeaponArchetype.CONTINUOUS_SPRAY:
      return `
- Set mode: "continuous"
- Include "continuous" config with cone shape and duration
- Particles must flow continuously, not burst
- Add DoT (dotDuration > 0) for lingering damage
- Behavior must call api.startSpraying() and api.stopSpraying()
`;
    
    case WeaponArchetype.HIGH_SPEED_SPIN:
      return `
- Include "spinner" config with targetSpeed and spinUpRate
- Damage scales with spin-up time (0.5s to max)
- attackEffect.trailLength should be 4-5 for motion blur
- Behavior must call api.startSpinning() and wait for api.isAtMaxSpin()
`;
    
    case WeaponArchetype.LONG_REACH:
      return `
- If total reach > 100px, use multi-segment "segments" array
- Each segment max 60px length
- Include angleLimit for each segment
- Add tipCollider for weapon head
- Total reach cannot exceed 180px
`;
    
    case WeaponArchetype.PROJECTILE:
      return `
- Set mode: "projectile"
- Include "projectile" config with speed and lifetime
- Muzzle flash: intensity >= 4
- Tracer: trailLength >= 3
- Behavior uses api.attack() (fires automatically)
`;
    
    default:
      return `
- Single-hit instant damage on cooldown
- Swing/impact animation (300-500ms)
- Particles spawn on hit, not continuous
`;
  }
}
```

---

## Solution 3: Validation + Auto-Correction

If the LLM outputs incorrect config for the detected archetype, auto-fix:

```typescript
function validateAndCorrectWeapon(weapon: WeaponConfig, archetype: WeaponArchetype): WeaponConfig {
  const corrected = { ...weapon };
  
  switch (archetype) {
    case WeaponArchetype.CONTINUOUS_SPRAY:
      if (corrected.mode !== 'continuous') {
        console.warn('Correcting mode to "continuous" for spray weapon');
        corrected.mode = 'continuous';
      }
      if (!corrected.continuous) {
        console.warn('Adding missing "continuous" config');
        corrected.continuous = {
          shape: 'cone',
          width: 40,
          duration: 2000,
          particleRate: 8,
          dotDuration: 2000,
          dotTickDamage: 0.15
        };
      }
      break;
    
    case WeaponArchetype.HIGH_SPEED_SPIN:
      if (!corrected.spinner) {
        console.warn('Adding missing "spinner" config');
        corrected.spinner = {
          targetSpeed: 8,
          spinUpRate: 0.7,
          bladeRadius: 25,
          bladeCount: 4
        };
      }
      break;
    
    case WeaponArchetype.LONG_REACH:
      const totalLength = corrected.segments?.reduce((sum, s) => sum + s.length, 0) || 0;
      if (totalLength > 180) {
        console.warn('Total arm length exceeds 180px, clamping segments');
        corrected.segments = clampSegments(corrected.segments!, 180);
      }
      break;
  }
  
  return corrected;
}
```

---

## Solution 4: Example-Heavy Few-Shot Prompting

Provide 2-3 complete examples per archetype in the system prompt:

```markdown
## Example 1: Flamethrower Bot (Continuous Spray)

User: "A bot with a flaming inferno weapon that burns enemies"

Output:
```json
{
  "name": "Inferno",
  "weapon": {
    "type": "flamethrower",
    "mode": "continuous",
    "damage": 12,
    "cooldown": 4000,
    "range": 75,
    "continuous": {
      "shape": "cone",
      "width": 45,
      "duration": 2000,
      "particleRate": 10,
      "dotDuration": 3000,
      "dotTickDamage": 0.2
    }
  },
  "attackEffect": {
    "color": "#ff4400",
    "secondaryColor": "#ffaa00",
    "particleShape": "circle",
    "intensity": 5,
    "trailLength": 3
  },
  "behaviorCode": `
    function behavior(api, tick) {
      const dist = api.getDistanceToEnemy();
      api.rotateTo(api.angleTo(api.getEnemyPosition()));
      
      if (dist < 90) {
        api.startSpraying();
        api.moveToward(api.getEnemyPosition(), 3);
      } else {
        api.stopSpraying();
        api.moveToward(api.getEnemyPosition());
      }
    }
  `
}
```
Notice:
- mode: "continuous" (not "instant")
- continuous config with cone shape
- Behavior calls startSpraying/stopSpraying
- Particles spawn every frame, not on hit
```

---

## Solution 5: Behavior Code Templates

Provide behavior templates for each archetype:

```markdown
### Behavior Template: Continuous Spray Weapon

```javascript
function behavior(api, tick) {
  const dist = api.getDistanceToEnemy();
  const angle = api.angleTo(api.getEnemyPosition());
  
  // Always face enemy
  api.rotateTo(angle);
  
  // Spray when in range
  if (dist < <WEAPON_RANGE + 20>) {
    api.startSpraying();
    
    // Optional: Advance slowly while spraying
    api.moveToward(api.getEnemyPosition(), <SPEED * 0.3>);
  } else {
    api.stopSpraying();
    api.moveToward(api.getEnemyPosition());
  }
}
```

### Behavior Template: Spinner Weapon

```javascript
function behavior(api, tick) {
  const dist = api.getDistanceToEnemy();
  
  // Start spinning early
  if (dist < 150) {
    api.startSpinning();
  }
  
  // Only attack at max spin
  if (api.isAtMaxSpin() && dist < <WEAPON_RANGE + 30>) {
    api.moveToward(api.getEnemyPosition());
    api.attack();
  } else if (!api.isAtMaxSpin()) {
    // Orbit while spinning up
    api.strafe(tick % 60 < 30 ? 'left' : 'right');
  } else {
    api.moveToward(api.getEnemyPosition());
  }
}
```

### Behavior Template: Long Arm Weapon

```javascript
function behavior(api, tick) {
  const dist = api.getDistanceToEnemy();
  const angle = api.angleTo(api.getEnemyPosition());
  
  // Rotate to face enemy
  api.rotateTo(angle);
  
  // Attack at max range
  if (dist < <WEAPON_RANGE + 10> && dist > 50) {
    api.attack();
    api.stop(); // Stand still while swinging
  } else if (dist < 40) {
    // Too close, back up
    api.moveAway(api.getEnemyPosition());
  } else {
    api.moveToward(api.getEnemyPosition());
  }
}
```
```

---

## Solution 6: Post-Generation Validation Message

After generation, show the user what was generated:

```typescript
function explainGeneratedWeapon(weapon: WeaponConfig): string {
  const explanations: string[] = [];
  
  if (weapon.mode === 'continuous') {
    explanations.push(
      `✅ Continuous damage weapon detected.`,
      `   - Damage: ${weapon.damage}/sec while spraying`,
      `   - Spray duration: ${weapon.continuous!.duration}ms per burst`,
      `   - DoT: ${weapon.continuous!.dotDuration}ms burn after spray`,
      `   - Animation: Flowing particles in ${weapon.continuous!.width}° cone`
    );
  }
  
  if (weapon.spinner) {
    explanations.push(
      `✅ High-speed spinner detected.`,
      `   - Target speed: ${weapon.spinner.targetSpeed}/10`,
      `   - Spin-up time: ~${(1 / weapon.spinner.spinUpRate).toFixed(1)}s`,
      `   - Blade count: ${weapon.spinner.bladeCount}`,
      `   - Animation: Motion blur + speed-scaled glow`
    );
  }
  
  if (weapon.segments && weapon.segments.length > 1) {
    const totalLength = weapon.segments.reduce((sum, s) => sum + s.length, 0);
    explanations.push(
      `✅ Multi-segment arm detected.`,
      `   - Segments: ${weapon.segments.length}`,
      `   - Total reach: ${totalLength}px`,
      `   - Animation: Articulated swing with joint constraints`
    );
  }
  
  return explanations.join('\n');
}
```

---

## Summary

To teach the LLM about complex animations:

1. **Classify intent** before generation (spray vs spin vs long arm).
2. **Inject archetype-specific templates** into the prompt.
3. **Provide complete examples** for each archetype (few-shot).
4. **Auto-correct** common mistakes (missing `continuous` config, etc.).
5. **Validate** output and explain what was generated.
6. **Behavior templates** for each weapon type so LLM knows what API calls to use.

This ensures the LLM:
- Knows **when** to use `mode: "continuous"` vs `mode: "instant"`.
- Understands **multi-segment arms** need `segments` array.
- Recognizes **spinners** need `spinner` config and `startSpinning()` calls.
- Generates **correct animations** for each weapon archetype.
