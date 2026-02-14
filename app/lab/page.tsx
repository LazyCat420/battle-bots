"use client";

/**
 * 3D Bot Builder Lab — Interactive part selector + 3D assembly preview.
 *
 * Select body, weapon, locomotion, and armor from the parts library.
 * See your assembled bot rendered in real-time with Three.js.
 * Includes pipeline controls to generate, merge, and rig 3D models.
 * Generates a BotAssembly JSON that can feed the fight system.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
    checkHealth,
    getStatus,
    searchImage,
    type PipelineStatus,
    type SearchImageResult,
} from "@/lib/3d/pipeline-client";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
    PARTS_MANIFEST,
    assembleBot,
    animateBotWeapons,
    type BotAssembly,
    type PartDefinition,
} from "@/lib/3d/parts-library";

// ── Style constants ───────────────────────────────────────

const COLORS = {
    bg: "#0d1117",
    panel: "#161b22",
    border: "#30363d",
    accent: "#58a6ff",
    accentDim: "#1f6feb",
    text: "#c9d1d9",
    textDim: "#8b949e",
    success: "#3fb950",
    warning: "#d29922",
    danger: "#f85149",
};

const BOT_COLORS = [
    "#DD3300", "#2244AA", "#44AA22", "#FF8800",
    "#AA22AA", "#00AAAA", "#FF4488", "#88AA00",
    "#6633CC", "#CC6600",
];

// ── Helper: group parts by category ───────────────────────

function partsByCategory(category: string): PartDefinition[] {
    return PARTS_MANIFEST.parts.filter(p => p.category === category);
}

// ── Weapon slot options per body ───────────────────────────

function weaponSlotsForBody(bodyId: string): string[] {
    const body = PARTS_MANIFEST.parts.find(p => p.id === bodyId);
    if (!body) return [];
    return body.attachments
        .filter(a => a.name.startsWith("weapon_"))
        .map(a => a.name);
}

function armorSlotsForBody(bodyId: string): string[] {
    const body = PARTS_MANIFEST.parts.find(p => p.id === bodyId);
    if (!body) return [];
    return body.attachments
        .filter(a => a.name.startsWith("armor_"))
        .map(a => a.name);
}

// ── Main Component ────────────────────────────────────────

export default function LabPage() {
    const canvasRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
        controls: OrbitControls;
        botGroup: THREE.Group | null;
        clock: THREE.Clock;
        animId: number;
    } | null>(null);

    // Part selections
    const [bodyId, setBodyId] = useState("body_tank");
    const [weaponId, setWeaponId] = useState("weapon_spinner");
    const [weaponSlot, setWeaponSlot] = useState("weapon_top");
    const [locoId, setLocoId] = useState("locomotion_wheels");
    const [armorId, setArmorId] = useState<string>("");
    const [armorSlot, setArmorSlot] = useState<string>("");
    const [botColor, setBotColor] = useState("#DD3300");
    const [botName, setBotName] = useState("My Bot");
    const [showJSON, setShowJSON] = useState(false);

    // ── Pipeline state ────────────────────────────────────
    const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
    const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResult, setSearchResult] = useState<SearchImageResult | null>(null);
    const [pipelineLoading, setPipelineLoading] = useState("");
    const [pipelineLog, setPipelineLog] = useState<string[]>([]);

    // ── Build assembly from current selections ────────────
    const getAssembly = useCallback((): BotAssembly => ({
        name: botName,
        color: botColor,
        body: bodyId,
        weapon: weaponId,
        weaponSlot,
        locomotion: locoId,
        armor: armorId || undefined,
        armorSlot: armorSlot || undefined,
    }), [botName, botColor, bodyId, weaponId, weaponSlot, locoId, armorId, armorSlot]);

    // ── Check backend on mount ────────────────────────────
    useEffect(() => {
        checkHealth().then(ok => {
            setBackendOnline(ok);
            if (ok) {
                getStatus().then(s => setPipelineStatus(s)).catch(() => { });
            }
        });
    }, []);

    const addLog = useCallback((msg: string) => {
        setPipelineLog(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
    }, []);

    // ── Pipeline Actions ──────────────────────────────────
    const handleSearchImage = useCallback(async () => {
        if (!searchQuery.trim()) return;
        setPipelineLoading("search");
        addLog(`Searching: "${searchQuery}"...`);
        try {
            const result = await searchImage(searchQuery);
            setSearchResult(result);
            addLog(`Found image: ${result.size[0]}×${result.size[1]}px`);
        } catch (e) {
            addLog(`Search error: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setPipelineLoading("");
        }
    }, [searchQuery, addLog]);

    const handleRefreshStatus = useCallback(async () => {
        setPipelineLoading("status");
        try {
            const ok = await checkHealth();
            setBackendOnline(ok);
            if (ok) {
                const s = await getStatus();
                setPipelineStatus(s);
                addLog(`GPU: ${s.gpu.name || "N/A"} | VRAM: ${s.gpu.free_gb?.toFixed(1) || "?"} GB free`);
            } else {
                addLog("Backend offline");
            }
        } catch (e) {
            addLog(`Status error: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setPipelineLoading("");
        }
    }, [addLog]);

    // ── Init Three.js scene (once) ────────────────────────
    useEffect(() => {
        if (!canvasRef.current) return;
        const container = canvasRef.current;
        const w = container.clientWidth;
        const h = container.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(COLORS.bg);
        scene.fog = new THREE.Fog(COLORS.bg, 10, 30);

        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
        camera.position.set(3, 2.5, 3);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 0.4, 0);
        controls.minDistance = 1.5;
        controls.maxDistance = 12;

        // Lighting
        scene.add(new THREE.AmbientLight("#404060", 0.8));
        const key = new THREE.DirectionalLight("#ffeedd", 1.5);
        key.position.set(5, 8, 3);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 20;
        key.shadow.camera.left = -5;
        key.shadow.camera.right = 5;
        key.shadow.camera.top = 5;
        key.shadow.camera.bottom = -5;
        scene.add(key);
        scene.add(new THREE.DirectionalLight("#8888ff", 0.6).translateX(-3).translateY(4).translateZ(-2));
        const rim = new THREE.PointLight("#ff4400", 0.8, 10);
        rim.position.set(-2, 2, 3);
        scene.add(rim);

        // Floor
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 20),
            new THREE.MeshStandardMaterial({ color: "#1a1a2a", metalness: 0.2, roughness: 0.8 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        const grid = new THREE.GridHelper(10, 20, "#252540", "#1a1a30");
        grid.position.y = 0.01;
        scene.add(grid);

        const clock = new THREE.Clock();
        const animId = 0;
        const state = { scene, camera, renderer, controls, botGroup: null as THREE.Group | null, clock, animId };

        function animate() {
            state.animId = requestAnimationFrame(animate);
            const elapsed = clock.getElapsedTime();

            if (state.botGroup) {
                animateBotWeapons(state.botGroup, elapsed);
                // Gentle bob
                state.botGroup.position.y = Math.sin(elapsed * 2) * 0.015;
                // Slow turntable
                state.botGroup.rotation.y = elapsed * 0.3;
            }

            controls.update();
            renderer.render(scene, camera);
        }
        animate();
        sceneRef.current = state;

        function onResize() {
            const rw = container.clientWidth;
            const rh = container.clientHeight;
            camera.aspect = rw / rh;
            camera.updateProjectionMatrix();
            renderer.setSize(rw, rh);
        }
        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener("resize", onResize);
            cancelAnimationFrame(state.animId);
            controls.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    // ── Rebuild bot whenever parts change ─────────────────
    useEffect(() => {
        if (!sceneRef.current) return;

        const { scene } = sceneRef.current;

        // Remove old bot
        if (sceneRef.current.botGroup) {
            scene.remove(sceneRef.current.botGroup);
            sceneRef.current.botGroup.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material?.dispose();
                    }
                }
            });
        }

        // Build new bot
        const assembly = getAssembly();
        const botGroup = assembleBot(assembly);
        scene.add(botGroup);
        sceneRef.current.botGroup = botGroup;
    }, [bodyId, weaponId, weaponSlot, locoId, armorId, armorSlot, botColor, getAssembly]);

    // ── Auto-fix invalid slots when body changes ──────────
    useEffect(() => {
        const wSlots = weaponSlotsForBody(bodyId);
        if (wSlots.length > 0 && !wSlots.includes(weaponSlot)) {
            setWeaponSlot(wSlots[0]);
        }
        const aSlots = armorSlotsForBody(bodyId);
        if (armorSlot && aSlots.length > 0 && !aSlots.includes(armorSlot)) {
            setArmorSlot(aSlots[0]);
        }
    }, [bodyId, weaponSlot, armorSlot]);

    // ── Randomize ─────────────────────────────────────────
    const randomize = useCallback(() => {
        const bodies = partsByCategory("body");
        const weapons = partsByCategory("weapon");
        const locos = partsByCategory("locomotion");
        const armors = partsByCategory("armor");

        const body = bodies[Math.floor(Math.random() * bodies.length)];
        const weapon = weapons[Math.floor(Math.random() * weapons.length)];
        const loco = locos[Math.floor(Math.random() * locos.length)];

        setBodyId(body.id);
        setWeaponId(weapon.id);
        setLocoId(loco.id);
        setBotColor(BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)]);

        const wSlots = weaponSlotsForBody(body.id);
        if (wSlots.length > 0) {
            setWeaponSlot(wSlots[Math.floor(Math.random() * wSlots.length)]);
        }

        // 50% chance of armor
        if (Math.random() > 0.5 && armors.length > 0) {
            const arm = armors[Math.floor(Math.random() * armors.length)];
            setArmorId(arm.id);
            const aSlots = armorSlotsForBody(body.id);
            if (aSlots.length > 0) {
                setArmorSlot(aSlots[Math.floor(Math.random() * aSlots.length)]);
            }
        } else {
            setArmorId("");
            setArmorSlot("");
        }

        const names = [
            "DeathWheel", "IronClaw", "BuzzkillBot", "RampageRex",
            "ThunderDome", "SkullCrusher", "NightmareBot", "VoltStrike",
            "SteelFang", "HammerHead", "BladeRunner", "TornadoBot",
        ];
        setBotName(names[Math.floor(Math.random() * names.length)]);
    }, []);

    // ── UI ────────────────────────────────────────────────

    const wSlots = weaponSlotsForBody(bodyId);
    const aSlots = armorSlotsForBody(bodyId);

    return (
        <div style={{ display: "flex", width: "100vw", height: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
            {/* Left Panel — Part Selector */}
            <div style={{
                width: 340,
                minWidth: 340,
                borderRight: `1px solid ${COLORS.border}`,
                background: COLORS.panel,
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 16,
            }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24 }}>🔧</span>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>3D Bot Builder</h1>
                        <span style={{ fontSize: 12, color: COLORS.textDim }}>Select parts to assemble your bot</span>
                    </div>
                </div>

                {/* Bot Name */}
                <div>
                    <label style={labelStyle}>Bot Name</label>
                    <input
                        value={botName}
                        onChange={e => setBotName(e.target.value)}
                        style={inputStyle}
                        placeholder="Enter bot name..."
                    />
                </div>

                {/* Color Picker */}
                <div>
                    <label style={labelStyle}>Color</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {BOT_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => setBotColor(c)}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 6,
                                    border: botColor === c ? "2px solid white" : "2px solid transparent",
                                    background: c,
                                    cursor: "pointer",
                                    boxShadow: botColor === c ? "0 0 8px rgba(255,255,255,0.4)" : "none",
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Body */}
                <PartSelector
                    label="🏗️ Body"
                    parts={partsByCategory("body")}
                    selected={bodyId}
                    onSelect={setBodyId}
                />

                {/* Weapon */}
                <PartSelector
                    label="⚔️ Weapon"
                    parts={partsByCategory("weapon")}
                    selected={weaponId}
                    onSelect={setWeaponId}
                />

                {/* Weapon Slot */}
                {wSlots.length > 1 && (
                    <div>
                        <label style={labelStyle}>Weapon Position</label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {wSlots.map(s => (
                                <button
                                    key={s}
                                    onClick={() => setWeaponSlot(s)}
                                    style={chipStyle(weaponSlot === s)}
                                >
                                    {s.replace("weapon_", "")}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Locomotion */}
                <PartSelector
                    label="🛞 Locomotion"
                    parts={partsByCategory("locomotion")}
                    selected={locoId}
                    onSelect={setLocoId}
                />

                {/* Armor (optional) */}
                <div>
                    <label style={labelStyle}>🛡️ Armor (optional)</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                            onClick={() => { setArmorId(""); setArmorSlot(""); }}
                            style={chipStyle(armorId === "")}
                        >
                            None
                        </button>
                        {partsByCategory("armor").map(p => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    setArmorId(p.id);
                                    if (!armorSlot || !aSlots.includes(armorSlot)) {
                                        setArmorSlot(aSlots[0] || "");
                                    }
                                }}
                                style={chipStyle(armorId === p.id)}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                    {armorId && aSlots.length > 1 && (
                        <div style={{ marginTop: 8 }}>
                            <span style={{ fontSize: 11, color: COLORS.textDim }}>Position:</span>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                                {aSlots.map(s => (
                                    <button key={s} onClick={() => setArmorSlot(s)} style={chipStyle(armorSlot === s)}>
                                        {s.replace("armor_", "")}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={randomize} style={btnStyle(COLORS.accent)}>
                        🎲 Randomize
                    </button>
                    <button onClick={() => setShowJSON(!showJSON)} style={btnStyle(COLORS.textDim)}>
                        {showJSON ? "Hide" : "📋"} JSON
                    </button>
                </div>

                {/* Navigation to Tools */}
                <div style={{ marginTop: 8 }}>
                    <a href="/lab/image-to-3d" style={{
                        ...btnStyle(COLORS.accentDim),
                        width: "100%",
                        display: "block",
                        textAlign: "center",
                        textDecoration: "none",
                        boxSizing: "border-box"
                    }}>
                        🖼️ Image → 3D Tool
                    </a>
                </div>

                {/* JSON Output */}
                {showJSON && (
                    <pre style={{
                        background: "#0d1117",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        color: COLORS.success,
                        overflowX: "auto",
                        whiteSpace: "pre-wrap",
                    }}>
                        {JSON.stringify(getAssembly(), null, 2)}
                    </pre>
                )}

                {/* ── Pipeline Controls ─────────────────── */}
                <div style={{
                    borderTop: `1px solid ${COLORS.border}`,
                    paddingTop: 12,
                    marginTop: 4,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 16 }}>🔌</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Pipeline Backend</span>
                        <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: backendOnline === null ? COLORS.textDim
                                : backendOnline ? COLORS.success : "#ff4444",
                            boxShadow: backendOnline ? `0 0 6px ${COLORS.success}` : "none",
                        }} />
                        <span style={{ fontSize: 11, color: COLORS.textDim }}>
                            {backendOnline === null ? "checking..."
                                : backendOnline ? "online" : "offline"}
                        </span>
                    </div>

                    {/* GPU Status */}
                    {pipelineStatus && (
                        <div style={{
                            background: "#0d1117",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 11,
                            fontFamily: "monospace",
                            color: COLORS.textDim,
                            marginBottom: 10,
                        }}>
                            <div>GPU: {pipelineStatus.gpu.name || "N/A"}</div>
                            <div>
                                VRAM: {pipelineStatus.gpu.allocated_gb?.toFixed(1) || "0"}GB used
                                / {pipelineStatus.gpu.total_vram_gb?.toFixed(0) || "?"}GB total
                            </div>
                            <div>TripoSR: {pipelineStatus.triposr_loaded ? "✅ loaded" : "⏸️ unloaded"}</div>
                            <div>Generated parts: {pipelineStatus.generated_parts}</div>
                        </div>
                    )}

                    {/* Refresh Status */}
                    <button
                        onClick={handleRefreshStatus}
                        disabled={pipelineLoading === "status"}
                        style={btnStyle(COLORS.textDim)}
                    >
                        {pipelineLoading === "status" ? "⏳ Checking..." : "🔄 Refresh Status"}
                    </button>

                    {/* Image Search */}
                    <div style={{ marginTop: 10 }}>
                        <label style={labelStyle}>🔍 Search Reference Image</label>
                        <div style={{ display: "flex", gap: 6 }}>
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleSearchImage()}
                                style={{ ...inputStyle, flex: 1 }}
                                placeholder="robot saw blade 3D..."
                                disabled={!!pipelineLoading}
                            />
                            <button
                                onClick={handleSearchImage}
                                disabled={!!pipelineLoading || !searchQuery.trim()}
                                style={{
                                    ...btnStyle(COLORS.accent),
                                    minWidth: 50,
                                    padding: "6px 10px",
                                }}
                            >
                                {pipelineLoading === "search" ? "⏳" : "🔍"}
                            </button>
                        </div>
                    </div>

                    {/* Search Result Preview */}
                    {searchResult && (
                        <div style={{
                            marginTop: 8,
                            background: "#0d1117",
                            borderRadius: 6,
                            padding: 8,
                            textAlign: "center",
                        }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={`http://localhost:8100${searchResult.image_path}`}
                                alt="Search result"
                                style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 4 }}
                            />
                            <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 4 }}>
                                {searchResult.size[0]}×{searchResult.size[1]}px
                            </div>
                        </div>
                    )}

                    {/* Pipeline Log */}
                    {pipelineLog.length > 0 && (
                        <div style={{
                            marginTop: 10,
                            background: "#0d1117",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 10,
                            fontFamily: "monospace",
                            color: COLORS.textDim,
                            maxHeight: 120,
                            overflowY: "auto",
                        }}>
                            {pipelineLog.map((line, i) => (
                                <div key={i}>{line}</div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Part count footer */}
                <div style={{ fontSize: 11, color: COLORS.textDim, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
                    {PARTS_MANIFEST.parts.length} parts available • v{PARTS_MANIFEST.version}
                </div>
            </div>

            {/* Right — 3D Viewport */}
            <div style={{ flex: 1, position: "relative" }}>
                <div ref={canvasRef} style={{ width: "100%", height: "100%" }} />

                {/* Viewport overlay */}
                <div style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    background: "rgba(0,0,0,0.6)",
                    backdropFilter: "blur(8px)",
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "monospace",
                }}>
                    <div style={{ fontWeight: 700, color: COLORS.success, marginBottom: 4 }}>
                        🤖 {botName}
                    </div>
                    <div style={{ color: COLORS.textDim, fontSize: 11 }}>
                        Drag to orbit • Scroll to zoom
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Reusable Part Selector ────────────────────────────────

function PartSelector({
    label,
    parts,
    selected,
    onSelect,
}: {
    label: string;
    parts: PartDefinition[];
    selected: string;
    onSelect: (id: string) => void;
}) {
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {parts.map(p => (
                    <button
                        key={p.id}
                        onClick={() => onSelect(p.id)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: selected === p.id ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                            background: selected === p.id ? COLORS.accentDim + "33" : "transparent",
                            cursor: "pointer",
                            textAlign: "left",
                            color: COLORS.text,
                            fontSize: 13,
                            transition: "all 0.15s ease",
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                                {p.description}
                            </div>
                        </div>
                        {selected === p.id && <span style={{ color: COLORS.success }}>✓</span>}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Style helpers ─────────────────────────────────────────

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bg,
    color: COLORS.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
};

function chipStyle(active: boolean): React.CSSProperties {
    return {
        padding: "5px 12px",
        borderRadius: 6,
        border: active ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
        background: active ? COLORS.accentDim + "44" : "transparent",
        color: active ? COLORS.accent : COLORS.textDim,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
    };
}

function btnStyle(color: string): React.CSSProperties {
    return {
        flex: 1,
        padding: "10px 16px",
        borderRadius: 8,
        border: "none",
        background: color + "22",
        color,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        transition: "all 0.15s ease",
    };
}
