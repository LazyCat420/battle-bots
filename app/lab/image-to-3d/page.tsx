"use client";

/**
 * Image to 3D Lab — Verify the local TripoSR pipeline.
 *
 * 1. Upload an image.
 * 2. Send to Python backend (POST /generate).
 * 3. Receive GLB URL.
 * 4. Render in Three.js.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { checkHealth, generateMesh, type GenerateResult } from "@/lib/3d/pipeline-client";

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

export default function ImageTo3DPage() {
    // ── State ─────────────────────────────────────────────
    const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [result, setResult] = useState<GenerateResult | null>(null);

    // ── Three.js Refs ─────────────────────────────────────
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
        model: THREE.Group | null;
    } | null>(null);

    // ── Init Check ────────────────────────────────────────
    useEffect(() => {
        checkHealth().then(setBackendOnline);
    }, []);

    // ── Init Three.js ─────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const w = container.clientWidth;
        const h = container.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(COLORS.bg);
        scene.fog = new THREE.Fog(COLORS.bg, 10, 30);

        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
        camera.position.set(2, 2, 2);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 0.5, 0);

        // Lighting
        scene.add(new THREE.AmbientLight("#404060", 1.0));
        const key = new THREE.DirectionalLight("#ffeedd", 1.5);
        key.position.set(3, 5, 3);
        key.castShadow = true;
        scene.add(key);
        scene.add(new THREE.DirectionalLight("#8888ff", 0.5).translateX(-3).translateY(4).translateZ(-2));

        // Floor
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 20),
            new THREE.MeshStandardMaterial({ color: "#1a1a2a", metalness: 0.2, roughness: 0.8 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        scene.add(new THREE.GridHelper(10, 20, "#252540", "#1a1a30"));

        let animId = 0;

        function animate() {
            animId = requestAnimationFrame(animate);
            controls.update();

            // Rotate model if present
            if (sceneRef.current?.model) {
                sceneRef.current.model.rotation.y += 0.005;
            }

            renderer.render(scene, camera);
        }
        animate();

        sceneRef.current = { scene, camera, renderer, model: null };

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
            cancelAnimationFrame(animId);
            controls.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    // ── Handlers ──────────────────────────────────────────

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResult(null);
            setError(null);
        }
    };

    const handleGenerate = async () => {
        if (!selectedFile) return;
        setLoading(true);
        setError(null);

        try {
            const res = await generateMesh(selectedFile);
            setResult(res);
            loadModel(res.glb_path);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    const loadModel = (urlPath: string) => {
        if (!sceneRef.current) return;
        const { scene } = sceneRef.current;

        // Cleanup old
        if (sceneRef.current.model) {
            scene.remove(sceneRef.current.model);
            sceneRef.current.model = null;
        }

        const loader = new GLTFLoader();
        // Assuming the backend serves at localhost:8100, we need the full URL
        // pipeline-client handles the base URL, but generateMesh returns the relative path from the server root
        // The server serves /parts/generated at that path.
        // Wait, server returns `glb_path` as `/parts/generated/xyz.glb`.
        // The server is at http://localhost:8100.
        // We need to fetch from http://localhost:8100/parts/generated/xyz.glb
        // or via a proxy. Let's use the full URL helper or construct it.
        const fullUrl = `http://localhost:8100${urlPath}`;

        loader.load(fullUrl, (gltf) => {
            const model = gltf.scene;

            // Normalize size
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1.5 / maxDim;

            model.scale.setScalar(scale);
            model.position.sub(center.multiplyScalar(scale));
            model.position.y += size.y * scale / 2;

            model.traverse(c => {
                if (c instanceof THREE.Mesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });

            scene.add(model);
            if (sceneRef.current) sceneRef.current.model = model;
        }, undefined, (err) => {
            console.error(err);
            setError("Failed to load 3D model in viewer.");
        });
    };

    return (
        <div style={{ display: "flex", width: "100vw", height: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}>

            {/* Sidebar Controls */}
            <div style={{ width: 340, background: COLORS.panel, borderRight: `1px solid ${COLORS.border}`, padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Header */}
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Image → 3D</h1>
                    <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>
                        Local TripoSG Pipeline Verifier
                    </div>
                </div>

                {/* Status */}
                <div style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: backendOnline ? COLORS.success + "22" : COLORS.danger + "22",
                    border: `1px solid ${backendOnline ? COLORS.success : COLORS.danger}`,
                    color: backendOnline ? COLORS.success : COLORS.danger,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                }}>
                    <span style={{ fontSize: 16 }}>{backendOnline ? "●" : "○"}</span>
                    {backendOnline ? "Backend Online (Port 8100)" : "Backend Offline"}
                </div>

                {/* Input */}
                <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: COLORS.textDim }}>REFERENCE IMAGE</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        style={{ width: "100%", fontSize: 13 }}
                    />
                </div>

                {/* Preview */}
                {previewUrl && (
                    <div style={{
                        width: "100%",
                        height: 200,
                        background: "#000",
                        borderRadius: 8,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1px solid ${COLORS.border}`
                    }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} alt="Preview" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                    </div>
                )}

                {/* Action */}
                <button
                    onClick={handleGenerate}
                    disabled={!selectedFile || !backendOnline || loading}
                    style={{
                        padding: "12px",
                        borderRadius: 8,
                        border: "none",
                        background: loading ? COLORS.border : COLORS.accent,
                        color: loading ? COLORS.textDim : "#fff",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: loading || !selectedFile ? "not-allowed" : "pointer",
                        opacity: loading || !selectedFile ? 0.7 : 1,
                    }}
                >
                    {loading ? "Generating 3D Mesh (10-15s)..." : "Generate 3D Mesh"}
                </button>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: 12,
                        background: COLORS.danger + "22",
                        border: `1px solid ${COLORS.danger}`,
                        borderRadius: 8,
                        color: COLORS.danger,
                        fontSize: 13
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Result Info */}
                {result && (
                    <div style={{
                        padding: 12,
                        background: COLORS.success + "11",
                        border: `1px solid ${COLORS.success}`,
                        borderRadius: 8,
                        fontSize: 13
                    }}>
                        <div style={{ fontWeight: 600, color: COLORS.success, marginBottom: 4 }}>✅ Generation Complete</div>
                        <div>Vertices: {result.vertices}</div>
                        <div>Faces: {result.faces}</div>
                        <div>Time: {result.elapsed_s}s</div>
                        <a
                            href={`http://localhost:8100${result.glb_path}`}
                            download
                            style={{
                                display: "inline-block",
                                marginTop: 8,
                                color: COLORS.accent,
                                textDecoration: "none",
                                fontWeight: 600
                            }}
                        >
                            ⬇️ Download GLB
                        </a>
                    </div>
                )}

            </div>

            {/* Viewer */}
            <div style={{ flex: 1, position: "relative" }}>
                <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

                <div style={{
                    position: "absolute",
                    bottom: 20,
                    left: 20,
                    background: "rgba(0,0,0,0.6)",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    color: COLORS.textDim,
                    fontFamily: "monospace"
                }}>
                    Interact: Left Click (Rotate) • Right Click (Pan) • Scroll (Zoom)
                </div>
            </div>

        </div>
    );
}
