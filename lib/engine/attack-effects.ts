/**
 * Attack Effects — Weapon-specific visual animation renderers.
 *
 * Each weapon type has a dedicated renderer that reads the bot's
 * AttackEffect params (color, intensity, particleShape, trailLength)
 * to produce unique visuals per bot.
 */
import { BotState, AttackEffect, WeaponType, ParticleShape } from "@/lib/types/bot";

// ── Effect Particle ───────────────────────────────────────
export interface EffectParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
    shape: ParticleShape;
    rotation: number;
    rotationSpeed: number;
}

// ── Default effects per weapon type ───────────────────────
export function getDefaultAttackEffect(weaponType: WeaponType, botColor: string): AttackEffect {
    const defaults: Record<WeaponType, AttackEffect> = {
        spinner: {
            color: "#FFD700",
            secondaryColor: "#FFA500",
            particleShape: "spark",
            intensity: 3,
            trailLength: 2,
        },
        flipper: {
            color: "#44DDFF",
            secondaryColor: "#2288FF",
            particleShape: "star",
            intensity: 4,
            trailLength: 1,
        },
        hammer: {
            color: "#FF6633",
            secondaryColor: "#CC3300",
            particleShape: "square",
            intensity: 5,
            trailLength: 1,
        },
        saw: {
            color: "#FFEE44",
            secondaryColor: "#FF8800",
            particleShape: "spark",
            intensity: 3,
            trailLength: 3,
        },
        lance: {
            color: "#AAEEFF",
            secondaryColor: "#6699FF",
            particleShape: "circle",
            intensity: 2,
            trailLength: 5,
        },
        flamethrower: {
            color: "#FF4400",
            secondaryColor: "#FFAA00",
            particleShape: "circle",
            intensity: 5,
            trailLength: 4,
        },
    };

    const effect = { ...defaults[weaponType] };
    // If bot has a distinct color, tint the secondary with it
    if (botColor && botColor !== "#888888") {
        effect.secondaryColor = botColor;
    }
    return effect;
}

// ── Particle drawing helpers ──────────────────────────────

export function drawParticleShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    shape: ParticleShape,
    rotation: number
) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    switch (shape) {
        case "circle":
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            break;
        case "spark": {
            // Diamond / elongated shape
            ctx.beginPath();
            ctx.moveTo(0, -size * 1.5);
            ctx.lineTo(size * 0.5, 0);
            ctx.lineTo(0, size * 1.5);
            ctx.lineTo(-size * 0.5, 0);
            ctx.closePath();
            ctx.fill();
            break;
        }
        case "star": {
            const spikes = 4;
            const outerR = size;
            const innerR = size * 0.4;
            ctx.beginPath();
            for (let i = 0; i < spikes * 2; i++) {
                const r = i % 2 === 0 ? outerR : innerR;
                const a = (i * Math.PI) / spikes - Math.PI / 2;
                if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
                else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            break;
        }
        case "square":
            ctx.fillRect(-size, -size, size * 2, size * 2);
            break;
    }

    ctx.restore();
}

// ── Weapon-specific attack renderers ──────────────────────

/** Spinner: rotating arc ring with sparks flying off */
function renderSpinner(
    ctx: CanvasRenderingContext2D,
    bot: BotState,
    radius: number,
    effect: AttackEffect,
    tick: number
) {
    const ringRadius = radius + 10;
    const spinAngle = (tick * 0.3) % (Math.PI * 2);

    // Rotating energy arcs
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 8 * effect.intensity;

    for (let i = 0; i < 3; i++) {
        const startAngle = spinAngle + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, startAngle, startAngle + 0.8);
        ctx.stroke();
    }

    // Flying sparks
    ctx.fillStyle = effect.secondaryColor;
    for (let i = 0; i < effect.intensity; i++) {
        const a = spinAngle + (i * Math.PI * 2) / effect.intensity;
        const sx = Math.cos(a) * ringRadius;
        const sy = Math.sin(a) * ringRadius;
        drawParticleShape(ctx, sx, sy, 2 + effect.intensity * 0.5, effect.particleShape, a);
    }

    ctx.shadowBlur = 0;
}

/** Flipper: upward arc sweep with shockwave ring */
function renderFlipper(
    ctx: CanvasRenderingContext2D,
    bot: BotState,
    radius: number,
    effect: AttackEffect,
) {
    const frame = bot.attackAnimationFrame;
    const progress = Math.min(frame / 8, 1);

    // Sweeping arc
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 4;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 12 * effect.intensity;

    const sweepAngle = progress * Math.PI;
    ctx.beginPath();
    ctx.arc(radius * 0.5, 0, radius * 0.8, -sweepAngle / 2, sweepAngle / 2);
    ctx.stroke();

    // Shockwave ring (expands outward)
    if (progress > 0.3) {
        const shockRadius = radius + (progress - 0.3) * 40 * effect.intensity;
        ctx.strokeStyle = effect.secondaryColor;
        ctx.globalAlpha = 1 - progress;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(radius * 0.7, 0, shockRadius, -0.5, 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
}

/** Hammer: overhead slam with ground-impact particles */
function renderHammer(
    ctx: CanvasRenderingContext2D,
    bot: BotState,
    radius: number,
    effect: AttackEffect,
) {
    const frame = bot.attackAnimationFrame;
    const progress = Math.min(frame / 10, 1);

    // Hammer head
    const hammerOffset = progress < 0.5
        ? radius + 5 + (progress * 2) * 15   // wind up
        : radius + 5 + (1 - (progress - 0.5) * 2) * 15; // slam down

    ctx.fillStyle = effect.color;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 6 * effect.intensity;
    ctx.fillRect(hammerOffset - 4, -10, 12, 20);

    // Shaft
    ctx.strokeStyle = effect.secondaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(hammerOffset - 4, 0);
    ctx.stroke();

    // Ground impact effect (when slam hits)
    if (progress > 0.5) {
        const impactProgress = (progress - 0.5) * 2;
        const impactRadius = 10 + impactProgress * 25 * effect.intensity;

        // Double ring impact — outer ring fades fast, inner ring fades slow
        ctx.strokeStyle = effect.color;
        ctx.globalAlpha = (1 - impactProgress) * 0.8;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(hammerOffset + 6, 0, impactRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = effect.secondaryColor;
        ctx.globalAlpha = (1 - impactProgress) * 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hammerOffset + 6, 0, impactRadius * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        // Screen-flash glow — pulsing circle behind impact
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = (1 - impactProgress) * 0.15;
        ctx.beginPath();
        ctx.arc(hammerOffset + 6, 0, impactRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Impact sparks — more particles, wider spread
        ctx.fillStyle = effect.secondaryColor;
        ctx.globalAlpha = 1 - impactProgress;
        const sparkCount = effect.intensity * 3;
        for (let i = 0; i < sparkCount; i++) {
            const a = (i / sparkCount) * Math.PI * 2;
            const dist = impactRadius * (0.6 + Math.random() * 0.4);
            drawParticleShape(
                ctx,
                hammerOffset + 6 + Math.cos(a) * dist,
                Math.sin(a) * dist,
                2 + effect.intensity * 0.7,
                effect.particleShape,
                a
            );
        }
        ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
}

/** Saw: spinning blade disc with cutting sparks */
function renderSaw(
    ctx: CanvasRenderingContext2D,
    _bot: BotState,
    radius: number,
    effect: AttackEffect,
    tick: number
) {
    const sawX = radius + 14;
    const sawRadius = 10 + effect.intensity;
    const spinAngle = (tick * 0.5) % (Math.PI * 2);

    // Saw disc
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 8;

    // Outer ring
    ctx.beginPath();
    ctx.arc(sawX, 0, sawRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Teeth (rotating lines)
    const teeth = 6;
    for (let i = 0; i < teeth; i++) {
        const a = spinAngle + (i * Math.PI * 2) / teeth;
        ctx.beginPath();
        ctx.moveTo(sawX + Math.cos(a) * sawRadius * 0.5, Math.sin(a) * sawRadius * 0.5);
        ctx.lineTo(sawX + Math.cos(a) * sawRadius, Math.sin(a) * sawRadius);
        ctx.stroke();
    }

    // Cutting sparks trail
    ctx.fillStyle = effect.secondaryColor;
    for (let i = 0; i < effect.intensity * 2; i++) {
        const sparkAngle = spinAngle + (i * 0.7);
        const sparkDist = sawRadius + 3 + Math.random() * 5;
        drawParticleShape(
            ctx,
            sawX + Math.cos(sparkAngle) * sparkDist,
            Math.sin(sparkAngle) * sparkDist,
            1.5 + Math.random() * 2,
            effect.particleShape,
            sparkAngle
        );
    }

    ctx.shadowBlur = 0;
}

/** Lance: thrust line with speed trail */
function renderLance(
    ctx: CanvasRenderingContext2D,
    bot: BotState,
    radius: number,
    effect: AttackEffect,
) {
    const frame = bot.attackAnimationFrame;
    const progress = Math.min(frame / 8, 1);
    const thrustDist = radius + progress * (bot.definition.weapon.range * 0.7);

    // Lance shaft
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 6 * effect.intensity;

    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(thrustDist, 0);
    ctx.stroke();

    // Lance tip
    ctx.fillStyle = effect.color;
    ctx.beginPath();
    ctx.moveTo(thrustDist + 8, 0);
    ctx.lineTo(thrustDist - 4, -5);
    ctx.lineTo(thrustDist - 4, 5);
    ctx.closePath();
    ctx.fill();

    // Speed trail
    ctx.strokeStyle = effect.secondaryColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < effect.trailLength; i++) {
        const trailOffset = (i + 1) * 8;
        const trailAlpha = 1 - (i + 1) / (effect.trailLength + 1);
        ctx.globalAlpha = trailAlpha * 0.5;
        ctx.beginPath();
        ctx.moveTo(radius, -(3 + i * 2));
        ctx.lineTo(thrustDist - trailOffset, -(3 + i * 2));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(radius, 3 + i * 2);
        ctx.lineTo(thrustDist - trailOffset, 3 + i * 2);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

/** Flamethrower: cone of colored fire particles with heat wobble */
function renderFlamethrower(
    ctx: CanvasRenderingContext2D,
    _bot: BotState,
    radius: number,
    effect: AttackEffect,
    tick: number
) {
    const weaponRange = 60 + effect.trailLength * 10;
    const coneHalfAngle = 0.35 + effect.intensity * 0.07;

    // Heat wobble — subtle rotation oscillation simulating heat distortion
    const wobble = Math.sin(tick * 0.4) * 0.03 * effect.intensity;
    ctx.save();
    ctx.rotate(wobble);

    // Fire cone glow (wider, brighter)
    ctx.fillStyle = effect.color;
    ctx.globalAlpha = 0.2 + effect.intensity * 0.06;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(
        radius + weaponRange * Math.cos(-coneHalfAngle),
        weaponRange * Math.sin(-coneHalfAngle)
    );
    ctx.lineTo(
        radius + weaponRange * Math.cos(coneHalfAngle),
        weaponRange * Math.sin(coneHalfAngle)
    );
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Inner bright core (hot center)
    ctx.fillStyle = effect.secondaryColor;
    ctx.globalAlpha = 0.12;
    const innerAngle = coneHalfAngle * 0.4;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(
        radius + weaponRange * 0.6 * Math.cos(-innerAngle),
        weaponRange * 0.6 * Math.sin(-innerAngle)
    );
    ctx.lineTo(
        radius + weaponRange * 0.6 * Math.cos(innerAngle),
        weaponRange * 0.6 * Math.sin(innerAngle)
    );
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Fire particles (doubled count for richer flames)
    const particleCount = effect.intensity * 6;
    for (let i = 0; i < particleCount; i++) {
        const t = (i + tick * 0.25) % particleCount;
        const dist = radius + (t / particleCount) * weaponRange;
        const spread = (t / particleCount) * coneHalfAngle;
        const angle = (Math.random() - 0.5) * spread * 2;
        const px = dist * Math.cos(angle);
        const py = dist * Math.sin(angle);
        const alpha = 1 - t / particleCount;
        const size = 2 + (t / particleCount) * 5 * (effect.intensity / 3);

        // Alternate colors: primary, secondary, and a bright flash
        const colorIdx = i % 4;
        ctx.fillStyle = colorIdx === 0 ? effect.secondaryColor
            : colorIdx === 3 ? "#FFFFFF" : effect.color;
        ctx.globalAlpha = alpha * (colorIdx === 3 ? 0.4 : 0.8);
        drawParticleShape(ctx, px, py, size, effect.particleShape, tick * 0.15 + i);
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
}

// ── Main dispatcher ───────────────────────────────────────

const RENDERERS: Record<
    WeaponType,
    (ctx: CanvasRenderingContext2D, bot: BotState, radius: number, effect: AttackEffect, tick: number) => void
> = {
    spinner: renderSpinner,
    flipper: renderFlipper,
    hammer: renderHammer,
    saw: renderSaw,
    lance: renderLance,
    flamethrower: renderFlamethrower,
};

/**
 * Render a weapon attack effect for a bot.
 * Call this inside ctx.save/restore while translated+rotated to the bot's position.
 */
export function renderAttackEffect(
    ctx: CanvasRenderingContext2D,
    bot: BotState,
    radius: number,
    tick: number
) {
    const effect = bot.definition.attackEffect;
    const weaponType = bot.definition.weapon.type;
    const renderer = RENDERERS[weaponType];

    if (renderer) {
        renderer(ctx, bot, radius, effect, tick);
    }
}

/**
 * Spawn weapon-specific particles from an attack.
 * Returns particles colored by the attacker's attack effect.
 */
export function spawnAttackParticles(
    bot: BotState,
    targetX: number,
    targetY: number,
    damage: number
): EffectParticle[] {
    const effect = bot.definition.attackEffect;
    const count = Math.ceil(damage * effect.intensity * 0.8);
    const particles: EffectParticle[] = [];

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
            x: targetX,
            y: targetY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 15 + Math.random() * 20,
            maxLife: 35,
            color: i % 2 === 0 ? effect.color : effect.secondaryColor,
            size: 2 + Math.random() * 3,
            shape: effect.particleShape,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
        });
    }

    return particles;
}

// ── Weapon idle animations ────────────────────────────────

const IDLE_RENDERERS: Record<
    WeaponType,
    (ctx: CanvasRenderingContext2D, radius: number, effect: AttackEffect, tick: number) => void
> = {
    spinner: (ctx, radius, effect, tick) => {
        // Slow pulsing ring
        const pulse = 0.3 + Math.sin(tick * 0.05) * 0.15;
        ctx.strokeStyle = effect.color;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    },
    flipper: (ctx, radius, effect, tick) => {
        // Subtle glow bar at front
        const pulse = 0.2 + Math.sin(tick * 0.06) * 0.1;
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = pulse;
        ctx.fillRect(radius + 2, -8, 4, 16);
        ctx.globalAlpha = 1;
    },
    hammer: (ctx, radius, effect, tick) => {
        // Small hammer head silhouette
        const bob = Math.sin(tick * 0.04) * 2;
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(radius + 4, -6 + bob, 8, 12);
        ctx.globalAlpha = 1;
    },
    saw: (ctx, radius, effect, tick) => {
        // Slowly spinning blade outline
        const sawX = radius + 10;
        const sawR = 8;
        const spinAngle = tick * 0.08;
        ctx.strokeStyle = effect.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sawX, 0, sawR, 0, Math.PI * 2);
        ctx.stroke();
        // 4 teeth
        for (let i = 0; i < 4; i++) {
            const a = spinAngle + (i * Math.PI) / 2;
            ctx.beginPath();
            ctx.moveTo(sawX + Math.cos(a) * sawR * 0.4, Math.sin(a) * sawR * 0.4);
            ctx.lineTo(sawX + Math.cos(a) * sawR, Math.sin(a) * sawR);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    },
    lance: (ctx, radius, effect, tick) => {
        // Glowing tip
        const pulse = 0.2 + Math.sin(tick * 0.07) * 0.15;
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(radius + 8, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    },
    flamethrower: (ctx, radius, effect, tick) => {
        // Flickering ember at nozzle
        const flicker = 0.2 + Math.random() * 0.2;
        const jitter = (Math.random() - 0.5) * 3;
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = flicker;
        ctx.beginPath();
        ctx.arc(radius + 5 + jitter, jitter * 0.5, 2 + Math.sin(tick * 0.2) * 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    },
};

/**
 * Render a subtle weapon idle animation when the bot is NOT attacking.
 * Call inside ctx.save/restore while translated+rotated to the bot's position.
 */
export function renderWeaponIdle(
    ctx: CanvasRenderingContext2D,
    bot: BotState,
    radius: number,
    tick: number
) {
    const effect = bot.definition.attackEffect;
    const weaponType = bot.definition.weapon.type;
    const renderer = IDLE_RENDERERS[weaponType];
    if (renderer) {
        renderer(ctx, radius, effect, tick);
    }
}
