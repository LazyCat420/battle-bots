"use client";

/**
 * 3D Lab — Skeleton Viewer
 * 
 * Loads UniRig-predicted skeleton FBX alongside the original GLB mesh.
 * Visualizes the bone hierarchy using SkeletonHelper so we can verify
 * the auto-rigging result before proceeding to skin weight prediction.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface BoneInfo {
    name: string;
    depth: number;
    position: THREE.Vector3;
}

export default function SkeletonViewerPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState("Loading...");
    const [boneList, setBoneList] = useState<BoneInfo[]>([]);
    const [showMesh, setShowMesh] = useState(true);
    const [showSkeleton, setShowSkeleton] = useState(true);
    const meshRef = useRef<THREE.Object3D | null>(null);
    const skeletonGroupRef = useRef<THREE.Object3D | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // ── Scene ────────────────────────────────
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#0a0e14");

        // ── Camera ───────────────────────────────
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 100);
        camera.position.set(2, 1.5, 2);

        // ── Renderer ─────────────────────────────
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.4;
        container.appendChild(renderer.domElement);

        // ── Controls ─────────────────────────────
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 0.3, 0);

        // ── Lighting ─────────────────────────────
        scene.add(new THREE.AmbientLight("#445566", 1.5));
        const keyLight = new THREE.DirectionalLight("#ffeedd", 2.5);
        keyLight.position.set(4, 6, 3);
        keyLight.castShadow = true;
        scene.add(keyLight);
        scene.add(new THREE.DirectionalLight("#6688cc", 0.8).translateX(-3).translateY(4));

        // ── Arena Floor ──────────────────────────
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 20),
            new THREE.MeshStandardMaterial({ color: "#151520", metalness: 0.3, roughness: 0.7 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        scene.add(new THREE.GridHelper(10, 20, "#222244", "#1a1a33"));

        // ── Axes ─────────────────────────────────
        scene.add(new THREE.AxesHelper(1));

        // ── Load original mesh (GLB) ─────────────
        const gltfLoader = new GLTFLoader();
        const fbxLoader = new FBXLoader();
        let hasLoadedMesh = false;
        let hasLoadedSkeleton = false;

        setStatus("Loading original mesh...");
        gltfLoader.load(
            "/parts/test_bot.glb",
            (gltf) => {
                const model = gltf.scene;
                // Make it semi-transparent so skeleton shows through
                model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        const mat = mesh.material as THREE.MeshStandardMaterial;
                        if (mat) {
                            mat.transparent = true;
                            mat.opacity = 0.4;
                            mat.depthWrite = false;
                            mat.side = THREE.DoubleSide;
                        }
                        mesh.castShadow = true;
                    }
                });
                scene.add(model);
                meshRef.current = model;
                hasLoadedMesh = true;
                updateStatus();
            },
            undefined,
            (err) => {
                console.warn("Could not load GLB mesh:", err);
                hasLoadedMesh = true;
                updateStatus();
            }
        );

        // ── Load skeleton (FBX) ──────────────────
        setStatus("Loading skeleton FBX...");
        fbxLoader.load(
            "/parts/test_bot_skeleton.fbx",
            (fbx) => {
                // Scale FBX if needed (FBX sometimes has different scale)
                // Auto-detect: if the bounding box is huge, scale down
                const box = new THREE.Box3().setFromObject(fbx);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 10) {
                    const scale = 1 / (maxDim / 2);
                    fbx.scale.setScalar(scale);
                }

                scene.add(fbx);
                skeletonGroupRef.current = fbx;

                // Find all bones and skeleton helpers
                const bones: BoneInfo[] = [];
                const skinnedMeshes: THREE.SkinnedMesh[] = [];

                fbx.traverse((child) => {
                    if ((child as THREE.Bone).isBone) {
                        const bone = child as THREE.Bone;
                        // Calculate depth
                        let depth = 0;
                        let parent = bone.parent;
                        while (parent && (parent as THREE.Bone).isBone) {
                            depth++;
                            parent = parent.parent;
                        }
                        bones.push({
                            name: bone.name || `bone_${bones.length}`,
                            depth,
                            position: bone.position.clone(),
                        });
                    }
                    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
                        skinnedMeshes.push(child as THREE.SkinnedMesh);
                    }
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        // Color the FBX mesh differently
                        mesh.material = new THREE.MeshStandardMaterial({
                            color: 0x44aa88,
                            wireframe: true,
                            transparent: true,
                            opacity: 0.3,
                        });
                    }
                });

                // Create SkeletonHelper for each SkinnedMesh
                for (const sm of skinnedMeshes) {
                    const helper = new THREE.SkeletonHelper(sm);
                    (helper.material as THREE.LineBasicMaterial).linewidth = 2;
                    (helper.material as THREE.LineBasicMaterial).color.setHex(0xff4400);
                    scene.add(helper);
                }

                // If no SkinnedMesh found, create SkeletonHelper from root
                if (skinnedMeshes.length === 0) {
                    const helper = new THREE.SkeletonHelper(fbx);
                    (helper.material as THREE.LineBasicMaterial).linewidth = 2;
                    (helper.material as THREE.LineBasicMaterial).color.setHex(0xff4400);
                    scene.add(helper);
                }

                // Add sphere markers at each bone joint
                const jointMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffaa00,
                    transparent: true,
                    opacity: 0.8,
                });
                const jointGeo = new THREE.SphereGeometry(0.015, 8, 8);
                fbx.traverse((child) => {
                    if ((child as THREE.Bone).isBone) {
                        const marker = new THREE.Mesh(jointGeo, jointMaterial);
                        child.add(marker);
                    }
                });

                queueMicrotask(() => setBoneList(bones));
                hasLoadedSkeleton = true;
                updateStatus();
            },
            undefined,
            (err) => {
                console.error("Could not load skeleton FBX:", err);
                queueMicrotask(() => setStatus("❌ Failed to load skeleton FBX: " + String(err)));
                hasLoadedSkeleton = true;
            }
        );

        function updateStatus() {
            if (hasLoadedMesh && hasLoadedSkeleton) {
                queueMicrotask(() => setStatus("✅ Skeleton + Mesh loaded!"));
            }
        }

        // ── Animation Loop ───────────────────────
        const clock = new THREE.Clock();
        let animId: number;

        function animate() {
            animId = requestAnimationFrame(animate);
            const t = clock.getElapsedTime();

            // Slowly rotate for showcase
            if (skeletonGroupRef.current && showSkeleton) {
                skeletonGroupRef.current.visible = true;
            } else if (skeletonGroupRef.current) {
                skeletonGroupRef.current.visible = false;
            }
            if (meshRef.current) {
                meshRef.current.visible = showMesh;
            }

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Toggle visibility without re-mounting (use refs)
    useEffect(() => {
        if (meshRef.current) meshRef.current.visible = showMesh;
    }, [showMesh]);
    useEffect(() => {
        if (skeletonGroupRef.current) skeletonGroupRef.current.visible = showSkeleton;
    }, [showSkeleton]);

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#0a0e14" }}>
            {/* Info Panel */}
            <div
                style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    zIndex: 10,
                    color: "#fff",
                    fontFamily: "monospace",
                    fontSize: 13,
                    background: "rgba(0,0,0,0.85)",
                    padding: "14px 18px",
                    borderRadius: 10,
                    maxWidth: 380,
                    border: "1px solid #333",
                    maxHeight: "80vh",
                    overflowY: "auto",
                }}
            >
                <div style={{ fontWeight: "bold", color: "#ff6600", fontSize: 16, marginBottom: 8 }}>
                    🦴 Skeleton Viewer — UniRig Output
                </div>
                <div style={{ marginBottom: 10, color: "#ccc" }}>{status}</div>

                {/* Toggle Controls */}
                <div style={{ marginBottom: 10, display: "flex", gap: 10 }}>
                    <label style={{ cursor: "pointer", color: "#aaa", fontSize: 12 }}>
                        <input
                            type="checkbox"
                            checked={showMesh}
                            onChange={(e) => setShowMesh(e.target.checked)}
                        />{" "}
                        Show Mesh
                    </label>
                    <label style={{ cursor: "pointer", color: "#aaa", fontSize: 12 }}>
                        <input
                            type="checkbox"
                            checked={showSkeleton}
                            onChange={(e) => setShowSkeleton(e.target.checked)}
                        />{" "}
                        Show Skeleton
                    </label>
                </div>

                {/* Bone List */}
                {boneList.length > 0 && (
                    <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                        <div style={{ color: "#ffaa00", fontWeight: "bold", marginBottom: 4 }}>
                            Predicted Bones ({boneList.length}):
                        </div>
                        {boneList.map((b, i) => (
                            <div key={i} style={{ paddingLeft: b.depth * 12, color: "#888" }}>
                                {b.depth > 0 ? "└─ " : "● "}{b.name}
                                <span style={{ color: "#555", marginLeft: 6 }}>
                                    ({b.position.x.toFixed(2)}, {b.position.y.toFixed(2)}, {b.position.z.toFixed(2)})
                                </span>
                            </div>
                        ))}
                    </div>
                )}
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
                🖱️ Drag to orbit · 🔴 Bones (orange dots) · 📐 Skeleton lines (red)
            </div>

            <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}
