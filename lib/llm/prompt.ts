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
  - ctx is a CanvasRenderingContext2D. size is the bot radius. color is the bot's hex color. tick is frame count.
  - ONLY use: ctx.beginPath, ctx.arc, ctx.moveTo, ctx.lineTo, ctx.closePath, ctx.fill, ctx.stroke, ctx.fillRect, ctx.strokeRect, ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth, ctx.globalAlpha, ctx.shadowColor, ctx.shadowBlur, ctx.save, ctx.restore, ctx.rotate, ctx.translate, ctx.scale, ctx.createLinearGradient, ctx.createRadialGradient, gradient.addColorStop, Math functions.
  - drawCode must be UNDER 600 chars. Draw something that visually represents the bot concept.
- "behaviorCode" is a JS function body receiving (api, tick). UNDER 300 chars.
- Only use api methods listed below in behaviorCode.
- Choose shape/weapon/colors that all match the bot concept.

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
  "drawCode": string (JS Canvas2D drawing code, max 600 chars),
  "behaviorCode": string (JS bot AI code, max 300 chars),
  "strategyDescription": string
}

API METHODS (for behaviorCode only):
Sensing: api.getMyPosition(), api.getEnemyPosition(), api.getDistanceToEnemy(), api.getMyHealth(), api.getEnemyHealth(), api.getMyAngle(), api.getMyVelocity(), api.getArenaSize()
Actions: api.moveToward(pos,speed?), api.moveAway(pos,speed?), api.attack(), api.strafe("left"|"right"), api.rotateTo(angle), api.stop()
Utility: api.angleTo(pos), api.distanceTo(pos), api.random(min,max)

EXAMPLES (do NOT copy, create something unique):

1. Dragon bot with flamethrower — triangular body with spikes and glowing eyes:
{"name":"Draco Inferno","shape":"triangle","size":3,"color":"#CC2200","speed":6,"armor":7,"weapon":{"type":"flamethrower","damage":5,"cooldown":300,"range":80},"attackEffect":{"color":"#FF4400","secondaryColor":"#FFAA00","particleShape":"circle","intensity":5,"trailLength":3},"drawCode":"var s=size;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(s,0);ctx.lineTo(-s*0.8,-s*0.7);ctx.lineTo(-s*0.4,0);ctx.lineTo(-s*0.8,s*0.7);ctx.closePath();ctx.fill();ctx.fillStyle='#FF6600';ctx.beginPath();ctx.moveTo(-s*0.8,-s*0.9);ctx.lineTo(-s*0.5,-s*0.6);ctx.lineTo(-s*0.9,-s*0.5);ctx.fill();ctx.beginPath();ctx.moveTo(-s*0.8,s*0.9);ctx.lineTo(-s*0.5,s*0.6);ctx.lineTo(-s*0.9,s*0.5);ctx.fill();ctx.fillStyle='#FFFF00';ctx.beginPath();ctx.arc(s*0.3,-s*0.15,s*0.1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(s*0.3,s*0.15,s*0.1,0,Math.PI*2);ctx.fill();","behaviorCode":"var e=api.getEnemyPosition();var d=api.getDistanceToEnemy();api.rotateTo(api.angleTo(e));if(d>90){api.moveToward(e);}else if(d>40){api.attack();}else{api.attack();api.strafe('left');}","strategyDescription":"Fire-breathing dragon that strafes while burning."}

2. Armored tank with lance — reinforced rectangle with layered armor plates:
{"name":"Steel Fortress","shape":"rectangle","size":5,"color":"#556677","speed":3,"armor":9,"weapon":{"type":"lance","damage":7,"cooldown":800,"range":100},"attackEffect":{"color":"#AACCFF","secondaryColor":"#556677","particleShape":"spark","intensity":3,"trailLength":4},"drawCode":"var s=size;ctx.fillStyle='#334455';ctx.fillRect(-s,-s*0.7,s*2,s*1.4);ctx.fillStyle=color;ctx.fillRect(-s*0.8,-s*0.5,s*1.6,s);ctx.strokeStyle='#88AACC';ctx.lineWidth=2;ctx.strokeRect(-s*0.8,-s*0.5,s*1.6,s);ctx.fillStyle='#88AACC';ctx.fillRect(s*0.5,-s*0.3,s*0.4,s*0.6);ctx.fillStyle='#AACCEE';ctx.beginPath();ctx.arc(-s*0.3,0,s*0.15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#223344';ctx.fillRect(-s*0.6,-s*0.4,s*0.4,s*0.15);ctx.fillRect(-s*0.6,s*0.25,s*0.4,s*0.15);","behaviorCode":"var e=api.getEnemyPosition();var d=api.getDistanceToEnemy();var hp=api.getMyHealth();if(hp<30){api.moveAway(e,5);}else if(d<100){api.attack();api.rotateTo(api.angleTo(e));}else{api.moveToward(e,3);}","strategyDescription":"Heavy tank that impales from range and retreats when low HP."}

3. Electric spinner — hexagonal body with lightning bolt patterns:
{"name":"Volt Vortex","shape":"hexagon","size":3,"color":"#2244FF","speed":8,"armor":4,"weapon":{"type":"spinner","damage":8,"cooldown":300,"range":50},"attackEffect":{"color":"#44DDFF","secondaryColor":"#FFFFFF","particleShape":"spark","intensity":4,"trailLength":2},"drawCode":"var s=size;var g=ctx.createRadialGradient(0,0,0,0,0,s);g.addColorStop(0,'#4466FF');g.addColorStop(1,color);ctx.fillStyle=g;ctx.beginPath();for(var i=0;i<6;i++){var a=i*Math.PI/3;if(i===0)ctx.moveTo(Math.cos(a)*s,Math.sin(a)*s);else ctx.lineTo(Math.cos(a)*s,Math.sin(a)*s);}ctx.closePath();ctx.fill();ctx.strokeStyle='#44DDFF';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-s*0.6);ctx.lineTo(s*0.2,-s*0.2);ctx.lineTo(-s*0.1,-s*0.1);ctx.lineTo(s*0.1,s*0.3);ctx.lineTo(-s*0.2,s*0.6);ctx.stroke();ctx.fillStyle='#FFFFFF';ctx.globalAlpha=0.5+0.3*Math.sin(tick*0.2);ctx.beginPath();ctx.arc(0,0,s*0.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;","behaviorCode":"var e=api.getEnemyPosition();var d=api.getDistanceToEnemy();if(d>60){api.moveToward(e,8);}else{api.attack();api.strafe(tick%40<20?'left':'right');}","strategyDescription":"Lightning-fast spinner that strafes while attacking."}`;

/**
 * Build the full prompt for bot generation.
 */
export function buildBotPrompt(
  userDescription: string,
  previousError?: string
): { system: string; user: string } {
  let userPrompt = `Design a battle bot based on this concept: "${userDescription}"

CRITICAL: The drawCode MUST visually represent this concept. Draw shapes, details, and features that match the description. Use gradients, glows, and details to make it look amazing.
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
