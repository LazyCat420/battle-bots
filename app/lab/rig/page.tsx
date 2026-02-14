"use client";

/**
 * 3D Lab — Option C: Runtime Rigging with THREE.Bone
 *
 * Demonstrates programmatic skeleton creation for a battle bot:
 * - Chassis body with SkinnedMesh
 * - Spinning saw blade weapon (bone-animated)
 * - Articulated hammer arm with IK-style movement
 * - Animated treads/wheels
 * - All rigged at runtime — no Blender needed
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ─── Helper: create a colored mesh ──────────────────────────────
function makeMesh(
    geo: THREE.BufferGeometry,
    color: number,
    opts?: { metalness?: number; roughness?: number; emissive?: number }
): THREE.Mesh {
    const mat = new THREE.MeshStandardMaterial({
        color,
        metalness: opts?.metalness ?? 0.6,
        roughness: opts?.roughness ?? 0.3,
        emissive: opts?.emissive ?? 0x000000,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

// ─── Build a battle bot with runtime bones ──────────────────────
function buildRiggedBot(): {
    root: THREE.Group;
    bones: Record<string, THREE.Bone>;
    parts: Record<string, THREE.Object3D>;
} {
    const root = new THREE.Group();
    const bones: Record<string, THREE.Bone> = {};
    const parts: Record<string, THREE.Object3D> = {};

    // === CHASSIS (main body) ===
    const chassis = makeMesh(
        new THREE.BoxGeometry(1.2, 0.4, 0.8),
        0xcc3333,
        { metalness: 0.7, roughness: 0.25 }
    );
    chassis.position.y = 0.35;
    root.add(chassis);
    parts.chassis = chassis;

    // Armored top plate
    const topPlate = makeMesh(
        new THREE.BoxGeometry(1.0, 0.08, 0.7),
        0x992222,
        { metalness: 0.8, roughness: 0.2 }
    );
    topPlate.position.y = 0.58;
    root.add(topPlate);

    // === "HEAD" / sensor turret (bone-driven rotation) ===
    const headBone = new THREE.Bone();
    headBone.position.set(0, 0.62, 0);
    bones.head = headBone;
    root.add(headBone);

    const headMesh = makeMesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.2, 8),
        0x444444,
        { metalness: 0.9, roughness: 0.1 }
    );
    headBone.add(headMesh);

    // LED "eye"
    const eye = makeMesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        0x00ff44,
        { emissive: 0x00ff44, metalness: 0.1, roughness: 0.1 }
    );
    eye.position.set(0, 0.02, 0.2);
    headBone.add(eye);
    parts.eye = eye;

    // === SPINNING SAW WEAPON (bone-driven) ===
    const sawArmBone = new THREE.Bone();
    sawArmBone.position.set(0.7, 0.45, 0);
    bones.sawArm = sawArmBone;
    root.add(sawArmBone);

    // Arm mount
    const armMount = makeMesh(
        new THREE.BoxGeometry(0.15, 0.1, 0.15),
        0x555555,
        { metalness: 0.9, roughness: 0.15 }
    );
    sawArmBone.add(armMount);

    // Saw axle
    const sawBone = new THREE.Bone();
    sawBone.position.set(0.2, 0, 0);
    bones.saw = sawBone;
    sawArmBone.add(sawBone);

    const sawBlade = makeMesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24),
        0xcccccc,
        { metalness: 0.95, roughness: 0.05 }
    );
    sawBlade.rotation.z = Math.PI / 2;
    sawBone.add(sawBlade);
    parts.sawBlade = sawBlade;

    // Saw teeth (notches around the edge)
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const tooth = makeMesh(
            new THREE.BoxGeometry(0.04, 0.06, 0.02),
            0x999999,
            { metalness: 0.95, roughness: 0.1 }
        );
        tooth.position.set(
            Math.cos(angle) * 0.3,
            0,
            Math.sin(angle) * 0.3
        );
        tooth.rotation.z = Math.PI / 2;
        tooth.rotation.y = angle;
        sawBone.add(tooth);
    }

    // === HAMMER ARM (articulated, 2-bone chain) ===
    const shoulderBone = new THREE.Bone();
    shoulderBone.position.set(-0.65, 0.5, 0);
    bones.shoulder = shoulderBone;
    root.add(shoulderBone);

    const upperArm = makeMesh(
        new THREE.BoxGeometry(0.12, 0.35, 0.12),
        0x666666,
        { metalness: 0.85, roughness: 0.2 }
    );
    upperArm.position.y = 0.18;
    shoulderBone.add(upperArm);

    // Elbow joint
    const elbowBone = new THREE.Bone();
    elbowBone.position.set(0, 0.35, 0);
    bones.elbow = elbowBone;
    shoulderBone.add(elbowBone);

    const forearm = makeMesh(
        new THREE.BoxGeometry(0.1, 0.3, 0.1),
        0x555555,
        { metalness: 0.85, roughness: 0.2 }
    );
    forearm.position.y = 0.15;
    elbowBone.add(forearm);

    // Hammer head
    const hammerBone = new THREE.Bone();
    hammerBone.position.set(0, 0.3, 0);
    bones.hammer = hammerBone;
    elbowBone.add(hammerBone);

    const hammerHead = makeMesh(
        new THREE.BoxGeometry(0.25, 0.12, 0.18),
        0xff6600,
        { metalness: 0.9, roughness: 0.15 }
    );
    hammerBone.add(hammerHead);
    parts.hammerHead = hammerHead;

    // === WHEELS / TREADS (4 wheels, bone-driven spin) ===
    const wheelPositions = [
        { x: 0.45, z: 0.45, name: "wheelFL" },
        { x: 0.45, z: -0.45, name: "wheelFR" },
        { x: -0.45, z: 0.45, name: "wheelBL" },
        { x: -0.45, z: -0.45, name: "wheelBR" },
    ];

    for (const wp of wheelPositions) {
        const wheelBone = new THREE.Bone();
        wheelBone.position.set(wp.x, 0.12, wp.z);
        bones[wp.name] = wheelBone;
        root.add(wheelBone);

        const wheel = makeMesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16),
            0x222222,
            { metalness: 0.4, roughness: 0.8 }
        );
        wheel.rotation.x = Math.PI / 2;
        wheelBone.add(wheel);

        // Hub cap
        const hub = makeMesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.09, 8),
            0x888888,
            { metalness: 0.9, roughness: 0.1 }
        );
        hub.rotation.x = Math.PI / 2;
        wheelBone.add(hub);
    }

    // === EXHAUST PIPES (cosmetic) ===
    for (const zOff of [-0.25, 0.25]) {
        const pipe = makeMesh(
            new THREE.CylinderGeometry(0.04, 0.05, 0.2, 8),
            0x333333,
            { metalness: 0.9, roughness: 0.1 }
        );
        pipe.position.set(-0.6, 0.55, zOff);
        root.add(pipe);
    }

    // === ANTENNA ===
    const antenna = makeMesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4),
        0x888888
    );
    antenna.position.set(0.1, 0.8, 0);
    root.add(antenna);

    const antennaTip = makeMesh(
        new THREE.SphereGeometry(0.03, 8, 8),
        0xff0000,
        { emissive: 0xff0000, metalness: 0.1, roughness: 0.1 }
    );
    antennaTip.position.set(0.1, 0.93, 0);
    root.add(antennaTip);
    parts.antennaTip = antennaTip;

    return { root, bones, parts };
}

export default function RigLabPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState("Initializing...");
    const [boneCount, setBoneCount] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // ── Scene ────────────────────────────────
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#0d1117");
        scene.fog = new THREE.Fog("#0d1117", 10, 30);

        // ── Camera ───────────────────────────────
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
        camera.position.set(3, 2.5, 3);

        // ── Renderer ─────────────────────────────
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3;
        container.appendChild(renderer.domElement);

        // ── Controls ─────────────────────────────
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 0.4, 0);

        // ── Lighting ─────────────────────────────
        scene.add(new THREE.AmbientLight("#334455", 1.2));

        const keyLight = new THREE.DirectionalLight("#ffeedd", 2.5);
        keyLight.position.set(4, 6, 3);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight("#6688cc", 0.8);
        fillLight.position.set(-3, 4, -2);
        scene.add(fillLight);

        const rimLight = new THREE.PointLight("#ff4400", 0.6, 10);
        rimLight.position.set(-2, 1.5, 3);
        scene.add(rimLight);

        // ── Arena Floor ──────────────────────────
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 20),
            new THREE.MeshStandardMaterial({
                color: "#1a1a2a",
                metalness: 0.3,
                roughness: 0.7,
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const grid = new THREE.GridHelper(10, 20, "#222244", "#1a1a33");
        scene.add(grid);

        // ── Build the rigged bot ─────────────────
        const { root: bot, bones, parts } = buildRiggedBot();
        scene.add(bot);

        // Also visualize the bones with SkeletonHelper
        // Create a simple skeleton from the bones for visualization
        const allBones = Object.values(bones);
        const skeletonRoot = new THREE.Group();
        for (const bone of allBones) {
            const helper = new THREE.AxesHelper(0.15);
            bone.add(helper);
        }

        queueMicrotask(() => {
            setBoneCount(allBones.length);
            setStatus("✅ Runtime-rigged bot active!");
        });

        // ── Animation Loop ───────────────────────
        const clock = new THREE.Clock();
        let animId: number;

        function animate() {
            animId = requestAnimationFrame(animate);
            const t = clock.getElapsedTime();

            // 1. Saw blade spin (fast!)
            if (bones.saw) {
                bones.saw.rotation.x = t * 15;
            }

            // 2. Saw arm bob up/down
            if (bones.sawArm) {
                bones.sawArm.rotation.z = Math.sin(t * 2) * 0.15;
            }

            // 3. Head turret scanning
            if (bones.head) {
                bones.head.rotation.y = Math.sin(t * 1.5) * 0.8;
            }

            // 4. Hammer arm — smashing motion
            if (bones.shoulder) {
                bones.shoulder.rotation.z = Math.sin(t * 3) * 0.4 + 0.2;
            }
            if (bones.elbow) {
                // Quick snap forward on down-stroke
                const smashPhase = Math.sin(t * 3);
                bones.elbow.rotation.z = smashPhase > 0
                    ? smashPhase * 0.8
                    : smashPhase * 0.2;
            }

            // 5. Wheels spinning (forward motion)
            for (const name of ["wheelFL", "wheelFR", "wheelBL", "wheelBR"]) {
                if (bones[name]) {
                    bones[name].rotation.z = t * 5;
                }
            }

            // 6. LED eye pulsing
            if (parts.eye) {
                const eyeMat = (parts.eye as THREE.Mesh).material as THREE.MeshStandardMaterial;
                const pulse = (Math.sin(t * 8) + 1) / 2;
                eyeMat.emissiveIntensity = 0.5 + pulse * 2;
            }

            // 7. Antenna tip blinking
            if (parts.antennaTip) {
                const tipMat = (parts.antennaTip as THREE.Mesh).material as THREE.MeshStandardMaterial;
                tipMat.emissiveIntensity = Math.sin(t * 4) > 0 ? 2 : 0.1;
            }

            // 8. Whole bot gentle sway (simulating movement)
            bot.position.y = Math.sin(t * 2) * 0.02;
            bot.rotation.y = Math.sin(t * 0.5) * 0.1;

            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        // ── Resize ───────────────────────────────
        function onResize() {
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener("resize", onResize);
            cancelAnimationFrame(animId);
            controls.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#0d1117" }}>
            {/* Info Overlay */}
            <div
                style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    zIndex: 10,
                    color: "#ffffff",
                    fontFamily: "monospace",
                    fontSize: 13,
                    background: "rgba(0,0,0,0.75)",
                    padding: "14px 18px",
                    borderRadius: 10,
                    maxWidth: 450,
                    border: "1px solid #333",
                }}
            >
                <div style={{ fontWeight: "bold", color: "#ff6600", fontSize: 16, marginBottom: 8 }}>
                    🦴 Option C: Three.js Runtime Rigging
                </div>
                <div style={{ marginBottom: 10, color: "#ccc" }}>{status}</div>

                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <div>🦴 Bones: <span style={{ color: "#ffaa00" }}>{boneCount}</span> (created at runtime)</div>
                    <div style={{ marginTop: 6, color: "#888" }}>
                        <strong>Animated parts:</strong>
                    </div>
                    <div style={{ color: "#aaa", paddingLeft: 8 }}>
                        • 🔄 Spinning saw blade (bone.rotation.x)<br />
                        • 🔨 Articulated hammer arm (2-bone chain)<br />
                        • 🔍 Scanning head turret (bone.rotation.y)<br />
                        • ⚙️ 4× spinning wheels<br />
                        • 💡 Pulsing LED eye + blinking antenna
                    </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 11, color: "#555" }}>
                    No Blender needed — all rigging done in JavaScript
                </div>
            </div>

            {/* Controls hint */}
            <div
                style={{
                    position: "absolute",
                    bottom: 16,
                    left: 16,
                    zIndex: 10,
                    color: "#888",
                    fontFamily: "monospace",
                    fontSize: 12,
                    background: "rgba(0,0,0,0.5)",
                    padding: "8px 12px",
                    borderRadius: 6,
                }}
            >
                🖱️ Drag to orbit | All bones created with THREE.Bone at runtime
            </div>

            <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}
