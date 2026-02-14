/**
 * Skinned Mesh Loader — Apply UniRig skin weights to Three.js meshes
 *
 * Converts UniRig JSON output to Three.js SkinnedMesh:
 * - Creates Bone hierarchy from JSON
 * - Sets skinIndex/skinWeight BufferAttributes
 * - Normalizes weights (4 influences max)
 *
 * Usage:
 *   const rigged = await loadRiggedMesh(glbPath, skinJsonPath);
 *   scene.add(rigged.mesh);
 *   scene.add(rigged.skeleton); // SkeletonHelper for debug
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── Types ───────────────────────────────────────────────

export interface SkinBone {
    name: string;
    parent: number;  // -1 for root
    head: [number, number, number];
    tail: [number, number, number];
}

export interface SkinWeight {
    vertex_index: number;
    bones: number[];    // bone indices
    weights: number[];  // corresponding weights
}

export interface SkinJSON {
    bones: SkinBone[];
    weights: SkinWeight[];
    vertex_count: number;
}

// ── Core Functions ──────────────────────────────────────

/**
 * Build a Three.js Bone hierarchy from UniRig skin JSON.
 */
export function createBoneHierarchy(skinData: SkinJSON): {
    bones: THREE.Bone[];
    rootBone: THREE.Bone;
} {
    const bones: THREE.Bone[] = [];

    // Create all bones
    for (const boneData of skinData.bones) {
        const bone = new THREE.Bone();
        bone.name = boneData.name;

        // Position bone at its head position
        bone.position.set(
            boneData.head[0],
            boneData.head[1],
            boneData.head[2]
        );

        bones.push(bone);
    }

    // Establish parent-child relationships
    let rootBone: THREE.Bone | null = null;
    for (let i = 0; i < skinData.bones.length; i++) {
        const parentIdx = skinData.bones[i].parent;
        if (parentIdx === -1) {
            rootBone = bones[i];
        } else if (parentIdx >= 0 && parentIdx < bones.length) {
            bones[parentIdx].add(bones[i]);
            // Convert position to local space relative to parent
            const parentHead = skinData.bones[parentIdx].head;
            const childHead = skinData.bones[i].head;
            bones[i].position.set(
                childHead[0] - parentHead[0],
                childHead[1] - parentHead[1],
                childHead[2] - parentHead[2]
            );
        }
    }

    if (!rootBone) {
        // Fallback: use first bone as root
        rootBone = bones[0];
    }

    return { bones, rootBone };
}

/**
 * Apply skin weights from UniRig JSON to a Three.js BufferGeometry.
 * Uses 4 bone influences per vertex (Three.js standard).
 */
export function applySkinWeights(
    geometry: THREE.BufferGeometry,
    skinData: SkinJSON
): void {
    const vertexCount = geometry.attributes.position.count;

    // Create typed arrays for skinIndex and skinWeight (4 influences per vertex)
    const skinIndices = new Float32Array(vertexCount * 4);
    const skinWeights = new Float32Array(vertexCount * 4);

    // Build a lookup map: vertex_index → {bones, weights}
    const weightMap = new Map<number, { bones: number[]; weights: number[] }>();
    for (const w of skinData.weights) {
        weightMap.set(w.vertex_index, { bones: w.bones, weights: w.weights });
    }

    // Apply weights to each vertex
    for (let vi = 0; vi < vertexCount; vi++) {
        const data = weightMap.get(vi);

        if (data && data.bones.length > 0) {
            // Sort by weight descending, take top 4
            const pairs = data.bones.map((b, i) => ({
                bone: b,
                weight: data.weights[i],
            }));
            pairs.sort((a, b) => b.weight - a.weight);
            const top4 = pairs.slice(0, 4);

            // Normalize weights to sum to 1
            const total = top4.reduce((sum, p) => sum + p.weight, 0);
            const scale = total > 0 ? 1 / total : 0;

            for (let j = 0; j < 4; j++) {
                const idx = vi * 4 + j;
                if (j < top4.length) {
                    skinIndices[idx] = top4[j].bone;
                    skinWeights[idx] = top4[j].weight * scale;
                } else {
                    skinIndices[idx] = 0;
                    skinWeights[idx] = 0;
                }
            }
        } else {
            // No weights for this vertex — bind to bone 0 with weight 1
            skinIndices[vi * 4] = 0;
            skinWeights[vi * 4] = 1;
            for (let j = 1; j < 4; j++) {
                skinIndices[vi * 4 + j] = 0;
                skinWeights[vi * 4 + j] = 0;
            }
        }
    }

    geometry.setAttribute(
        'skinIndex',
        new THREE.BufferAttribute(skinIndices, 4)
    );
    geometry.setAttribute(
        'skinWeight',
        new THREE.BufferAttribute(skinWeights, 4)
    );
}

/**
 * Create a SkinnedMesh from a regular mesh + UniRig skin data.
 */
export function createSkinnedMesh(
    mesh: THREE.Mesh,
    skinData: SkinJSON
): THREE.SkinnedMesh {
    const { bones, rootBone } = createBoneHierarchy(skinData);

    // Apply skin weights to the geometry
    const geometry = mesh.geometry.clone();
    applySkinWeights(geometry, skinData);

    // Create the SkinnedMesh
    const skinnedMesh = new THREE.SkinnedMesh(
        geometry,
        mesh.material
    );
    skinnedMesh.name = mesh.name || 'rigged_bot';

    // Create skeleton
    const skeleton = new THREE.Skeleton(bones);
    skinnedMesh.add(rootBone);
    skinnedMesh.bind(skeleton);
    skinnedMesh.normalizeSkinWeights();

    return skinnedMesh;
}

/**
 * Load a GLB mesh and apply UniRig skin weights.
 * Returns the SkinnedMesh and a SkeletonHelper for visualization.
 */
export async function loadRiggedMesh(
    glbUrl: string,
    skinJsonUrl: string
): Promise<{
    mesh: THREE.SkinnedMesh;
    helper: THREE.SkeletonHelper;
    skinData: SkinJSON;
}> {
    // Load GLB
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(glbUrl);

    // Find the first mesh in the scene
    let sourceMesh: THREE.Mesh | null = null;
    gltf.scene.traverse((child) => {
        if (!sourceMesh && (child as THREE.Mesh).isMesh) {
            sourceMesh = child as THREE.Mesh;
        }
    });

    if (!sourceMesh) {
        throw new Error('No mesh found in GLB');
    }

    // Load skin JSON
    const resp = await fetch(skinJsonUrl);
    if (!resp.ok) {
        throw new Error(`Failed to load skin JSON: ${resp.statusText}`);
    }
    const skinData: SkinJSON = await resp.json();

    // Create SkinnedMesh
    const skinnedMesh = createSkinnedMesh(sourceMesh, skinData);

    // Create SkeletonHelper for debug visualization
    const helper = new THREE.SkeletonHelper(skinnedMesh);

    return { mesh: skinnedMesh, helper, skinData };
}
