/**
 * Pipeline Client — Frontend API wrapper for the 3D bot pipeline backend.
 *
 * All calls go to the Python FastAPI server on port 8100.
 * Provides typed methods for each pipeline endpoint.
 */

const PIPELINE_URL = "http://localhost:8100";

// ── Types ───────────────────────────────────────────────

export interface PipelineStatus {
    gpu: {
        available: boolean;
        name?: string;
        total_vram_gb?: number;
        allocated_gb?: number;
        reserved_gb?: number;
        free_gb?: number;
    };
    triposr_loaded: boolean;
    output_dir: string;
    generated_parts: number;
}

export interface GenerateResult {
    part_id: string;
    glb_path: string;
    vertices: number;
    faces: number;
    elapsed_s: number;
}

export interface SearchImageResult {
    image_id: string;
    image_path: string;
    source_url: string;
    size: [number, number];
    all_results: Array<{ url: string; title: string }>;
}

export interface MergeResult {
    merged_path: string;
    parts_count: number;
    file_size: number;
}

export interface RigResult {
    output_dir: string;
    glb_input: string;
    skin_json: string | null;
    bone_count?: number;
    vertex_count?: number;
    message?: string;
}

export interface MergePart {
    path: string;
    position: [number, number, number];
    rotation: [number, number, number];
}

// ── API Client ──────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
    try {
        const resp = await fetch(`${PIPELINE_URL}/health`, { signal: AbortSignal.timeout(3000) });
        return resp.ok;
    } catch {
        return false;
    }
}

export async function getStatus(): Promise<PipelineStatus> {
    const resp = await fetch(`${PIPELINE_URL}/status`);
    if (!resp.ok) throw new Error(`Status failed: ${resp.statusText}`);
    return resp.json();
}

export async function searchImage(
    query: string,
    removeBg = true
): Promise<SearchImageResult> {
    const resp = await fetch(`${PIPELINE_URL}/search-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, remove_bg: removeBg }),
    });
    if (!resp.ok) throw new Error(`Search failed: ${resp.statusText}`);
    return resp.json();
}

export async function generateMesh(
    imageFile: File | Blob,
    resolution = 256
): Promise<GenerateResult> {
    const form = new FormData();
    form.append("file", imageFile);
    form.append("resolution", String(resolution));

    const resp = await fetch(`${PIPELINE_URL}/generate`, {
        method: "POST",
        body: form,
    });
    if (!resp.ok) throw new Error(`Generation failed: ${resp.statusText}`);
    return resp.json();
}

export async function mergeParts(
    parts: MergePart[],
    outputName = "merged_bot"
): Promise<MergeResult> {
    const resp = await fetch(`${PIPELINE_URL}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts, output_name: outputName }),
    });
    if (!resp.ok) throw new Error(`Merge failed: ${resp.statusText}`);
    return resp.json();
}

export async function rigBot(
    glbPath: string,
    outputName = "rigged_bot"
): Promise<RigResult> {
    const resp = await fetch(`${PIPELINE_URL}/rig`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ glb_path: glbPath, output_name: outputName }),
    });
    if (!resp.ok) throw new Error(`Rigging failed: ${resp.statusText}`);
    return resp.json();
}

/**
 * Get the full URL for a file served by the pipeline backend.
 */
export function pipelineFileUrl(path: string): string {
    return `${PIPELINE_URL}${path}`;
}
