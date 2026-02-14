/**
 * Rapier3D Adapter — Implements PhysicsWorld3D using @dimforge/rapier3d-compat.
 *
 * This is the concrete physics implementation for the 3D arena.
 * Uses Rapier's WASM-based deterministic physics engine.
 */

import RAPIER from "@dimforge/rapier3d-compat";
import type {
    PhysicsWorld3D,
    BodyConfig3D,
    BodyHandle3D,
    Vec3,
    CollisionCallback3D,
} from "./physics3d-types";

let rapierInit: Promise<void> | null = null;

/** Must be called once before creating any RapierWorld3D instances. */
export async function initRapier(): Promise<void> {
    if (!rapierInit) {
        rapierInit = RAPIER.init();
    }
    await rapierInit;
}

/**
 * Rapier3D physics world implementation.
 */
export class RapierWorld3D implements PhysicsWorld3D {
    private world: RAPIER.World;
    private bodies = new Map<BodyHandle3D, RAPIER.RigidBody>();
    private colliders = new Map<BodyHandle3D, RAPIER.Collider>();
    private collisionCallbacks: CollisionCallback3D[] = [];
    private nextHandle = 1;
    private eventQueue: RAPIER.EventQueue;

    constructor(gravity: Vec3 = { x: 0, y: -9.81, z: 0 }) {
        this.world = new RAPIER.World(
            new RAPIER.Vector3(gravity.x, gravity.y, gravity.z)
        );
        this.eventQueue = new RAPIER.EventQueue(true);
    }

    // ── Lifecycle ──────────────────────────────────

    step(dt: number): void {
        // Rapier uses seconds, not ms
        const dtSec = dt / 1000;
        this.world.timestep = dtSec;
        this.world.step(this.eventQueue);

        // Drain collision events
        this.eventQueue.drainCollisionEvents(
            (handle1: number, handle2: number, started: boolean) => {
                if (!started) return;

                // Find body handles from collider handles
                let bodyHandleA: BodyHandle3D | null = null;
                let bodyHandleB: BodyHandle3D | null = null;

                for (const [bh, collider] of this.colliders) {
                    if (collider.handle === handle1) bodyHandleA = bh;
                    if (collider.handle === handle2) bodyHandleB = bh;
                }

                if (bodyHandleA !== null && bodyHandleB !== null) {
                    for (const cb of this.collisionCallbacks) {
                        cb({
                            bodyA: bodyHandleA,
                            bodyB: bodyHandleB,
                            normal: { x: 0, y: 1, z: 0 },
                        });
                    }
                }
            }
        );
    }

    destroy(): void {
        this.world.free();
        this.eventQueue.free();
        this.bodies.clear();
        this.colliders.clear();
    }

    // ── Body Management ────────────────────────────

    createBody(config: BodyConfig3D): BodyHandle3D {
        const handle = this.nextHandle++;

        // Create rigid body
        const bodyDesc = config.isStatic
            ? RAPIER.RigidBodyDesc.fixed()
            : RAPIER.RigidBodyDesc.dynamic();

        bodyDesc.setTranslation(
            config.position.x,
            config.position.y,
            config.position.z
        );

        const body = this.world.createRigidBody(bodyDesc);

        // Create collider
        let colliderDesc: RAPIER.ColliderDesc;

        switch (config.shape) {
            case "box": {
                const hx = config.halfExtents?.x ?? 0.5;
                const hy = config.halfExtents?.y ?? 0.5;
                const hz = config.halfExtents?.z ?? 0.5;
                colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
                break;
            }
            case "sphere": {
                colliderDesc = RAPIER.ColliderDesc.ball(config.radius ?? 0.5);
                break;
            }
            case "cylinder": {
                colliderDesc = RAPIER.ColliderDesc.cylinder(
                    config.halfHeight ?? 0.5,
                    config.radius ?? 0.5
                );
                break;
            }
            case "capsule": {
                colliderDesc = RAPIER.ColliderDesc.capsule(
                    config.halfHeight ?? 0.5,
                    config.radius ?? 0.3
                );
                break;
            }
            default:
                colliderDesc = RAPIER.ColliderDesc.ball(0.5);
        }

        colliderDesc
            .setDensity(config.density)
            .setFriction(config.friction)
            .setRestitution(config.restitution)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

        const collider = this.world.createCollider(colliderDesc, body);

        this.bodies.set(handle, body);
        this.colliders.set(handle, collider);
        return handle;
    }

    removeBody(handle: BodyHandle3D): void {
        const body = this.bodies.get(handle);
        if (body) {
            this.world.removeRigidBody(body);
            this.bodies.delete(handle);
            this.colliders.delete(handle);
        }
    }

    // ── Position & Rotation ────────────────────────

    getPosition(handle: BodyHandle3D): Vec3 {
        const body = this.bodies.get(handle);
        if (!body) return { x: 0, y: 0, z: 0 };
        const t = body.translation();
        return { x: t.x, y: t.y, z: t.z };
    }

    setPosition(handle: BodyHandle3D, pos: Vec3): void {
        const body = this.bodies.get(handle);
        if (body) body.setTranslation(new RAPIER.Vector3(pos.x, pos.y, pos.z), true);
    }

    getRotationY(handle: BodyHandle3D): number {
        const body = this.bodies.get(handle);
        if (!body) return 0;
        const q = body.rotation();
        // Extract Y-axis rotation from quaternion
        return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
    }

    setRotationY(handle: BodyHandle3D, angle: number): void {
        const body = this.bodies.get(handle);
        if (body) {
            // Set quaternion from Y rotation
            const halfAngle = angle / 2;
            body.setRotation(
                { x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) },
                true
            );
        }
    }

    // ── Velocity ───────────────────────────────────

    getLinearVelocity(handle: BodyHandle3D): Vec3 {
        const body = this.bodies.get(handle);
        if (!body) return { x: 0, y: 0, z: 0 };
        const v = body.linvel();
        return { x: v.x, y: v.y, z: v.z };
    }

    setLinearVelocity(handle: BodyHandle3D, vel: Vec3): void {
        const body = this.bodies.get(handle);
        if (body) body.setLinvel(new RAPIER.Vector3(vel.x, vel.y, vel.z), true);
    }

    // ── Forces ─────────────────────────────────────

    applyImpulse(handle: BodyHandle3D, impulse: Vec3): void {
        const body = this.bodies.get(handle);
        if (body) body.applyImpulse(new RAPIER.Vector3(impulse.x, impulse.y, impulse.z), true);
    }

    // ── Queries ────────────────────────────────────

    getMass(handle: BodyHandle3D): number {
        const body = this.bodies.get(handle);
        return body ? body.mass() : 0;
    }

    // ── Collision ──────────────────────────────────

    onCollisionStart(callback: CollisionCallback3D): void {
        this.collisionCallbacks.push(callback);
    }

    // ── Convenience ────────────────────────────────

    createStaticBox(
        position: Vec3,
        halfExtents: Vec3,
        label?: string
    ): BodyHandle3D {
        return this.createBody({
            label: label ?? "static_box",
            shape: "box",
            position,
            halfExtents,
            density: 1,
            friction: 0.5,
            restitution: 0.2,
            isStatic: true,
        });
    }
}
