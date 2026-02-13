# Robot Parts Component Library

## Purpose

Define a standard library of **modular robot components** that the LLM can compose like LEGO bricks when generating `drawCode`. Instead of the LLM inventing everything from scratch, it can reference these pre-defined parts by name and combine them into unique bots.

Each component has:

- **Name** — a common robotic term the LLM already knows
- **Visual description** — what it looks like in 2D top-down view
- **Canvas 2D snippet** — ready-to-use drawing code the LLM can adapt

---

## Category 1: Structural Components

### Chassis Plate

The base body of the robot. Flat plate that all other parts mount onto.

```javascript
// Rectangular chassis plate with metallic gradient
var cg = ctx.createLinearGradient(-s,-s*0.7,s,s*0.7);
cg.addColorStop(0,'#444'); cg.addColorStop(0.5,'#666'); cg.addColorStop(1,'#444');
ctx.fillStyle=cg; ctx.fillRect(-s,-s*0.7,s*2,s*1.4);
ctx.strokeStyle='#888'; ctx.lineWidth=2; ctx.strokeRect(-s,-s*0.7,s*2,s*1.4);
```

### Armor Panel

Overlaid protective plate with a bevel edge. Layer these on top of chassis.

```javascript
// Armor panel with highlight edge
ctx.fillStyle='rgba(180,180,180,0.3)';
ctx.fillRect(-s*0.8,-s*0.5,s*1.6,s*0.4);
ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
ctx.beginPath(); ctx.moveTo(-s*0.8,-s*0.5); ctx.lineTo(s*0.8,-s*0.5); ctx.stroke();
```

### Skid Plate / Wedge

Angled front plate for getting underneath opponents.

```javascript
// Wedge plate (front scoop)
ctx.fillStyle='#777';
ctx.beginPath();
ctx.moveTo(s*0.6,-s*0.3); ctx.lineTo(s*1.1,0); ctx.lineTo(s*0.6,s*0.3);
ctx.closePath(); ctx.fill();
ctx.strokeStyle='#999'; ctx.lineWidth=1.5; ctx.stroke();
```

### Frame Rail

Structural beam that runs along the bot's edges. Draw as a thick line with shadow.

```javascript
// Frame rail (structural beam)
ctx.strokeStyle='#555'; ctx.lineWidth=3;
ctx.beginPath(); ctx.moveTo(-s*0.9,-s*0.6); ctx.lineTo(s*0.9,-s*0.6); ctx.stroke();
ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1;
ctx.beginPath(); ctx.moveTo(-s*0.9,-s*0.58); ctx.lineTo(s*0.9,-s*0.58); ctx.stroke();
```

---

## Category 2: Locomotion

### Wheel (Standard)

Round rubber wheel seen from above. Appears as a dark rounded rectangle on each side.

```javascript
// Side-mounted wheels (top-down view = rounded rectangles)
for(var wi=-1;wi<=1;wi+=2){
  ctx.fillStyle='#222'; ctx.strokeStyle='#444'; ctx.lineWidth=1;
  ctx.beginPath();
  ctx.roundRect(-s*0.3, wi*s*0.65-s*0.08, s*0.6, s*0.16, 3);
  ctx.fill(); ctx.stroke();
  // Tread lines
  ctx.strokeStyle='#333'; ctx.lineWidth=0.5;
  for(var tl=0;tl<4;tl++){
    var tx=-s*0.2+tl*s*0.15;
    ctx.beginPath(); ctx.moveTo(tx,wi*s*0.65-s*0.06); ctx.lineTo(tx,wi*s*0.65+s*0.06); ctx.stroke();
  }
}
```

### Tank Tread / Track

Continuous track seen from above. Appears as two long dark bands on each side.

```javascript
// Tank treads (long dark bands with segment marks)
for(var ti=-1;ti<=1;ti+=2){
  ctx.fillStyle='#1a1a1a'; ctx.strokeStyle='#333'; ctx.lineWidth=1;
  ctx.fillRect(-s*0.8, ti*s*0.6, s*1.6, s*0.15);
  ctx.strokeRect(-s*0.8, ti*s*0.6, s*1.6, s*0.15);
  // Tread segments
  ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=0.5;
  for(var ts=0;ts<8;ts++){
    var tsx=-s*0.7+ts*s*0.2;
    ctx.beginPath(); ctx.moveTo(tsx,ti*s*0.6); ctx.lineTo(tsx,ti*s*0.6+s*0.15); ctx.stroke();
  }
}
```

### Omniwheel

Multi-directional wheel with roller segments visible from above.

```javascript
// Omniwheel (circle with cross-rollers)
ctx.fillStyle='#2a2a2a'; ctx.strokeStyle='#444'; ctx.lineWidth=1;
ctx.beginPath(); ctx.arc(s*0.5, s*0.5, s*0.15, 0, Math.PI*2); ctx.fill(); ctx.stroke();
for(var oi=0;oi<4;oi++){
  var oa=oi*Math.PI/2;
  ctx.fillStyle='#555';
  ctx.beginPath();
  ctx.arc(s*0.5+Math.cos(oa)*s*0.1, s*0.5+Math.sin(oa)*s*0.1, s*0.04, 0, Math.PI*2);
  ctx.fill();
}
```

---

## Category 3: Actuators & Motors

### Servo Motor

Small rectangular box with a rotating output horn on top. Common for weapon articulation.

```javascript
// Servo motor (rectangular body + circular horn)
ctx.fillStyle='#2244AA'; ctx.strokeStyle='#113388'; ctx.lineWidth=1;
ctx.fillRect(s*0.2,-s*0.12,s*0.25,s*0.24);
ctx.strokeRect(s*0.2,-s*0.12,s*0.25,s*0.24);
// Output horn
ctx.fillStyle='#ddd'; ctx.strokeStyle='#999'; ctx.lineWidth=0.5;
ctx.beginPath(); ctx.arc(s*0.32,0,s*0.05,0,Math.PI*2); ctx.fill(); ctx.stroke();
```

### Hydraulic Piston / Actuator

Extends and retracts. Drawn as a cylinder that telescopes outward. Used for flippers/hammers.

```javascript
// Hydraulic piston (cylinder + rod)
var extend = Math.sin(tick*0.06)*s*0.1; // animate
var pg=ctx.createLinearGradient(0,-s*0.04,0,s*0.04);
pg.addColorStop(0,'#bbb'); pg.addColorStop(1,'#666');
ctx.fillStyle=pg; ctx.fillRect(s*0.3,-s*0.06,s*0.2,s*0.12); // cylinder body
ctx.fillStyle='#ccc';
ctx.fillRect(s*0.5,-s*0.03,s*0.15+extend,s*0.06); // piston rod
ctx.strokeStyle='#444'; ctx.lineWidth=0.8;
ctx.strokeRect(s*0.3,-s*0.06,s*0.2,s*0.12);
```

### Drive Motor

Cylindrical motor that drives wheels or weapons. Drawn as a circle with an axle line.

```javascript
// Drive motor (top-down = circle with axle)
ctx.fillStyle='#333'; ctx.strokeStyle='#555'; ctx.lineWidth=1;
ctx.beginPath(); ctx.arc(-s*0.4,0,s*0.12,0,Math.PI*2); ctx.fill(); ctx.stroke();
// Axle
ctx.strokeStyle='#888'; ctx.lineWidth=2;
ctx.beginPath(); ctx.moveTo(-s*0.4,0); ctx.lineTo(-s*0.4,-s*0.25); ctx.stroke();
```

### Gearbox

Multi-circle cluster representing meshing gears. Shows mechanical complexity.

```javascript
// Gearbox (interlocking gear circles)
ctx.strokeStyle='#777'; ctx.lineWidth=1; ctx.globalAlpha=0.5;
ctx.beginPath(); ctx.arc(-s*0.1,0,s*0.1,0,Math.PI*2); ctx.stroke();
ctx.beginPath(); ctx.arc(s*0.05,s*0.08,s*0.08,0,Math.PI*2); ctx.stroke();
ctx.beginPath(); ctx.arc(s*0.05,-s*0.08,s*0.08,0,Math.PI*2); ctx.stroke();
ctx.globalAlpha=1;
```

---

## Category 4: Joints & Connections

### Hinge Joint

Visible pin that connects two parts. Drawn as a small filled circle with a darker ring.

```javascript
// Hinge joint (pivot point)
ctx.fillStyle='#888'; ctx.strokeStyle='#444'; ctx.lineWidth=1;
ctx.beginPath(); ctx.arc(s*0.5,0,s*0.05,0,Math.PI*2); ctx.fill(); ctx.stroke();
// Pin dot
ctx.fillStyle='#333';
ctx.beginPath(); ctx.arc(s*0.5,0,s*0.02,0,Math.PI*2); ctx.fill();
```

### Ball Joint

Allows multi-axis rotation. Drawn as a larger circle with concentric inner ring.

```javascript
// Ball joint (multi-axis mount)
ctx.fillStyle='#999'; ctx.strokeStyle='#555'; ctx.lineWidth=1;
ctx.beginPath(); ctx.arc(0,0,s*0.08,0,Math.PI*2); ctx.fill(); ctx.stroke();
ctx.strokeStyle='#777'; ctx.lineWidth=0.5;
ctx.beginPath(); ctx.arc(0,0,s*0.04,0,Math.PI*2); ctx.stroke();
```

### Mounting Bracket

L-shaped bracket that connects weapon to chassis. Simple angular shape.

```javascript
// Mounting bracket (L-shape)
ctx.fillStyle='#777'; ctx.strokeStyle='#555'; ctx.lineWidth=0.8;
ctx.beginPath();
ctx.moveTo(s*0.3,-s*0.1); ctx.lineTo(s*0.3,s*0.1);
ctx.lineTo(s*0.45,s*0.1); ctx.lineTo(s*0.45,s*0.06);
ctx.lineTo(s*0.34,s*0.06); ctx.lineTo(s*0.34,-s*0.1);
ctx.closePath(); ctx.fill(); ctx.stroke();
```

### Bolt / Rivet (Decorative)

Small circles placed at structural junctions. Add 4-6 for realism.

```javascript
// Rivets at corners
ctx.fillStyle='#555';
var rivets=[[-0.7,-0.5],[0.7,-0.5],[-0.7,0.5],[0.7,0.5]];
for(var ri=0;ri<rivets.length;ri++){
  ctx.beginPath();
  ctx.arc(rivets[ri][0]*s,rivets[ri][1]*s,1.5,0,Math.PI*2);
  ctx.fill();
}
```

---

## Category 5: Weapon Components

### Spinning Blade Bar

Horizontal metal bar that rotates. The primary visual for spinner bots.

```javascript
// Spinning blade bar (animated rotation)
ctx.save(); ctx.rotate(tick*0.1);
var bg=ctx.createLinearGradient(0,-3,0,3);
bg.addColorStop(0,'#ddd'); bg.addColorStop(0.5,'#999'); bg.addColorStop(1,'#555');
ctx.fillStyle=bg; ctx.strokeStyle='#333'; ctx.lineWidth=0.8;
for(var bi=0;bi<2;bi++){
  var bd=bi===0?1:-1;
  ctx.beginPath();
  ctx.moveTo(bd*5,-3); ctx.lineTo(bd*s*0.9,-4); ctx.lineTo(bd*(s*0.9+3),0);
  ctx.lineTo(bd*s*0.9,4); ctx.lineTo(bd*5,3); ctx.closePath();
  ctx.fill(); ctx.stroke();
}
ctx.restore();
```

### Hammer Head

Heavy rectangular block on the end of a shaft. Swings on an arc.

```javascript
// Hammer head (heavy steel block)
var hg=ctx.createLinearGradient(0,-s*0.2,0,s*0.2);
hg.addColorStop(0,'#ccc'); hg.addColorStop(0.5,'#888'); hg.addColorStop(1,'#555');
ctx.fillStyle=hg; ctx.strokeStyle='#333'; ctx.lineWidth=1;
ctx.fillRect(s*0.5,-s*0.25,s*0.3,s*0.5);
ctx.strokeRect(s*0.5,-s*0.25,s*0.3,s*0.5);
```

### Saw Disc

Circular blade with visible teeth around the edge. Rotates continuously.

```javascript
// Saw disc (serrated circle with teeth)
ctx.save(); ctx.translate(s*0.6,0); ctx.rotate(tick*0.12);
var dg=ctx.createRadialGradient(0,0,0,0,0,s*0.3);
dg.addColorStop(0,'#ccc'); dg.addColorStop(1,'#777');
ctx.fillStyle=dg;
ctx.beginPath(); ctx.arc(0,0,s*0.25,0,Math.PI*2); ctx.fill();
for(var si=0;si<8;si++){
  var sa=si*Math.PI/4, ht=Math.PI/8*0.4;
  ctx.fillStyle='#999';
  ctx.beginPath();
  ctx.moveTo(Math.cos(sa-ht)*s*0.22,Math.sin(sa-ht)*s*0.22);
  ctx.lineTo(Math.cos(sa)*s*0.32,Math.sin(sa)*s*0.32);
  ctx.lineTo(Math.cos(sa+ht)*s*0.22,Math.sin(sa+ht)*s*0.22);
  ctx.closePath(); ctx.fill();
}
ctx.restore();
```

### Flamethrower Nozzle

Tapered barrel tube. Fire originates from the tip.

```javascript
// Nozzle barrel (tapered metallic tube)
var ng=ctx.createLinearGradient(s*0.4,-s*0.08,s*0.4,s*0.08);
ng.addColorStop(0,'#aaa'); ng.addColorStop(1,'#555');
ctx.fillStyle=ng; ctx.strokeStyle='#333'; ctx.lineWidth=0.8;
ctx.beginPath();
ctx.moveTo(s*0.4,-s*0.08); ctx.lineTo(s*0.8,-s*0.05);
ctx.lineTo(s*0.8,s*0.05); ctx.lineTo(s*0.4,s*0.08);
ctx.closePath(); ctx.fill(); ctx.stroke();
```

### Lance / Spear Tip

Pointed metallic tip at the end of a shaft. Triangular shape with gradient.

```javascript
// Lance tip (pointed triangle)
var lg=ctx.createLinearGradient(s*0.6,0,s*0.95,0);
lg.addColorStop(0,'#aaa'); lg.addColorStop(1,'#eee');
ctx.fillStyle=lg; ctx.strokeStyle='#666'; ctx.lineWidth=0.8;
ctx.beginPath();
ctx.moveTo(s*0.95,0); ctx.lineTo(s*0.6,-s*0.08); ctx.lineTo(s*0.6,s*0.08);
ctx.closePath(); ctx.fill(); ctx.stroke();
```

### Flipper Wedge

Flat lifting plate that rotates up from a hinge. Used to flip opponents.

```javascript
// Flipper wedge plate
var fg=ctx.createLinearGradient(0,-s*0.15,0,s*0.15);
fg.addColorStop(0,'#bbb'); fg.addColorStop(1,'#666');
ctx.fillStyle=fg; ctx.strokeStyle='#444'; ctx.lineWidth=0.8;
ctx.beginPath();
ctx.moveTo(s*0.4,-s*0.15); ctx.lineTo(s*0.9,-s*0.1);
ctx.lineTo(s*0.95,0); ctx.lineTo(s*0.9,s*0.1);
ctx.lineTo(s*0.4,s*0.15); ctx.closePath();
ctx.fill(); ctx.stroke();
```

---

## Category 6: Decorative / Detail Components

### LED / Status Light

Small glowing circle. Adds life to the bot.

```javascript
// LED indicator (animated glow)
ctx.shadowColor='#0f0'; ctx.shadowBlur=6;
ctx.fillStyle='#0f0';
ctx.globalAlpha=0.5+0.4*Math.sin(tick*0.15);
ctx.beginPath(); ctx.arc(-s*0.3,-s*0.3,s*0.04,0,Math.PI*2); ctx.fill();
ctx.shadowBlur=0; ctx.globalAlpha=1;
```

### Vent / Exhaust Grill

Parallel lines cut into armor. Shows cooling/exhaust.

```javascript
// Vent slits (3 parallel lines)
ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
for(var vi=0;vi<3;vi++){
  var vy=-s*0.15+vi*s*0.15;
  ctx.beginPath(); ctx.moveTo(-s*0.3,vy); ctx.lineTo(s*0.1,vy); ctx.stroke();
}
```

### Antenna / Receiver

Thin line with a small tip. Communication element.

```javascript
// Antenna (thin pole + tip)
ctx.strokeStyle='#888'; ctx.lineWidth=1;
ctx.beginPath(); ctx.moveTo(-s*0.5,-s*0.2); ctx.lineTo(-s*0.5,-s*0.7); ctx.stroke();
ctx.fillStyle='#f00';
ctx.beginPath(); ctx.arc(-s*0.5,-s*0.7,2,0,Math.PI*2); ctx.fill();
```

### Eye / Sensor

Small circle or lens that indicates where the bot "sees." Gives character.

```javascript
// Eye/sensor (bright circle with highlight)
ctx.fillStyle='#fff';
ctx.beginPath(); ctx.arc(s*0.4,0,s*0.06,0,Math.PI*2); ctx.fill();
ctx.fillStyle=color;
ctx.beginPath(); ctx.arc(s*0.4,0,s*0.04,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#fff';
ctx.beginPath(); ctx.arc(s*0.42,-s*0.015,s*0.015,0,Math.PI*2); ctx.fill();
```

### Fuel Tank

Small cylindrical container. Used for flamethrower bots.

```javascript
// Fuel tank (ellipse with gradient)
var tg=ctx.createLinearGradient(-s*0.2,-s*0.1,-s*0.2,s*0.1);
tg.addColorStop(0,'#a08050'); tg.addColorStop(1,'#604020');
ctx.fillStyle=tg; ctx.strokeStyle='#444'; ctx.lineWidth=0.8;
ctx.beginPath(); ctx.ellipse(-s*0.2,0,s*0.1,s*0.12,0,0,Math.PI*2);
ctx.fill(); ctx.stroke();
```

### Weapon Shaft / Arm

Connecting rod between motor and weapon head. Simple tapered rectangle.

```javascript
// Weapon shaft (tapered rod)
var sg=ctx.createLinearGradient(0,-s*0.04,0,s*0.04);
sg.addColorStop(0,'#b0a080'); sg.addColorStop(1,'#6b5335');
ctx.fillStyle=sg; ctx.strokeStyle='#444'; ctx.lineWidth=0.6;
ctx.fillRect(s*0.2,-s*0.04,s*0.35,s*0.08);
ctx.strokeRect(s*0.2,-s*0.04,s*0.35,s*0.08);
```

---

## Usage Pattern for LLM

The LLM should compose bots by **layering these components in order**:

1. **Chassis plate** (base body shape with gradient)
2. **Locomotion** (wheels/tracks on the sides)
3. **Armor panels** (overlaid on chassis)
4. **Actuators/motors** (visible mechanical parts)
5. **Weapon components** (mounted in front/on top)
6. **Joints** (connecting weapon to body)
7. **Details** (rivets, LEDs, vents, eyes)

This layered approach ensures depth and realism — later layers are drawn on top, creating visual hierarchy.
