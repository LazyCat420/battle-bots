/**
 * Physics 3D Types — Engine-agnostic 3D physics abstraction.
 *
 * Mirrors `physics-types.ts` but for 3D (Vec3 instead of Vec2).
 * This allows the 3D game engine to work with any physics backend
 * (Rapier3D, Cannon.js, Ammo.js) without coupling.
 */

// ── Vector Types ──────────────────────────────────────────

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

// ── Opaque Handles ────────────────────────────────────────

export type BodyHandle3D = number;

// ── Body Configuration ────────────────────────────────────

export type BodyShape3D = "box" | "sphere" | "cylinder" | "capsule";

export interface BodyConfig3D {
    label: string;
    shape: BodyShape3D;
    position: Vec3;
    /** Half-extents for box, radius for sphere/capsule */
    halfExtents?: Vec3;
    radius?: number;
    halfHeight?: number;
    density: number;
    friction: number;
    restitution: number;
    isStatic?: boolean;
}

// ── Collision Info ─────────────────────────────────────────

export interface CollisionInfo3D {
    bodyA: BodyHandle3D;
    bodyB: BodyHandle3D;
    normal: Vec3;
}

export type CollisionCallback3D = (info: CollisionInfo3D) => void;

// ── Physics World 3D Interface ────────────────────────────

export interface PhysicsWorld3D {
    // ── Lifecycle ──────────────────────────────
    step(dt: number): void;
    destroy(): void;

    // ── Body Management ────────────────────────
    createBody(config: BodyConfig3D): BodyHandle3D;
    removeBody(handle: BodyHandle3D): void;

    // ── Position & Rotation ────────────────────
    getPosition(handle: BodyHandle3D): Vec3;
    setPosition(handle: BodyHandle3D, pos: Vec3): void;
    getRotationY(handle: BodyHandle3D): number;
    setRotationY(handle: BodyHandle3D, angle: number): void;

    // ── Velocity ───────────────────────────────
    getLinearVelocity(handle: BodyHandle3D): Vec3;
    setLinearVelocity(handle: BodyHandle3D, vel: Vec3): void;

    // ── Forces ─────────────────────────────────
    applyImpulse(handle: BodyHandle3D, impulse: Vec3): void;

    // ── Queries ────────────────────────────────
    getMass(handle: BodyHandle3D): number;

    // ── Collision ──────────────────────────────
    onCollisionStart(callback: CollisionCallback3D): void;

    // ── Convenience ────────────────────────────
    createStaticBox(
        position: Vec3,
        halfExtents: Vec3,
        label?: string
    ): BodyHandle3D;
}
