"use client";

/**
 * Arena3D — Three.js 3D battle arena renderer.
 *
 * Renders two bots fighting in a 3D arena with Rapier3D physics.
 * Uses the part assembly system to display bots from the parts library.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GameEngine3D, ARENA_SIZE_3D, type GameState3D } from "@/lib/engine/game-engine-3d";
import type { BotDefinition, MatchStatus } from "@/lib/types/bot";

// ── Colors ──────────────────────────────────────────────

const ARENA_FLOOR_COLOR = 0x1a1a2a;
const ARENA_GRID_COLOR = 0x252540;
const ARENA_WALL_COLOR = 0x2a2a40;
const SKY_COLOR = 0x0a0a1a;

// ── Props ───────────────────────────────────────────────

interface Arena3DProps {
    bot1: BotDefinition;
    bot2: BotDefinition;
    onMatchEnd?: (winner: string | null) => void;
    autoStart?: boolean;
}

// ── Component ───────────────────────────────────────────

export default function Arena3D({ bot1, bot2, onMatchEnd, autoStart = true }: Arena3DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<GameEngine3D | null>(null);
    const sceneRef = useRef<{
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
        controls: OrbitControls;
        botMeshes: [THREE.Group, THREE.Group];
        healthBars: [THREE.Mesh, THREE.Mesh];
        clock: THREE.Clock;
        animId: number;
    } | null>(null);

    const [gameState, setGameState] = useState<GameState3D | null>(null);
    const [matchStatus, setMatchStatus] = useState<MatchStatus>("waiting");
    const [countdown, setCountdown] = useState<number | null>(null);
    const latestState = useRef<GameState3D | null>(null);

    // ── Create bot mesh from definition ────────────────

    const createBotMesh = useCallback((def: BotDefinition): THREE.Group => {
        const group = new THREE.Group();
        const color = new THREE.Color(def.color);
        const r = [0.3, 0.4, 0.5, 0.6, 0.7][Math.round(def.size) - 1] ?? 0.5;

        // Body
        const bodyGeo = (() => {
            switch (def.shape) {
                case "circle":
                    return new THREE.SphereGeometry(r, 16, 12);
                case "rectangle":
                    return new THREE.BoxGeometry(r * 2, r * 1.2, r * 1.5);
                case "triangle": {
                    const shape = new THREE.Shape();
                    shape.moveTo(0, r);
                    shape.lineTo(-r, -r * 0.7);
                    shape.lineTo(r, -r * 0.7);
                    shape.closePath();
                    const extrudeSettings = { depth: r, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05 };
                    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
                }
                case "hexagon": {
                    return new THREE.CylinderGeometry(r, r, r * 1.2, 6);
                }
                case "pentagon": {
                    return new THREE.CylinderGeometry(r, r, r * 1.2, 5);
                }
                default:
                    return new THREE.BoxGeometry(r * 2, r * 1.2, r * 1.5);
            }
        })();

        const bodyMat = new THREE.MeshStandardMaterial({
            color,
            metalness: 0.7,
            roughness: 0.3,
        });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.castShadow = true;
        bodyMesh.name = "body";
        group.add(bodyMesh);

        // Weapon indicator (colored spike/cylinder on front)
        const weaponGeo = (() => {
            switch (def.weapon.type) {
                case "spinner":
                    return new THREE.TorusGeometry(r * 0.6, 0.06, 8, 16);
                case "hammer":
                    return new THREE.BoxGeometry(0.15, r * 0.8, 0.15);
                case "saw":
                    return new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.08, 16);
                case "lance":
                    return new THREE.ConeGeometry(0.08, r * 1.2, 8);
                case "flipper":
                    return new THREE.BoxGeometry(r * 1.2, 0.08, r * 0.8);
                default:
                    return new THREE.SphereGeometry(r * 0.3, 8, 8);
            }
        })();

        const weaponMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(def.attackEffect?.color ?? "#ff4444"),
            metalness: 0.9,
            roughness: 0.1,
            emissive: new THREE.Color(def.attackEffect?.color ?? "#ff4444"),
            emissiveIntensity: 0.3,
        });
        const weaponMesh = new THREE.Mesh(weaponGeo, weaponMat);
        weaponMesh.position.set(0, r * 0.3, r * 0.8);
        weaponMesh.name = "weapon";
        weaponMesh.castShadow = true;
        group.add(weaponMesh);

        // Eyes (two small emissive spheres)
        const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x44ff44,
            emissiveIntensity: 2,
        });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-r * 0.3, r * 0.4, r * 0.7);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(r * 0.3, r * 0.4, r * 0.7);
        group.add(eyeL, eyeR);

        // Name label (via sprite)
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 64;
        const ctx2d = canvas.getContext("2d")!;
        ctx2d.fillStyle = "rgba(0,0,0,0)";
        ctx2d.fillRect(0, 0, 256, 64);
        ctx2d.font = "bold 28px 'Inter', sans-serif";
        ctx2d.textAlign = "center";
        ctx2d.fillStyle = "#ffffff";
        ctx2d.fillText(def.name, 128, 40);
        const nameTexture = new THREE.CanvasTexture(canvas);
        const nameMat = new THREE.SpriteMaterial({ map: nameTexture, transparent: true });
        const nameSprite = new THREE.Sprite(nameMat);
        nameSprite.scale.set(2, 0.5, 1);
        nameSprite.position.y = r + 0.8;
        nameSprite.name = "nameLabel";
        group.add(nameSprite);

        return group;
    }, []);

    // ── Create health bar ─────────────────────────────

    const createHealthBar = useCallback((): THREE.Mesh => {
        const geo = new THREE.PlaneGeometry(1.2, 0.15);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x44ff44,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = "healthBar";
        return mesh;
    }, []);

    // ── Init scene & engine ───────────────────────────

    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const w = container.clientWidth;
        const h = container.clientHeight;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(SKY_COLOR);
        scene.fog = new THREE.FogExp2(SKY_COLOR, 0.03);

        // Camera
        const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
        camera.position.set(0, 12, 16);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        container.appendChild(renderer.domElement);

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 0, 0);
        controls.maxPolarAngle = Math.PI / 2.2;
        controls.minDistance = 5;
        controls.maxDistance = 30;

        // ── Lighting ─────────────────────────────────

        scene.add(new THREE.AmbientLight(0x404060, 0.6));

        // Key light (sun-like)
        const keyLight = new THREE.DirectionalLight(0xffeedd, 1.8);
        keyLight.position.set(8, 15, 5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 40;
        keyLight.shadow.camera.left = -15;
        keyLight.shadow.camera.right = 15;
        keyLight.shadow.camera.top = 15;
        keyLight.shadow.camera.bottom = -15;
        scene.add(keyLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0x6688ff, 0.5);
        fillLight.position.set(-5, 8, -3);
        scene.add(fillLight);

        // Rim lights (dramatic orange)
        const rim1 = new THREE.PointLight(0xff4400, 2, 20);
        rim1.position.set(-ARENA_SIZE_3D, 3, -ARENA_SIZE_3D);
        scene.add(rim1);
        const rim2 = new THREE.PointLight(0x0044ff, 2, 20);
        rim2.position.set(ARENA_SIZE_3D, 3, ARENA_SIZE_3D);
        scene.add(rim2);

        // Spot light over center (arena spotlight)
        const spot = new THREE.SpotLight(0xffffff, 1.5, 30, Math.PI / 4, 0.5);
        spot.position.set(0, 15, 0);
        spot.target.position.set(0, 0, 0);
        spot.castShadow = true;
        scene.add(spot);
        scene.add(spot.target);

        // ── Arena floor ──────────────────────────────

        const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE_3D * 2, ARENA_SIZE_3D * 2);
        const floorMat = new THREE.MeshStandardMaterial({
            color: ARENA_FLOOR_COLOR,
            metalness: 0.4,
            roughness: 0.6,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Grid overlay
        const grid = new THREE.GridHelper(ARENA_SIZE_3D * 2, 20, ARENA_GRID_COLOR, ARENA_GRID_COLOR);
        grid.position.y = 0.01;
        scene.add(grid);

        // ── Arena walls ──────────────────────────────

        const wallMat = new THREE.MeshStandardMaterial({
            color: ARENA_WALL_COLOR,
            metalness: 0.6,
            roughness: 0.4,
            transparent: true,
            opacity: 0.6,
        });

        const wallGeo = new THREE.BoxGeometry(ARENA_SIZE_3D * 2 + 0.6, 2, 0.3);
        const wallSideGeo = new THREE.BoxGeometry(0.3, 2, ARENA_SIZE_3D * 2 + 0.6);

        const wallN = new THREE.Mesh(wallGeo, wallMat);
        wallN.position.set(0, 1, -ARENA_SIZE_3D);
        scene.add(wallN);

        const wallS = new THREE.Mesh(wallGeo, wallMat);
        wallS.position.set(0, 1, ARENA_SIZE_3D);
        scene.add(wallS);

        const wallW = new THREE.Mesh(wallSideGeo, wallMat);
        wallW.position.set(-ARENA_SIZE_3D, 1, 0);
        scene.add(wallW);

        const wallE = new THREE.Mesh(wallSideGeo, wallMat);
        wallE.position.set(ARENA_SIZE_3D, 1, 0);
        scene.add(wallE);

        // Corner posts (glowing pillars)
        const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 3, 8);
        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0xff4400,
            emissive: 0xff2200,
            emissiveIntensity: 0.8,
            metalness: 0.9,
            roughness: 0.1,
        });
        const corners = [
            [-ARENA_SIZE_3D, 1.5, -ARENA_SIZE_3D],
            [ARENA_SIZE_3D, 1.5, -ARENA_SIZE_3D],
            [-ARENA_SIZE_3D, 1.5, ARENA_SIZE_3D],
            [ARENA_SIZE_3D, 1.5, ARENA_SIZE_3D],
        ];
        for (const [cx, cy, cz] of corners) {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(cx, cy, cz);
            pillar.castShadow = true;
            scene.add(pillar);
        }

        // ── Bots ─────────────────────────────────────

        const botMesh1 = createBotMesh(bot1);
        botMesh1.position.set(-ARENA_SIZE_3D * 0.6, 0.5, 0);
        scene.add(botMesh1);

        const botMesh2 = createBotMesh(bot2);
        botMesh2.position.set(ARENA_SIZE_3D * 0.6, 0.5, 0);
        botMesh2.rotation.y = Math.PI;
        scene.add(botMesh2);

        // Health bars
        const hpBar1 = createHealthBar();
        hpBar1.position.set(-ARENA_SIZE_3D * 0.6, 2, 0);
        scene.add(hpBar1);

        const hpBar2 = createHealthBar();
        hpBar2.position.set(ARENA_SIZE_3D * 0.6, 2, 0);
        scene.add(hpBar2);

        // ── Game Engine ──────────────────────────────

        const engine = new GameEngine3D(bot1, bot2);
        engineRef.current = engine;

        engine.onUpdate((state) => {
            latestState.current = state;
            setGameState(state);
            setMatchStatus(state.status);

            if (state.status === "finished" && onMatchEnd) {
                onMatchEnd(state.winner);
            }
        });

        if (autoStart) {
            engine.start().then(() => {
                setMatchStatus("countdown");
                setCountdown(3);
                let c = 3;
                const cdInterval = setInterval(() => {
                    c--;
                    setCountdown(c);
                    if (c <= 0) {
                        clearInterval(cdInterval);
                        setCountdown(null);
                    }
                }, 1000);
            });
        }

        // ── Animation loop ───────────────────────────

        const clock = new THREE.Clock();
        let animId = 0;

        const state = {
            scene,
            camera,
            renderer,
            controls,
            botMeshes: [botMesh1, botMesh2] as [THREE.Group, THREE.Group],
            healthBars: [hpBar1, hpBar2] as [THREE.Mesh, THREE.Mesh],
            clock,
            animId,
        };

        function animate() {
            state.animId = requestAnimationFrame(animate);
            const t = clock.getElapsedTime();
            controls.update();

            const gs = latestState.current;
            if (gs) {
                const scale = (ARENA_SIZE_3D * 2) / 800;

                for (let i = 0; i < 2; i++) {
                    const bot = gs.bots[i];
                    const mesh = state.botMeshes[i];

                    // Position: map from pixel-space back to 3D
                    const wx = bot.position.x * scale - ARENA_SIZE_3D;
                    const wz = bot.position.y * scale - ARENA_SIZE_3D;
                    mesh.position.x = wx;
                    mesh.position.z = wz;
                    mesh.position.y = gs.botY[i as 0 | 1];

                    // Rotation
                    mesh.rotation.y = bot.angle;

                    // Health bar
                    const hpBar = state.healthBars[i];
                    const hpFrac = Math.max(0, bot.health / bot.maxHealth);
                    hpBar.position.set(wx, mesh.position.y + 1.5, wz);
                    hpBar.lookAt(camera.position);
                    hpBar.scale.x = hpFrac;
                    (hpBar.material as THREE.MeshBasicMaterial).color.setHex(
                        hpFrac > 0.5 ? 0x44ff44 : hpFrac > 0.25 ? 0xffaa00 : 0xff2222
                    );

                    // Attack pulse animation
                    const weapon = mesh.getObjectByName("weapon");
                    if (weapon) {
                        if (bot.isAttacking) {
                            const pulse = Math.sin(bot.attackAnimationFrame * 0.8) * 0.3;
                            weapon.scale.setScalar(1.3 + pulse);
                            (weapon as THREE.Mesh).material = (weapon as THREE.Mesh).material;
                            const wMat = (weapon as THREE.Mesh).material as THREE.MeshStandardMaterial;
                            wMat.emissiveIntensity = 1.5 + pulse;
                        } else {
                            weapon.scale.setScalar(1);
                            // Idle spin for spinners
                            if (bot.definition.weapon.type === "spinner") {
                                weapon.rotation.y = t * 8;
                            }
                        }
                    }
                }
            }

            // Animate corner pillars glow
            for (const child of scene.children) {
                if (child instanceof THREE.Mesh && child.geometry instanceof THREE.CylinderGeometry) {
                    const mat = child.material as THREE.MeshStandardMaterial;
                    if (mat.emissive && mat.emissiveIntensity !== undefined) {
                        mat.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.3;
                    }
                }
            }

            renderer.render(scene, camera);
        }

        animate();
        sceneRef.current = state;

        // Resize handler
        const onResize = () => {
            const w2 = container.clientWidth;
            const h2 = container.clientHeight;
            camera.aspect = w2 / h2;
            camera.updateProjectionMatrix();
            renderer.setSize(w2, h2);
        };
        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener("resize", onResize);
            cancelAnimationFrame(state.animId);
            engine.destroy();
            renderer.dispose();
            container.removeChild(renderer.domElement);
        };
    }, [bot1, bot2, autoStart, onMatchEnd, createBotMesh, createHealthBar]);

    // ── Render ────────────────────────────────────────

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

            {/* HUD overlay */}
            <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                padding: "12px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                pointerEvents: "none",
                fontFamily: "'Inter', sans-serif",
            }}>
                {/* Bot 1 info */}
                <div style={{
                    background: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(8px)",
                    padding: "8px 14px",
                    borderRadius: 8,
                    borderLeft: `3px solid ${bot1.color}`,
                }}>
                    <div style={{ fontWeight: 700, color: bot1.color, fontSize: 14 }}>{bot1.name}</div>
                    <div style={{ color: "#aaa", fontSize: 11 }}>
                        HP: {gameState ? Math.round(gameState.bots[0].health) : 100}
                    </div>
                </div>

                {/* Center: timer/countdown */}
                <div style={{
                    background: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(8px)",
                    padding: "8px 20px",
                    borderRadius: 8,
                    textAlign: "center",
                }}>
                    {countdown !== null && (
                        <div style={{
                            fontSize: 32,
                            fontWeight: 900,
                            color: "#ff4444",
                            textShadow: "0 0 20px #ff4444",
                        }}>
                            {countdown > 0 ? countdown : "FIGHT!"}
                        </div>
                    )}
                    {matchStatus === "fighting" && (
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                            {Math.ceil(gameState?.timeRemaining ?? 90)}s
                        </div>
                    )}
                    {matchStatus === "finished" && (
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#44ff44" }}>
                            {gameState?.winner
                                ? `${gameState.bots.find(b => b.id === gameState.winner)?.definition.name ?? "?"} WINS!`
                                : "DRAW!"}
                        </div>
                    )}
                </div>

                {/* Bot 2 info */}
                <div style={{
                    background: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(8px)",
                    padding: "8px 14px",
                    borderRadius: 8,
                    borderRight: `3px solid ${bot2.color}`,
                    textAlign: "right",
                }}>
                    <div style={{ fontWeight: 700, color: bot2.color, fontSize: 14 }}>{bot2.name}</div>
                    <div style={{ color: "#aaa", fontSize: 11 }}>
                        HP: {gameState ? Math.round(gameState.bots[1].health) : 100}
                    </div>
                </div>
            </div>
        </div>
    );
}
