"use client";

/**
 * Arena Canvas — 2D top-down battle arena renderer.
 *
 * Renders bot shapes, weapon attack effects (via attack-effects.ts),
 * health bars, damage particles, and arena borders on an HTML5 canvas.
 */
import { useRef, useEffect, useCallback } from "react";
import { GameState, BotState, DamageEvent } from "@/lib/types/bot";
import { ARENA_WIDTH, ARENA_HEIGHT } from "@/lib/engine/game-engine";
import { renderAttackEffect, renderWeaponIdle, spawnAttackParticles, drawParticleShape, EffectParticle } from "@/lib/engine/attack-effects";

interface ArenaCanvasProps {
    gameState: GameState | null;
    countdown?: number;
}

const SIZE_TO_RADIUS: Record<number, number> = {
    1: 15,
    2: 20,
    3: 25,
    4: 30,
    5: 35,
};

export default function ArenaCanvas({ gameState, countdown }: ArenaCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<EffectParticle[]>([]);
    const animFrameRef = useRef<number>(0);
    const tickRef = useRef<number>(0);

    // Spawn particles from damage events using attacker's effect colors
    const spawnDamageParticles = useCallback((events: DamageEvent[], bots: [BotState, BotState]) => {
        for (const event of events) {
            const attacker = bots.find((b) => b.id === event.attackerId);
            if (attacker) {
                const newParticles = spawnAttackParticles(
                    attacker,
                    event.position.x,
                    event.position.y,
                    event.damage
                );
                particlesRef.current.push(...newParticles);
            }
        }
    }, []);

    // Draw a bot shape
    const drawBot = useCallback(
        (ctx: CanvasRenderingContext2D, bot: BotState, playerIndex: number, tick: number) => {
            const { position, angle, definition, isAttacking } = bot;
            const radius = SIZE_TO_RADIUS[Math.round(definition.size)] || 25;

            ctx.save();
            ctx.translate(position.x, position.y);
            ctx.rotate(angle);

            // Glow effect when attacking — uses attackEffect colors
            if (isAttacking) {
                ctx.shadowColor = definition.attackEffect.color;
                ctx.shadowBlur = 15 + definition.attackEffect.intensity * 3;
            }

            // Bot body
            ctx.fillStyle = definition.color;
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.lineWidth = 2;

            ctx.beginPath();
            switch (definition.shape) {
                case "circle":
                    ctx.arc(0, 0, radius, 0, Math.PI * 2);
                    break;
                case "rectangle":
                    ctx.rect(-radius, -radius * 0.8, radius * 2, radius * 1.6);
                    break;
                case "triangle":
                    for (let i = 0; i < 3; i++) {
                        const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
                        if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
                        else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
                    }
                    ctx.closePath();
                    break;
                case "pentagon":
                    for (let i = 0; i < 5; i++) {
                        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                        if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
                        else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
                    }
                    ctx.closePath();
                    break;
                case "hexagon":
                    for (let i = 0; i < 6; i++) {
                        const a = (i * 2 * Math.PI) / 6;
                        if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
                        else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
                    }
                    ctx.closePath();
                    break;
            }
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Direction indicator (front arrow)
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.beginPath();
            ctx.moveTo(radius + 5, 0);
            ctx.lineTo(radius - 3, -5);
            ctx.lineTo(radius - 3, 5);
            ctx.closePath();
            ctx.fill();

            // Weapon attack effect or idle animation
            if (isAttacking) {
                renderAttackEffect(ctx, bot, radius, tick);
            } else {
                renderWeaponIdle(ctx, bot, radius, tick);
            }

            ctx.restore();

            // Player label above bot
            ctx.fillStyle = "#fff";
            ctx.font = "bold 11px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
                `P${playerIndex + 1}: ${definition.name}`,
                position.x,
                position.y - radius - 18
            );

            // Health bar above bot
            const barWidth = 50;
            const barHeight = 5;
            const barX = position.x - barWidth / 2;
            const barY = position.y - radius - 12;
            const healthPct = bot.health / bot.maxHealth;

            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

            const healthColor =
                healthPct > 0.6 ? "#22c55e" : healthPct > 0.3 ? "#eab308" : "#ef4444";
            ctx.fillStyle = healthColor;
            ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);
        },
        []
    );

    // Main render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const render = () => {
            tickRef.current++;
            const tick = tickRef.current;

            // Clear
            ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

            // Arena background
            const bgGrad = ctx.createRadialGradient(
                ARENA_WIDTH / 2,
                ARENA_HEIGHT / 2,
                0,
                ARENA_WIDTH / 2,
                ARENA_HEIGHT / 2,
                ARENA_WIDTH * 0.6
            );
            bgGrad.addColorStop(0, "#1a1a2e");
            bgGrad.addColorStop(1, "#0d0d1a");
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

            // Grid lines
            ctx.strokeStyle = "rgba(255,255,255,0.03)";
            ctx.lineWidth = 1;
            for (let x = 0; x < ARENA_WIDTH; x += 40) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, ARENA_HEIGHT);
                ctx.stroke();
            }
            for (let y = 0; y < ARENA_HEIGHT; y += 40) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(ARENA_WIDTH, y);
                ctx.stroke();
            }

            // Arena border
            ctx.strokeStyle = "#4a9eff";
            ctx.lineWidth = 3;
            ctx.shadowColor = "#4a9eff";
            ctx.shadowBlur = 10;
            ctx.strokeRect(2, 2, ARENA_WIDTH - 4, ARENA_HEIGHT - 4);
            ctx.shadowBlur = 0;

            // Center circle decoration
            ctx.strokeStyle = "rgba(74, 158, 255, 0.15)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 80, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 3, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(74, 158, 255, 0.3)";
            ctx.fill();

            if (gameState) {
                // Draw bots with attack effects
                drawBot(ctx, gameState.bots[0], 0, tick);
                drawBot(ctx, gameState.bots[1], 1, tick);

                // Spawn damage particles using attacker's effect colors
                if (gameState.damageEvents.length > 0) {
                    spawnDamageParticles(gameState.damageEvents, gameState.bots);
                }

                // Update and render particles
                const particles = particlesRef.current;
                for (let i = particles.length - 1; i >= 0; i--) {
                    const p = particles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vx *= 0.95;
                    p.vy *= 0.95;
                    p.life--;
                    p.rotation += p.rotationSpeed;

                    if (p.life <= 0) {
                        particles.splice(i, 1);
                        continue;
                    }

                    const alpha = p.life / p.maxLife;
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = p.color;
                    drawParticleShape(ctx, p.x, p.y, p.size * alpha, p.shape, p.rotation);
                }
                ctx.globalAlpha = 1;

                // Victory overlay
                if (gameState.status === "finished") {
                    ctx.fillStyle = "rgba(0,0,0,0.5)";
                    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

                    ctx.fillStyle = "#FFD700";
                    ctx.font = "bold 40px Inter, system-ui, sans-serif";
                    ctx.textAlign = "center";

                    if (gameState.winner) {
                        const winnerBot = gameState.bots.find((b) => b.id === gameState.winner);
                        const winnerIdx = gameState.bots[0].id === gameState.winner ? 1 : 2;
                        ctx.fillText(
                            `🏆 P${winnerIdx}: ${winnerBot?.definition.name} WINS!`,
                            ARENA_WIDTH / 2,
                            ARENA_HEIGHT / 2
                        );
                    } else {
                        ctx.fillText("DRAW!", ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
                    }
                }
            }

            // Countdown overlay
            if (countdown !== undefined && countdown > 0) {
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

                ctx.fillStyle = "#fff";
                ctx.font = "bold 80px Inter, system-ui, sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(String(countdown), ARENA_WIDTH / 2, ARENA_HEIGHT / 2 + 25);

                ctx.font = "20px Inter, system-ui, sans-serif";
                ctx.fillText("GET READY!", ARENA_WIDTH / 2, ARENA_HEIGHT / 2 - 50);
            }

            animFrameRef.current = requestAnimationFrame(render);
        };

        animFrameRef.current = requestAnimationFrame(render);

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [gameState, countdown, drawBot, spawnDamageParticles]);

    return (
        <canvas
            ref={canvasRef}
            width={ARENA_WIDTH}
            height={ARENA_HEIGHT}
            className="arena-canvas"
        />
    );
}
