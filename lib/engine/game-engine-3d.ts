/**
 * 3D Game Engine — Rapier3D-based game loop for BattleBots in 3D.
 *
 * Reuses the same BotDefinition, behavior sandbox, and GameState types
 * as the 2D engine, but operates in XZ-plane 3D space using Rapier3D.
 */

import { v4 as uuidv4 } from "uuid";
import type {
    BotDefinition,
    BotState,
    DamageEvent,
    GameState,
} from "@/lib/types/bot";
import {
    compileBehavior,
    createBehaviorAPI,
    executeBehavior,
    type BotActions,
} from "@/lib/engine/sandbox";
import { initRapier, RapierWorld3D } from "@/lib/engine/rapier-adapter";
import type { BodyHandle3D, Vec3 } from "@/lib/engine/physics3d-types";

// ── Constants ─────────────────────────────────────────────

/** 3D Arena is 20m × 20m (mapped to ~800×800px equivalent) */
export const ARENA_SIZE_3D = 10; // half-extent in meters
const FLOOR_Y = 0;
const WALL_HEIGHT = 2;
const WALL_THICKNESS = 0.3;
const MATCH_DURATION = 90;
const TICK_RATE = 30;
const TICK_INTERVAL = 1000 / TICK_RATE;
const BASE_HEALTH = 100;

/** Maps bot size (1-5) to physics radius in meters */
const SIZE_TO_RADIUS_3D: Record<number, number> = {
    1: 0.3,
    2: 0.4,
    3: 0.5,
    4: 0.6,
    5: 0.7,
};

/**
 * 3D Game State — extends the 2D GameState with 3D positions.
 *
 * The positions in `bots[n].position` are mapped:
 *   - x → 3D world X
 *   - y → 3D world Z   (since 2D Y maps to ground-plane Z)
 *   - 3D world Y is always 0 (ground level)
 */
export interface GameState3D extends Omit<GameState, "arenaWidth" | "arenaHeight"> {
    arenaSize: number; // half-extent
    /** 3D Y positions for each bot (for rendering) */
    botY: [number, number];
}

// ── Engine ─────────────────────────────────────────────────

export class GameEngine3D {
    private physics: RapierWorld3D | null = null;
    private bodyHandles: [BodyHandle3D, BodyHandle3D] = [0, 0];
    private botStates: [BotState, BotState];
    private behaviorFns: [
        ((api: import("@/lib/types/bot").BehaviorAPI, tick: number) => void) | null,
        ((api: import("@/lib/types/bot").BehaviorAPI, tick: number) => void) | null
    ];
    private tickCount = 0;
    private timeRemaining = MATCH_DURATION;
    private status: GameState["status"] = "waiting";
    private winner: string | null = null;
    private damageEvents: DamageEvent[] = [];
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private onStateUpdate: ((state: GameState3D) => void) | null = null;
    private initPromise: Promise<void>;
    private defs: [BotDefinition, BotDefinition];

    constructor(def1: BotDefinition, def2: BotDefinition) {
        this.defs = [def1, def2];

        // Placeholder bot states until physics is initialized
        const id1 = uuidv4();
        const id2 = uuidv4();
        this.botStates = [
            this.createBotState(id1, def1, { x: -ARENA_SIZE_3D * 0.6, y: 0 }),
            this.createBotState(id2, def2, { x: ARENA_SIZE_3D * 0.6, y: 0 }),
        ];

        // Compile behavior functions
        const compile1 = compileBehavior(def1.behaviorCode);
        const compile2 = compileBehavior(def2.behaviorCode);
        this.behaviorFns = [
            compile1.error ? null : compile1.fn,
            compile2.error ? null : compile2.fn,
        ];

        if (compile1.error) console.warn(`Bot 1 compile error: ${compile1.error}`);
        if (compile2.error) console.warn(`Bot 2 compile error: ${compile2.error}`);

        // Initialize Rapier asynchronously
        this.initPromise = this.initPhysics();
    }

    private async initPhysics(): Promise<void> {
        await initRapier();
        this.physics = new RapierWorld3D({ x: 0, y: -9.81, z: 0 });

        // Create arena floor
        this.physics.createStaticBox(
            { x: 0, y: -0.5, z: 0 },
            { x: ARENA_SIZE_3D, y: 0.5, z: ARENA_SIZE_3D },
            "floor"
        );

        // Create arena walls (4 sides)
        const walls: Array<{ pos: Vec3; half: Vec3; label: string }> = [
            { pos: { x: 0, y: WALL_HEIGHT / 2, z: -ARENA_SIZE_3D }, half: { x: ARENA_SIZE_3D, y: WALL_HEIGHT / 2, z: WALL_THICKNESS / 2 }, label: "wall_north" },
            { pos: { x: 0, y: WALL_HEIGHT / 2, z: ARENA_SIZE_3D }, half: { x: ARENA_SIZE_3D, y: WALL_HEIGHT / 2, z: WALL_THICKNESS / 2 }, label: "wall_south" },
            { pos: { x: -ARENA_SIZE_3D, y: WALL_HEIGHT / 2, z: 0 }, half: { x: WALL_THICKNESS / 2, y: WALL_HEIGHT / 2, z: ARENA_SIZE_3D }, label: "wall_west" },
            { pos: { x: ARENA_SIZE_3D, y: WALL_HEIGHT / 2, z: 0 }, half: { x: WALL_THICKNESS / 2, y: WALL_HEIGHT / 2, z: ARENA_SIZE_3D }, label: "wall_east" },
        ];
        for (const w of walls) {
            this.physics.createStaticBox(w.pos, w.half, w.label);
        }

        // Create bot physics bodies
        const r0 = SIZE_TO_RADIUS_3D[Math.round(this.defs[0].size)] ?? 0.5;
        const r1 = SIZE_TO_RADIUS_3D[Math.round(this.defs[1].size)] ?? 0.5;

        this.bodyHandles[0] = this.physics.createBody({
            label: "bot_0",
            shape: "box",
            position: { x: -ARENA_SIZE_3D * 0.6, y: r0 + 0.1, z: 0 },
            halfExtents: { x: r0, y: r0 * 0.6, z: r0 },
            density: 5 * (1 + this.defs[0].armor * 0.1),
            friction: 0.5,
            restitution: 0.2,
        });

        this.bodyHandles[1] = this.physics.createBody({
            label: "bot_1",
            shape: "box",
            position: { x: ARENA_SIZE_3D * 0.6, y: r1 + 0.1, z: 0 },
            halfExtents: { x: r1, y: r1 * 0.6, z: r1 },
            density: 5 * (1 + this.defs[1].armor * 0.1),
            friction: 0.5,
            restitution: 0.2,
        });
    }

    private createBotState(
        id: string,
        def: BotDefinition,
        position: { x: number; y: number }
    ): BotState {
        return {
            id,
            definition: def,
            position,
            angle: 0,
            velocity: { x: 0, y: 0 },
            health: BASE_HEALTH,
            maxHealth: BASE_HEALTH,
            weaponCooldownRemaining: 0,
            isAttacking: false,
            attackAnimationFrame: 0,
        };
    }

    // ── Public API ─────────────────────────────────────────

    onUpdate(callback: (state: GameState3D) => void) {
        this.onStateUpdate = callback;
    }

    getState(): GameState3D {
        const botY: [number, number] = [0, 0];
        if (this.physics) {
            for (let i = 0; i < 2; i++) {
                const pos = this.physics.getPosition(this.bodyHandles[i]);
                botY[i as 0 | 1] = pos.y;
            }
        }

        return {
            bots: [{ ...this.botStates[0] }, { ...this.botStates[1] }],
            status: this.status,
            winner: this.winner,
            tickCount: this.tickCount,
            timeRemaining: this.timeRemaining,
            damageEvents: [...this.damageEvents],
            arenaSize: ARENA_SIZE_3D,
            botY,
        };
    }

    async start() {
        await this.initPromise;
        this.status = "countdown";

        setTimeout(() => {
            this.status = "fighting";
            this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL);
        }, 3000);
    }

    async startImmediate() {
        await this.initPromise;
        this.status = "fighting";
        this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    destroy() {
        this.stop();
        this.physics?.destroy();
        this.physics = null;
    }

    // ── Tick ───────────────────────────────────────────────

    private tick() {
        if (this.status !== "fighting" || !this.physics) return;

        this.tickCount++;
        this.damageEvents = [];

        // Time
        this.timeRemaining -= 1 / TICK_RATE;
        if (this.timeRemaining <= 0) {
            this.endMatch();
            return;
        }

        // Behavior — map 3D positions to 2D for the behavior API
        // (behaviors work in ~"pixel" space: 0..ARENA_SIZE_3D*2 mapped to 0..800)
        const arenaPixelSize = 800;
        const scale = arenaPixelSize / (ARENA_SIZE_3D * 2);

        for (let i = 0; i < 2; i++) {
            const botIdx = i as 0 | 1;
            const enemyIdx = (1 - i) as 0 | 1;
            const fn = this.behaviorFns[botIdx];

            if (fn) {
                // Map 3D XZ to 2D XY for behavior API
                const pos3d = this.physics.getPosition(this.bodyHandles[botIdx]);
                const botState2d = {
                    ...this.botStates[botIdx],
                    position: {
                        x: (pos3d.x + ARENA_SIZE_3D) * scale,
                        y: (pos3d.z + ARENA_SIZE_3D) * scale,
                    },
                };
                const enemyPos3d = this.physics.getPosition(this.bodyHandles[enemyIdx]);
                const enemyState2d = {
                    ...this.botStates[enemyIdx],
                    position: {
                        x: (enemyPos3d.x + ARENA_SIZE_3D) * scale,
                        y: (enemyPos3d.z + ARENA_SIZE_3D) * scale,
                    },
                };

                const { api, actions } = createBehaviorAPI(
                    botState2d,
                    enemyState2d,
                    arenaPixelSize,
                    arenaPixelSize
                );
                executeBehavior(fn, api, this.tickCount);
                this.applyActions3D(botIdx, actions, scale);
            }
        }

        // Step physics
        this.physics.step(TICK_INTERVAL);

        // Sync state from physics (back to 2D "pixel" space for state)
        for (let i = 0; i < 2; i++) {
            const idx = i as 0 | 1;
            const pos3d = this.physics.getPosition(this.bodyHandles[idx]);
            const vel3d = this.physics.getLinearVelocity(this.bodyHandles[idx]);

            // Store 3D world position mapped to 2D for compatibility
            this.botStates[idx].position = {
                x: (pos3d.x + ARENA_SIZE_3D) * scale,
                y: (pos3d.z + ARENA_SIZE_3D) * scale,
            };
            this.botStates[idx].angle = this.physics.getRotationY(this.bodyHandles[idx]);
            this.botStates[idx].velocity = {
                x: vel3d.x * scale,
                y: vel3d.z * scale,
            };

            // Tick weapon cooldown
            if (this.botStates[idx].weaponCooldownRemaining > 0) {
                this.botStates[idx].weaponCooldownRemaining -= TICK_INTERVAL;
            }

            // Tick attack animation
            if (this.botStates[idx].isAttacking) {
                this.botStates[idx].attackAnimationFrame++;
                if (this.botStates[idx].attackAnimationFrame > 10) {
                    this.botStates[idx].isAttacking = false;
                    this.botStates[idx].attackAnimationFrame = 0;
                }
            }
        }

        // Check win
        if (this.botStates[0].health <= 0 || this.botStates[1].health <= 0) {
            this.endMatch();
            return;
        }

        if (this.onStateUpdate) {
            this.onStateUpdate(this.getState());
        }
    }

    // ── Actions ────────────────────────────────────────────

    private applyActions3D(botIdx: 0 | 1, actions: BotActions, scale: number) {
        if (!this.physics) return;
        const bot = this.botStates[botIdx];
        const handle = this.bodyHandles[botIdx];

        if (actions.stop) {
            this.physics.setLinearVelocity(handle, { x: 0, y: 0, z: 0 });
            return;
        }

        // Movement — actions.moveTarget is in pixel-space, convert to 3D
        if (actions.moveTarget) {
            const targetX = actions.moveTarget.x / scale - ARENA_SIZE_3D;
            const targetZ = actions.moveTarget.y / scale - ARENA_SIZE_3D;

            const pos = this.physics.getPosition(handle);
            const dx = targetX - pos.x;
            const dz = targetZ - pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 0.1) {
                let speed = (actions.moveSpeed ?? bot.definition.speed) * 0.15;
                speed = Math.min(speed, 3);
                const dirX = dx / dist;
                const dirZ = dz / dist;

                const sign = actions.moveAway ? -1 : 1;
                this.physics.setLinearVelocity(handle, {
                    x: dirX * speed * sign,
                    y: this.physics.getLinearVelocity(handle).y, // preserve gravity
                    z: dirZ * speed * sign,
                });

                // Face movement direction
                const angle = Math.atan2(dirX * sign, dirZ * sign);
                this.physics.setRotationY(handle, angle);
            }
        }

        // Strafing
        if (actions.strafeDirection) {
            const enemyIdx = (1 - botIdx) as 0 | 1;
            const enemyPos = this.physics.getPosition(this.bodyHandles[enemyIdx]);
            const pos = this.physics.getPosition(handle);

            const angleToEnemy = Math.atan2(
                enemyPos.x - pos.x,
                enemyPos.z - pos.z
            );
            const strafeAngle =
                actions.strafeDirection === "left"
                    ? angleToEnemy - Math.PI / 2
                    : angleToEnemy + Math.PI / 2;

            const speed = bot.definition.speed * 0.08;
            const curVel = this.physics.getLinearVelocity(handle);
            this.physics.setLinearVelocity(handle, {
                x: curVel.x + Math.sin(strafeAngle) * speed,
                y: curVel.y,
                z: curVel.z + Math.cos(strafeAngle) * speed,
            });
        }

        // Rotation
        if (actions.rotateTarget !== null) {
            this.physics.setRotationY(handle, actions.rotateTarget);
        }

        // Attack
        if (actions.attack && bot.weaponCooldownRemaining <= 0) {
            this.performAttack3D(botIdx);
        }
    }

    private performAttack3D(attackerIdx: 0 | 1) {
        if (!this.physics) return;
        const attacker = this.botStates[attackerIdx];
        const targetIdx = (1 - attackerIdx) as 0 | 1;
        const target = this.botStates[targetIdx];

        const aPos = this.physics.getPosition(this.bodyHandles[attackerIdx]);
        const tPos = this.physics.getPosition(this.bodyHandles[targetIdx]);

        const dx = tPos.x - aPos.x;
        const dz = tPos.z - aPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Range in 3D meters (weapon range is in pixels, convert)
        const rangeMeters = attacker.definition.weapon.range * 0.025 + 1;

        if (dist <= rangeMeters) {
            const baseDamage = attacker.definition.weapon.damage;
            const armorReduction = target.definition.armor * 0.05;
            const damage = Math.max(1, baseDamage * (1 - armorReduction));

            target.health = Math.max(0, target.health - damage);

            // Knockback impulse
            if (dist > 0) {
                const knockbackForce = baseDamage * 0.3;
                this.physics.applyImpulse(this.bodyHandles[targetIdx], {
                    x: (dx / dist) * knockbackForce,
                    y: knockbackForce * 0.3,
                    z: (dz / dist) * knockbackForce,
                });
            }

            this.damageEvents.push({
                attackerId: attacker.id,
                targetId: target.id,
                damage,
                position: { x: target.position.x, y: target.position.y },
                tick: this.tickCount,
            });
        }

        attacker.weaponCooldownRemaining = attacker.definition.weapon.cooldown;
        attacker.isAttacking = true;
        attacker.attackAnimationFrame = 0;
    }

    private endMatch() {
        this.stop();
        this.status = "finished";

        if (this.botStates[0].health <= 0 && this.botStates[1].health <= 0) {
            this.winner = null;
        } else if (this.botStates[0].health <= 0) {
            this.winner = this.botStates[1].id;
        } else if (this.botStates[1].health <= 0) {
            this.winner = this.botStates[0].id;
        } else {
            if (this.botStates[0].health > this.botStates[1].health) {
                this.winner = this.botStates[0].id;
            } else if (this.botStates[1].health > this.botStates[0].health) {
                this.winner = this.botStates[1].id;
            } else {
                this.winner = null;
            }
        }

        if (this.onStateUpdate) {
            this.onStateUpdate(this.getState());
        }
    }
}
