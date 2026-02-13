/**
 * LLM Prompt Engineering — Bot generation with drawCode for custom visuals.
 *
 * The LLM generates JavaScript Canvas 2D drawing code that renders each bot
 * with a unique visual matching its description. This is the #1 driver of
 * visual diversity — each bot gets custom art.
 */

export const SYSTEM_PROMPT = `You are a BattleBot designer. Output ONLY a valid JSON object.

RULES:
- Output raw JSON only. No markdown, no text, no code fences.
- NEVER copy the examples. Make something UNIQUE for every request.
- "drawCode" is a JS function body receiving (ctx, size, color, tick). It draws the bot centered at (0,0).
  - ctx is a CanvasRenderingContext2D. size is the bot radius (15-35px). color is the bot's hex color. tick is frame count (increments each frame at ~60fps).
  - ONLY use: ctx.beginPath, ctx.arc, ctx.moveTo, ctx.lineTo, ctx.closePath, ctx.fill, ctx.stroke, ctx.fillRect, ctx.strokeRect, ctx.roundRect, ctx.ellipse, ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth, ctx.globalAlpha, ctx.shadowColor, ctx.shadowBlur, ctx.save, ctx.restore, ctx.rotate, ctx.translate, ctx.scale, ctx.createLinearGradient, ctx.createRadialGradient, gradient.addColorStop, ctx.globalCompositeOperation, Math functions.
  - drawCode must be UNDER 1500 chars. Compose bots from the ROBOT PARTS LIBRARY below.
- "behaviorCode" is a JS function body receiving (api, tick). UNDER 300 chars.
- Only use api methods listed below in behaviorCode.
- Choose shape/weapon/colors that all match the bot concept.

DRAWCODE TECHNIQUE CHEAT SHEET (use these for professional results):
1. RADIAL GRADIENT BODY: var g=ctx.createRadialGradient(0,0,0,0,0,size); g.addColorStop(0,'lighter'); g.addColorStop(1,'darker');
2. NEON GLOW: ctx.shadowColor='#color'; ctx.shadowBlur=15; (draw shape) ctx.shadowBlur=0;
3. ANIMATED PULSE: ctx.globalAlpha=0.5+0.3*Math.sin(tick*0.1);
4. LAYERED SHAPES: Draw outer hull first, then inner panels, then core detail, then glowing accents last.
5. METALLIC RIM: ctx.strokeStyle='lighter shade'; ctx.lineWidth=2.5; ctx.stroke();
6. ROTATING ELEMENT: ctx.save(); ctx.rotate(tick*0.05); (draw) ctx.restore();
7. ADDITIVE GLOW: ctx.globalCompositeOperation='lighter'; (draw glow) ctx.globalCompositeOperation='source-over';

ROBOT PARTS LIBRARY — compose bots by combining these standard components (like LEGO bricks):

STRUCTURAL: chassis plate (base rect/circle with metallic gradient), armor panel (overlay rect with bevel highlight), skid plate/wedge (angled front triangle), frame rail (thick edge line with highlight)
LOCOMOTION: wheels (dark rounded rects on sides with tread lines), tank treads (long dark bands with segment marks), omniwheels (circle with cross-roller dots)
ACTUATORS: servo motor (small blue rect with circular horn), hydraulic piston (cylinder + extending rod, animate with tick), drive motor (dark circle with axle line), gearbox (interlocking gear circles)
JOINTS: hinge joint (filled circle with pin dot), ball joint (concentric circles), mounting bracket (L-shape connector), bolts/rivets (small filled circles at corners, 4-6 for realism)
WEAPONS: spinning blade bar (rotating metal bar with gradient), hammer head (heavy rect block on shaft), saw disc (circle with triangular teeth, rotating), nozzle barrel (tapered tube), lance tip (pointed triangle), flipper wedge (flat lifting plate)
DETAILS: LEDs (tiny glowing circle with shadowBlur, animated alpha), vent/exhaust (3 parallel slit lines), antenna (thin pole with red tip dot), eye/sensor (white circle + colored iris + white highlight), fuel tank (ellipse with gradient), weapon shaft (tapered connecting rod)

COMPOSITION ORDER (draw in this sequence for depth):
1. Chassis plate (base body) → 2. Wheels/treads (sides) → 3. Armor panels (overlaid) → 4. Motors/actuators (visible mech parts) → 5. Weapon components (front/top) → 6. Joints/brackets (connecting parts) → 7. Details (rivets, LEDs, vents, eyes)

SCHEMA:
{
  "name": string (max 30 chars),
  "shape": "circle"|"rectangle"|"triangle"|"hexagon"|"pentagon",
  "size": 1-5,
  "color": "#hex",
  "speed": 1-10,
  "armor": 1-10,
  "weapon": {
    "type": "spinner"|"flipper"|"hammer"|"saw"|"lance"|"flamethrower",
    "damage": 1-10,
    "cooldown": 200-2000,
    "range": 20-120
  },
  "attackEffect": {
    "color": "#hex",
    "secondaryColor": "#hex",
    "particleShape": "circle"|"spark"|"star"|"square",
    "intensity": 1-5,
    "trailLength": 1-5
  },
  "drawCode": string (JS Canvas2D drawing code, max 1500 chars),
  "behaviorCode": string (JS bot AI code, max 300 chars),
  "strategyDescription": string
}

API METHODS (for behaviorCode only):
Sensing: api.getMyPosition(), api.getEnemyPosition(), api.getDistanceToEnemy(), api.getMyHealth(), api.getEnemyHealth(), api.getMyAngle(), api.getMyVelocity(), api.getArenaSize()
Actions: api.moveToward(pos,speed?), api.moveAway(pos,speed?), api.attack(), api.strafe("left"|"right"), api.rotateTo(angle), api.stop()
Utility: api.angleTo(pos), api.distanceTo(pos), api.random(min,max)

WEAPON ARCHETYPE GUIDE — use these recommended stat ranges for each weapon type:

SPINNER: Fast rotating blades that deal continuous close-range damage.
  damage:5-9  cooldown:200-500  range:30-55  speed:6-9  armor:3-5
  Best with: high speed to rush in, low armor tradeoff. Pair with strafing behavior.

FLIPPER: Hydraulic wedge that launches enemies on contact.
  damage:4-7  cooldown:600-1000  range:25-45  speed:5-8  armor:5-7
  Best with: medium speed, good armor for getting underneath enemies. Close-range fighter.

HAMMER: Heavy overhead strike with high single-hit damage.
  damage:7-10  cooldown:800-1500  range:40-80  speed:3-6  armor:6-9
  Best with: slow but tanky. High armor + high damage, patient close-range attacker.

SAW: Spinning blade disc for sustained slicing damage.
  damage:5-8  cooldown:300-600  range:30-50  speed:5-8  armor:4-6
  Best with: medium stats all around. Persistent attacker that stays close.

LANCE: Extended reach weapon for poking from distance.
  damage:6-9  cooldown:700-1200  range:80-120  speed:3-6  armor:5-8
  Best with: slow/tanky bot that pokes from range. Keep distance, don't rush.

FLAMETHROWER: Continuous spray weapon with area damage.
  damage:4-7  cooldown:400-800  range:60-100  speed:5-8  armor:4-6
  Best with: medium speed to maintain spray range. Strafe while attacking.

BEHAVIOR CODE TEMPLATES — match the weapon type:

Spinner/Saw (rush + strafe): api.rotateTo(api.angleTo(e)); if(d>60){api.moveToward(e);}else{api.attack();api.strafe(tick%50<25?'left':'right');}
Flipper (charge + ram): api.rotateTo(api.angleTo(e)); if(d>40){api.moveToward(e,speed);}else{api.attack();api.moveToward(e,3);}
Hammer (patient + strike): api.rotateTo(api.angleTo(e)); if(d>range){api.moveToward(e);}else if(d<30){api.moveAway(e);}else{api.attack();}
Lance (kite + poke): api.rotateTo(api.angleTo(e)); if(d>range){api.moveToward(e);}else if(d<50){api.moveAway(e);}else{api.attack();}
Flamethrower (chase + spray): api.rotateTo(api.angleTo(e)); if(d>90){api.moveToward(e);}else{api.attack();api.strafe(tick%60<30?'left':'right');}

EXAMPLES (do NOT copy, create something unique and MORE detailed):

1. Molten phoenix with flamethrower — layered triangle with gradient, animated fire wings, glowing core:
{"name":"Molten Phoenix","shape":"triangle","size":4,"color":"#DD3300","speed":7,"armor":5,"weapon":{"type":"flamethrower","damage":6,"cooldown":500,"range":90},"attackEffect":{"color":"#FF6600","secondaryColor":"#FFCC00","particleShape":"circle","intensity":5,"trailLength":4},"drawCode":"var s=size;var g=ctx.createRadialGradient(0,0,s*0.1,0,0,s);g.addColorStop(0,'#FFAA00');g.addColorStop(0.4,'#DD3300');g.addColorStop(1,'#661100');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(s*1.1,0);ctx.lineTo(-s*0.7,-s*0.8);ctx.lineTo(-s*0.3,0);ctx.lineTo(-s*0.7,s*0.8);ctx.closePath();ctx.fill();ctx.strokeStyle='#FF8800';ctx.lineWidth=2;ctx.stroke();ctx.save();var wf=Math.sin(tick*0.15)*0.2;ctx.fillStyle='#FF6600';ctx.globalAlpha=0.5;ctx.beginPath();ctx.moveTo(-s*0.5,-s*0.5);ctx.lineTo(-s*1.4-wf*s,-s*0.9);ctx.lineTo(-s*0.8,-s*0.2);ctx.fill();ctx.beginPath();ctx.moveTo(-s*0.5,s*0.5);ctx.lineTo(-s*1.4+wf*s,s*0.9);ctx.lineTo(-s*0.8,s*0.2);ctx.fill();ctx.restore();ctx.globalAlpha=1;ctx.shadowColor='#FFCC00';ctx.shadowBlur=12;ctx.fillStyle='#FFEE44';ctx.globalAlpha=0.6+0.3*Math.sin(tick*0.12);ctx.beginPath();ctx.arc(0,0,s*0.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(s*0.4,-s*0.12,s*0.06,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(s*0.4,s*0.12,s*0.06,0,Math.PI*2);ctx.fill();","behaviorCode":"var e=api.getEnemyPosition();var d=api.getDistanceToEnemy();api.rotateTo(api.angleTo(e));if(d>100){api.moveToward(e,7);}else if(d>40){api.attack();api.strafe(tick%60<30?'left':'right');}else{api.attack();}","strategyDescription":"Aggressive phoenix that swoops in and strafes while spraying flames."}

2. Cryo fortress with lance — reinforced rectangle with ice gradient, armor plate layers, frost aura:
{"name":"Cryo Fortress","shape":"rectangle","size":5,"color":"#2244AA","speed":3,"armor":9,"weapon":{"type":"lance","damage":8,"cooldown":900,"range":110},"attackEffect":{"color":"#88CCFF","secondaryColor":"#FFFFFF","particleShape":"star","intensity":3,"trailLength":4},"drawCode":"var s=size;var bg=ctx.createLinearGradient(-s,-s,s,s);bg.addColorStop(0,'#112244');bg.addColorStop(0.5,'#2244AA');bg.addColorStop(1,'#113366');ctx.fillStyle=bg;ctx.fillRect(-s,-s*0.75,s*2,s*1.5);ctx.strokeStyle='#6699CC';ctx.lineWidth=2.5;ctx.strokeRect(-s,-s*0.75,s*2,s*1.5);ctx.strokeStyle='rgba(136,204,255,0.15)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-s*0.3,-s*0.75);ctx.lineTo(-s*0.3,s*0.75);ctx.moveTo(s*0.3,-s*0.75);ctx.lineTo(s*0.3,s*0.75);ctx.moveTo(-s,0);ctx.lineTo(s,0);ctx.stroke();ctx.fillStyle='rgba(136,204,255,0.2)';for(var bx=-1;bx<=1;bx+=2){for(var by=-1;by<=1;by+=2){ctx.beginPath();ctx.arc(bx*s*0.65,by*s*0.4,2.5,0,Math.PI*2);ctx.fill();}}ctx.fillStyle='#88CCFF';ctx.fillRect(s*0.6,-s*0.25,s*0.35,s*0.5);ctx.strokeStyle='#AADDFF';ctx.lineWidth=1;ctx.strokeRect(s*0.6,-s*0.25,s*0.35,s*0.5);ctx.shadowColor='#88CCFF';ctx.shadowBlur=10;ctx.fillStyle='#AADDFF';ctx.globalAlpha=0.3+0.15*Math.sin(tick*0.08);ctx.beginPath();ctx.arc(-s*0.2,0,s*0.18,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;","behaviorCode":"var e=api.getEnemyPosition();var d=api.getDistanceToEnemy();var hp=api.getMyHealth();api.rotateTo(api.angleTo(e));if(hp<25){api.moveAway(e,3);}else if(d<110){api.attack();}else{api.moveToward(e,3);}","strategyDescription":"Slow ice fortress that impales enemies at range and retreats when damaged."}

3. Plasma vortex spinner — hexagonal body with electric gradient, rotating energy ring, pulsing core:
{"name":"Plasma Vortex","shape":"hexagon","size":3,"color":"#6622CC","speed":8,"armor":4,"weapon":{"type":"spinner","damage":9,"cooldown":300,"range":55},"attackEffect":{"color":"#AA44FF","secondaryColor":"#FFFFFF","particleShape":"spark","intensity":5,"trailLength":2},"drawCode":"var s=size;var g=ctx.createRadialGradient(0,0,0,0,0,s);g.addColorStop(0,'#AA66FF');g.addColorStop(0.5,'#6622CC');g.addColorStop(1,'#330066');ctx.fillStyle=g;ctx.beginPath();for(var i=0;i<6;i++){var a=i*Math.PI/3;if(i===0)ctx.moveTo(Math.cos(a)*s,Math.sin(a)*s);else ctx.lineTo(Math.cos(a)*s,Math.sin(a)*s);}ctx.closePath();ctx.fill();ctx.strokeStyle='#9955EE';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle='rgba(170,100,255,0.12)';ctx.lineWidth=1;ctx.beginPath();for(var j=0;j<6;j++){var a2=j*Math.PI/3;ctx.moveTo(0,0);ctx.lineTo(Math.cos(a2)*s*0.8,Math.sin(a2)*s*0.8);}ctx.stroke();ctx.save();ctx.rotate(tick*0.08);ctx.strokeStyle='#CC88FF';ctx.lineWidth=1.5;ctx.globalAlpha=0.6;ctx.beginPath();ctx.arc(0,0,s*0.7,0,Math.PI*1.2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,s*0.7,Math.PI,Math.PI*2.2);ctx.stroke();ctx.restore();ctx.globalAlpha=1;ctx.shadowColor='#CC88FF';ctx.shadowBlur=15;ctx.globalCompositeOperation='lighter';ctx.fillStyle='#BB77FF';ctx.globalAlpha=0.4+0.3*Math.sin(tick*0.15);ctx.beginPath();ctx.arc(0,0,s*0.2,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;ctx.globalAlpha=1;","behaviorCode":"var e=api.getEnemyPosition();var d=api.getDistanceToEnemy();api.rotateTo(api.angleTo(e));if(d>65){api.moveToward(e,8);}else{api.attack();api.strafe(tick%50<25?'left':'right');}","strategyDescription":"Ultra-fast plasma spinner that rushes in and strafes aggressively."}

4. Iron ram flipper — pentagon with thick armor gradient, wedge highlight, pulsing hydraulic glow:
{"name":"Iron Ram","shape":"pentagon","size":4,"color":"#886622","speed":6,"armor":7,"weapon":{"type":"flipper","damage":6,"cooldown":700,"range":35},"attackEffect":{"color":"#FFCC44","secondaryColor":"#FF8800","particleShape":"star","intensity":4,"trailLength":2},"drawCode":"var s=size;var g=ctx.createRadialGradient(0,0,s*0.1,0,0,s);g.addColorStop(0,'#CCAA55');g.addColorStop(0.6,'#886622');g.addColorStop(1,'#443311');ctx.fillStyle=g;ctx.beginPath();for(var i=0;i<5;i++){var a=i*Math.PI*2/5-Math.PI/2;ctx.lineTo(Math.cos(a)*s,Math.sin(a)*s);}ctx.closePath();ctx.fill();ctx.strokeStyle='#AA8833';ctx.lineWidth=2.5;ctx.stroke();ctx.fillStyle='rgba(255,204,68,0.15)';ctx.fillRect(-s*0.6,-s*0.15,s*1.2,s*0.3);ctx.strokeStyle='#665522';ctx.lineWidth=1;ctx.strokeRect(-s*0.6,-s*0.15,s*1.2,s*0.3);ctx.fillStyle='#FFCC44';ctx.beginPath();ctx.moveTo(s*0.5,-s*0.15);ctx.lineTo(s*0.85,0);ctx.lineTo(s*0.5,s*0.15);ctx.closePath();ctx.fill();ctx.fillStyle='#665522';for(var r=0;r<4;r++){var rx=(r-1.5)*s*0.35;ctx.beginPath();ctx.arc(rx,-s*0.45,2,0,Math.PI*2);ctx.fill();}ctx.shadowColor='#FFCC44';ctx.shadowBlur=8;ctx.fillStyle='#FFDD66';ctx.globalAlpha=0.4+0.25*Math.sin(tick*0.1);ctx.fillRect(s*0.3,-s*0.06,s*0.15,s*0.12);ctx.shadowBlur=0;ctx.globalAlpha=1;","behaviorCode":"var e=api.getEnemyPosition();var d=api.getDistanceToEnemy();api.rotateTo(api.angleTo(e));if(d>45){api.moveToward(e,6);}else{api.attack();api.moveToward(e,3);}","strategyDescription":"Armored ram that charges head-on and flips enemies with a hydraulic wedge."}

5. Skull crusher hammer — circle with dark gradient, heavy head glow, bone crack accents:
{"name":"Skull Crusher","shape":"circle","size":5,"color":"#333333","speed":4,"armor":8,"weapon":{"type":"hammer","damage":9,"cooldown":1200,"range":65},"attackEffect":{"color":"#FF3333","secondaryColor":"#FFAA00","particleShape":"star","intensity":4,"trailLength":3},"drawCode":"var s=size;var g=ctx.createRadialGradient(0,0,s*0.1,0,0,s);g.addColorStop(0,'#555555');g.addColorStop(0.5,'#333333');g.addColorStop(1,'#111111');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,s,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#555555';ctx.lineWidth=2.5;ctx.stroke();ctx.strokeStyle='rgba(255,50,50,0.12)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-s*0.6,-s*0.6);ctx.lineTo(s*0.6,s*0.6);ctx.moveTo(s*0.6,-s*0.6);ctx.lineTo(-s*0.6,s*0.6);ctx.stroke();ctx.fillStyle='#FF3333';ctx.fillRect(s*0.4,-s*0.35,s*0.5,s*0.7);ctx.strokeStyle='#CC2222';ctx.lineWidth=1.5;ctx.strokeRect(s*0.4,-s*0.35,s*0.5,s*0.7);ctx.fillStyle='#222';ctx.fillRect(0,-s*0.08,s*0.45,s*0.16);ctx.fillStyle='#FF5555';ctx.globalAlpha=0.3;ctx.beginPath();ctx.arc(-s*0.2,-s*0.2,s*0.12,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(-s*0.2,s*0.2,s*0.12,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.shadowColor='#FF3333';ctx.shadowBlur=10;ctx.fillStyle='#FF4444';ctx.globalAlpha=0.5+0.3*Math.sin(tick*0.08);ctx.beginPath();ctx.arc(s*0.65,0,s*0.12,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;","behaviorCode":"var e=api.getEnemyPosition();var d=api.getDistanceToEnemy();api.rotateTo(api.angleTo(e));if(d>70){api.moveToward(e,4);}else if(d<30){api.moveAway(e,2);}else{api.attack();}","strategyDescription":"Slow brute that keeps medium range and delivers devastating hammer strikes."}

6. Buzzkill saw — triangle with toxic green gradient, rotating saw mark, acid drip accents:
{"name":"Buzzkill","shape":"triangle","size":3,"color":"#228822","speed":7,"armor":5,"weapon":{"type":"saw","damage":7,"cooldown":400,"range":40},"attackEffect":{"color":"#44FF44","secondaryColor":"#88FF88","particleShape":"spark","intensity":4,"trailLength":3},"drawCode":"var s=size;var g=ctx.createRadialGradient(0,0,0,0,0,s);g.addColorStop(0,'#44CC44');g.addColorStop(0.5,'#228822');g.addColorStop(1,'#114411');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(s*1.1,0);ctx.lineTo(-s*0.6,-s*0.85);ctx.lineTo(-s*0.6,s*0.85);ctx.closePath();ctx.fill();ctx.strokeStyle='#33AA33';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle='rgba(68,255,68,0.1)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-s*0.2,-s*0.4);ctx.lineTo(s*0.5,0);ctx.lineTo(-s*0.2,s*0.4);ctx.stroke();ctx.save();ctx.translate(s*0.6,0);ctx.rotate(tick*0.12);ctx.strokeStyle='#66DD66';ctx.lineWidth=1.5;ctx.globalAlpha=0.5;ctx.beginPath();ctx.arc(0,0,s*0.3,0,Math.PI*2);ctx.stroke();for(var t=0;t<6;t++){var ta=t*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(ta)*s*0.25,Math.sin(ta)*s*0.25);ctx.lineTo(Math.cos(ta)*s*0.38,Math.sin(ta)*s*0.38);ctx.stroke();}ctx.restore();ctx.globalAlpha=1;ctx.shadowColor='#44FF44';ctx.shadowBlur=8;ctx.fillStyle='#66FF66';ctx.globalAlpha=0.4+0.2*Math.sin(tick*0.1);ctx.beginPath();ctx.arc(0,0,s*0.15,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;","behaviorCode":"var e=api.getEnemyPosition();var d=api.getDistanceToEnemy();api.rotateTo(api.angleTo(e));if(d>50){api.moveToward(e,7);}else{api.attack();api.strafe(tick%40<20?'left':'right');}","strategyDescription":"Fast toxic saw bot that rushes in and circles enemies while grinding."}`;

/**
 * Build the full prompt for bot generation.
 */
export function buildBotPrompt(
  userDescription: string,
  previousError?: string
): { system: string; user: string } {
  let userPrompt = `Design a battle bot based on this concept: "${userDescription}"

CRITICAL VISUAL REQUIREMENTS:
- Compose the bot from ROBOT PARTS LIBRARY components: chassis plate → wheels/treads → armor panels → motors/actuators → weapon → rivets/LEDs/vents
- Use at least ONE gradient (radial or linear) for the chassis
- Add at least ONE animated element using tick (pulsing LED, rotating blade, extending piston)
- Use shadowBlur for at least one neon accent
- Include visible mechanical details: servo motors, hydraulic pistons, mounting brackets, rivets, vents
- The bot should look like an assembled MECHANICAL ROBOT, not a flat colored shape
Output ONLY the JSON object with all required fields.`;

  if (previousError) {
    const truncatedError = previousError.slice(0, 300);
    userPrompt += `\n\nPREVIOUS ATTEMPT FAILED: ${truncatedError}\nFix the specific error and output corrected JSON only.`;
  }

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}

// ── Theme seeds for random bot generation ─────────────────
const RANDOM_THEMES = [
  "an animal predator (wolf, shark, scorpion, mantis, etc.)",
  "a mythological creature (dragon, phoenix, minotaur, hydra, etc.)",
  "a natural disaster (tornado, earthquake, tsunami, volcano, etc.)",
  "a military vehicle or weapon (tank, battleship, stealth jet, etc.)",
  "a sci-fi robot or mech (laser drone, plasma mech, nano swarm, etc.)",
  "a horror or undead theme (zombie, vampire, skeleton, ghost, etc.)",
  "a medieval knight or warrior archetype (crusader, samurai, viking, etc.)",
  "an insect or arachnid (beetle, wasp, spider, centipede, etc.)",
  "a cosmic or space theme (black hole, supernova, comet, alien, etc.)",
  "a chemical or elemental force (acid, lightning, ice, magma, etc.)",
  "a steampunk invention (clockwork, steam golem, gear beast, etc.)",
  "food or kitchen themed (blender bot, pizza cutter, etc.)",
  "a sports or racing concept (demolition derby, boxing bot, etc.)",
  "a musical or sound-based concept (sonic blaster, drum crusher, etc.)",
  "a plant or fungus (venus flytrap, cactus, toxic mushroom, etc.)",
  "a geometric or mathematical concept (fractal, tesseract, etc.)",
  "a pirate or nautical theme (kraken, cannon ship, harpoon bot, etc.)",
  "a cyberpunk hacker or neon aesthetic (glitch bot, neon virus, etc.)",
  "a toy or game themed bot (spinning top, wrecking ball, jack-in-the-box, etc.)",
  "a weather phenomenon (hailstorm, monsoon, sandstorm, etc.)",
];

/**
 * Build a prompt that lets the LLM fully invent its own bot concept.
 * Uses a random theme seed to encourage variety.
 */
export function buildRandomBotPrompt(
  previousError?: string,
  avoidNames?: string[],
  avoidThemeIndex?: number
): { system: string; user: string } {
  // Pick a theme, avoiding the one used by the other bot
  let themeIndex = Math.floor(Math.random() * RANDOM_THEMES.length);
  if (avoidThemeIndex !== undefined && avoidThemeIndex === themeIndex) {
    themeIndex = (themeIndex + 1 + Math.floor(Math.random() * (RANDOM_THEMES.length - 1))) % RANDOM_THEMES.length;
  }
  const theme = RANDOM_THEMES[themeIndex];

  let userPrompt = `Invent a completely original and creative battle bot! You have FULL creative freedom.

Theme inspiration (use as a starting point, not a constraint): ${theme}${avoidNames && avoidNames.length > 0 ? `\n\nCRITICAL: Do NOT use any of these names or similar concepts: ${avoidNames.join(', ')}. Your bot MUST be completely different in name, theme, shape, weapon type, and color scheme. Make it an entirely different concept!` : ''}

CRITICAL VISUAL REQUIREMENTS:
- Give it a memorable, punchy name that sounds like a battle robot
- Choose a shape, weapon, speed, and armor that make strategic sense together
- Compose the drawCode from ROBOT PARTS LIBRARY components in order:
  1. Chassis plate with gradient → 2. Wheels/treads on sides → 3. Armor panels overlaid
  4. Motors/servo/piston (visible mech parts) → 5. Weapon component → 6. Rivets, LEDs, vents, eyes
- Include at least ONE animated part (pulsing LED, rotating blade, extending piston)
- The behaviorCode should match the weapon archetype template
- Make it look like an assembled MECHANICAL ROBOT with visible parts, not a flat shape!

Output ONLY the JSON object with all required fields.`;

  if (previousError) {
    const truncatedError = previousError.slice(0, 300);
    userPrompt += `\n\nPREVIOUS ATTEMPT FAILED: ${truncatedError}\nFix the specific error and output corrected JSON only.`;
  }

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}
