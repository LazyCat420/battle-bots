"use client";

/**
 * 3D Lab — Experiment 1: Three.js rendering test page.
 *
 * Renders a procedural 3D robot (made from primitives) in a Three.js scene
 * with orbit controls, lighting, and a reflective arena floor.
 * This proves Three.js works in our Next.js app before we attempt .glb loading.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ── Procedural Bot Builder ─────────────────────────────────
// Builds a simple robot from Three.js primitives to test the rendering pipeline.
// This is the "Phase 0" equivalent of what SAM3D/TripoSR will generate later.

function createProceduralBot(color: string = "#DD3300"): THREE.Group {
    const bot = new THREE.Group();
    const mainColor = new THREE.Color(color);
    const darkColor = mainColor.clone().multiplyScalar(0.4);
    const lightColor = mainColor.clone().lerp(new THREE.Color("#ffffff"), 0.3);

    // ── Chassis (main body) ──────────────────────
    const chassisGeo = new THREE.BoxGeometry(1.6, 0.5, 1.2);
    const chassisMat = new THREE.MeshStandardMaterial({
        color: mainColor,
        metalness: 0.7,
        roughness: 0.3,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.35;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    bot.add(chassis);

    // ── Armor plate (top) ────────────────────────
    const armorGeo = new THREE.BoxGeometry(1.4, 0.15, 1.0);
    const armorMat = new THREE.MeshStandardMaterial({
        color: darkColor,
        metalness: 0.8,
        roughness: 0.2,
    });
    const armor = new THREE.Mesh(armorGeo, armorMat);
    armor.position.y = 0.65;
    armor.castShadow = true;
    bot.add(armor);

    // ── Wheels (4 cylinders) ─────────────────────
    const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16);
    const wheelMat = new THREE.MeshStandardMaterial({
        color: "#1a1a1a",
        metalness: 0.3,
        roughness: 0.8,
    });

    const wheelPositions = [
        [-0.6, 0.2, 0.65],
        [0.6, 0.2, 0.65],
        [-0.6, 0.2, -0.65],
        [0.6, 0.2, -0.65],
    ];

    wheelPositions.forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(x, y, z);
        wheel.rotation.x = Math.PI / 2;
        wheel.castShadow = true;
        bot.add(wheel);
    });

    // ── Spinning blade bar (weapon) ──────────────
    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(0, 0.75, 0);

    const bladeGeo = new THREE.BoxGeometry(2.0, 0.08, 0.2);
    const bladeMat = new THREE.MeshStandardMaterial({
        color: "#cccccc",
        metalness: 0.9,
        roughness: 0.1,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.castShadow = true;
    bladeGroup.add(blade);

    // Motor hub
    const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 16);
    const hubMat = new THREE.MeshStandardMaterial({
        color: "#555555",
        metalness: 0.9,
        roughness: 0.2,
    });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.castShadow = true;
    bladeGroup.add(hub);

    // Store ref for animation
    bladeGroup.userData.isWeapon = true;
    bot.add(bladeGroup);

    // ── LED eyes ─────────────────────────────────
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({
        color: "#00ff44",
        emissive: "#00ff44",
        emissiveIntensity: 2,
    });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.8, 0.45, 0.2);
    bot.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.8, 0.45, -0.2);
    bot.add(rightEye);

    // ── Vent grills (side detail) ────────────────
    for (let i = -1; i <= 1; i += 2) {
        for (let j = 0; j < 3; j++) {
            const ventGeo = new THREE.BoxGeometry(0.02, 0.06, 0.15);
            const ventMat = new THREE.MeshStandardMaterial({
                color: "#111111",
                metalness: 0.5,
                roughness: 0.5,
            });
            const vent = new THREE.Mesh(ventGeo, ventMat);
            vent.position.set(-0.3 + j * 0.15, 0.5, i * 0.61);
            bot.add(vent);
        }
    }

    // ── Bolts/rivets ─────────────────────────────
    const boltGeo = new THREE.SphereGeometry(0.03, 6, 6);
    const boltMat = new THREE.MeshStandardMaterial({
        color: "#888888",
        metalness: 0.8,
        roughness: 0.3,
    });

    const boltPositions = [
        [0.7, 0.62, 0.45],
        [0.7, 0.62, -0.45],
        [-0.7, 0.62, 0.45],
        [-0.7, 0.62, -0.45],
        [0.55, 0.62, 0],
        [-0.55, 0.62, 0],
    ];

    boltPositions.forEach(([x, y, z]) => {
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        bolt.position.set(x, y, z);
        bot.add(bolt);
    });

    return bot;
}

// ── Lab Page Component ─────────────────────────────────────

export default function LabPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState("Initializing Three.js...");

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // ── Scene ────────────────────────────────
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#1a1a2e");
        scene.fog = new THREE.Fog("#1a1a2e", 10, 30);

        // ── Camera ───────────────────────────────
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
        camera.position.set(3, 3, 3);

        // ── Renderer ─────────────────────────────
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);

        // ── Controls ─────────────────────────────
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 0.4, 0);
        controls.minDistance = 2;
        controls.maxDistance = 15;

        // ── Lighting ─────────────────────────────
        // Ambient
        const ambient = new THREE.AmbientLight("#404060", 0.8);
        scene.add(ambient);

        // Key light (warm)
        const keyLight = new THREE.DirectionalLight("#ffeedd", 1.5);
        keyLight.position.set(5, 8, 3);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 20;
        keyLight.shadow.camera.left = -5;
        keyLight.shadow.camera.right = 5;
        keyLight.shadow.camera.top = 5;
        keyLight.shadow.camera.bottom = -5;
        scene.add(keyLight);

        // Fill light (cool blue)
        const fillLight = new THREE.DirectionalLight("#8888ff", 0.6);
        fillLight.position.set(-3, 4, -2);
        scene.add(fillLight);

        // Rim light (accent)
        const rimLight = new THREE.PointLight("#ff4400", 0.8, 10);
        rimLight.position.set(-2, 2, 3);
        scene.add(rimLight);

        // ── Arena Floor ──────────────────────────
        const floorGeo = new THREE.PlaneGeometry(20, 20);
        const floorMat = new THREE.MeshStandardMaterial({
            color: "#2a2a3a",
            metalness: 0.2,
            roughness: 0.8,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Grid overlay
        const grid = new THREE.GridHelper(10, 20, "#333355", "#222244");
        grid.position.y = 0.01;
        scene.add(grid);

        // ── Build Procedural Bot ─────────────────
        const bot1 = createProceduralBot("#DD3300"); // Red bot
        bot1.position.set(-1.2, 0, 0);
        scene.add(bot1);

        const bot2 = createProceduralBot("#2244AA"); // Blue bot
        bot2.position.set(1.2, 0, 0);
        bot2.rotation.y = Math.PI; // face the other bot
        scene.add(bot2);

        queueMicrotask(() => setStatus("✅ Scene ready — 2 procedural bots loaded. Drag to orbit!"));

        // ── Animation Loop ───────────────────────
        const clock = new THREE.Clock();
        let animId: number;

        function animate() {
            animId = requestAnimationFrame(animate);
            const elapsed = clock.getElapsedTime();

            // Spin weapon blades
            [bot1, bot2].forEach((bot) => {
                bot.traverse((child) => {
                    if (child.userData.isWeapon) {
                        child.rotation.y = elapsed * 8;
                    }
                });
            });

            // Gentle bot bob
            bot1.position.y = Math.sin(elapsed * 2) * 0.02;
            bot2.position.y = Math.sin(elapsed * 2 + 1) * 0.02;

            controls.update();
            renderer.render(scene, camera);
        }

        animate();

        // ── Resize handler ───────────────────────
        function onResize() {
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
        window.addEventListener("resize", onResize);

        // ── Cleanup ──────────────────────────────
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
        <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#1a1a2e" }}>
            {/* Status overlay */}
            <div
                style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    zIndex: 10,
                    color: "#ffffff",
                    fontFamily: "monospace",
                    fontSize: 14,
                    background: "rgba(0,0,0,0.6)",
                    padding: "8px 12px",
                    borderRadius: 6,
                    maxWidth: 400,
                }}
            >
                <div style={{ fontWeight: "bold", color: "#00ff88", marginBottom: 4 }}>
                    🔬 3D Lab — Experiment 1
                </div>
                <div>{status}</div>
            </div>

            {/* Info panel */}
            <div
                style={{
                    position: "absolute",
                    bottom: 16,
                    left: 16,
                    zIndex: 10,
                    color: "#aaa",
                    fontFamily: "monospace",
                    fontSize: 12,
                    background: "rgba(0,0,0,0.5)",
                    padding: "8px 12px",
                    borderRadius: 6,
                }}
            >
                <div>🖱️ Drag to orbit | Scroll to zoom | Right-drag to pan</div>
                <div style={{ marginTop: 4 }}>
                    Components: chassis plate, armor panel, 4 wheels, spinning blade, LED eyes, vents, rivets
                </div>
            </div>

            {/* Three.js canvas container */}
            <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}
