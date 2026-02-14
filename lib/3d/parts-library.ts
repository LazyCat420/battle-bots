/**
 * 3D Parts Library — Procedural Three.js part generators.
 *
 * Each part is built from Three.js primitives (BoxGeometry, CylinderGeometry, etc.)
 * and returns a THREE.Group positioned at its local origin.
 *
 * Phase 1: Procedural primitives.
 * Phase 2: These get replaced by TripoSR-generated .glb files.
 */

import * as THREE from "three";

// ── Types ─────────────────────────────────────────────────

/** Attachment point where parts connect */
export interface AttachmentPoint {
    name: string;
    position: [number, number, number];
    rotation?: [number, number, number]; // euler xyz
}

/** Part metadata for the manifest */
export interface PartDefinition {
    id: string;
    category: "body" | "weapon" | "locomotion" | "armor" | "accessory";
    name: string;
    description: string;
    attachments: AttachmentPoint[];
    /** Tags for LLM selection */
    tags: string[];
}

/** The complete parts manifest */
export interface PartsManifest {
    version: number;
    parts: PartDefinition[];
}

// ── Material Helpers ──────────────────────────────────────

function metalMat(color: string, metalness = 0.7, roughness = 0.3): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function darkMetal(color: string): THREE.MeshStandardMaterial {
    const c = new THREE.Color(color).multiplyScalar(0.4);
    return metalMat(`#${c.getHexString()}`, 0.8, 0.2);
}

function glowMat(color: string): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2,
    });
}

function setShadows(mesh: THREE.Mesh, cast = true, receive = false) {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
}

// ── Body Parts ────────────────────────────────────────────

/** Low-slung armored tank chassis */
export function createTankChassis(color = "#DD3300"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "body_tank";

    // Main chassis
    const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.5, 1.2),
        metalMat(color)
    );
    chassis.position.y = 0.35;
    setShadows(chassis, true, true);
    g.add(chassis);

    // Top armor plate
    const armor = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.15, 1.0),
        darkMetal(color)
    );
    armor.position.y = 0.65;
    setShadows(armor);
    g.add(armor);

    // LED eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMaterial = glowMat("#00ff44");
    [0.2, -0.2].forEach(z => {
        const eye = new THREE.Mesh(eyeGeo, eyeMaterial);
        eye.position.set(0.8, 0.45, z);
        g.add(eye);
    });

    // Vent grills
    [-1, 1].forEach(side => {
        [0, 1, 2].forEach(i => {
            const vent = new THREE.Mesh(
                new THREE.BoxGeometry(0.02, 0.06, 0.15),
                metalMat("#111111", 0.5, 0.5)
            );
            vent.position.set(-0.3 + i * 0.15, 0.5, side * 0.61);
            g.add(vent);
        });
    });

    return g;
}

/** Dome-shaped spherical body */
export function createDomeBody(color = "#2244AA"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "body_dome";

    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6),
        metalMat(color, 0.8, 0.2)
    );
    dome.position.y = 0.15;
    setShadows(dome, true, true);
    g.add(dome);

    // Base ring
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.04, 8, 24),
        darkMetal(color)
    );
    ring.position.y = 0.15;
    ring.rotation.x = Math.PI / 2;
    setShadows(ring);
    g.add(ring);

    // Eyes
    const eyeMaterial = glowMat("#ff3300");
    [-0.18, 0.18].forEach(z => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMaterial);
        eye.position.set(0.5, 0.35, z);
        g.add(eye);
    });

    return g;
}

/** Wedge-shaped ramming body */
export function createWedgeBody(color = "#FF8800"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "body_wedge";

    // Wedge shape (extruded triangle)
    const shape = new THREE.Shape();
    shape.moveTo(-0.8, 0);
    shape.lineTo(0.8, 0);
    shape.lineTo(0.8, 0.4);
    shape.lineTo(-0.8, 0.6);
    shape.lineTo(-0.8, 0);

    const extrudeSettings = { depth: 1.0, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05 };
    const wedge = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, extrudeSettings),
        metalMat(color, 0.6, 0.4)
    );
    wedge.position.set(0, 0.1, -0.5);
    setShadows(wedge, true, true);
    g.add(wedge);

    // Front plow blade
    const plow = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.5, 1.1),
        darkMetal("#888888")
    );
    plow.position.set(0.85, 0.3, 0);
    setShadows(plow);
    g.add(plow);

    return g;
}

/** Tall upright bipedal-style torso */
export function createBipedTorso(color = "#44AA22"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "body_biped";

    // Torso
    const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.45, 0.8, 8),
        metalMat(color)
    );
    torso.position.y = 0.9;
    setShadows(torso, true, true);
    g.add(torso);

    // Head dome
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 12, 12),
        darkMetal(color)
    );
    head.position.y = 1.45;
    setShadows(head);
    g.add(head);

    // Visor
    const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.08, 0.2),
        glowMat("#00aaff")
    );
    visor.position.set(0.15, 1.42, 0);
    g.add(visor);

    // Waist
    const waist = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.35, 0.2, 8),
        metalMat("#333333", 0.6, 0.4)
    );
    waist.position.y = 0.45;
    setShadows(waist);
    g.add(waist);

    return g;
}

// ── Weapon Parts ──────────────────────────────────────────

/** Spinning horizontal blade */
export function createSpinnerBlade(_color = "#CCCCCC"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "weapon_spinner";
    g.userData.isWeapon = true;
    g.userData.animationType = "spin";

    const blade = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.08, 0.2),
        metalMat("#cccccc", 0.9, 0.1)
    );
    setShadows(blade);
    g.add(blade);

    // Hub
    const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.15, 16),
        metalMat("#555555", 0.9, 0.2)
    );
    setShadows(hub);
    g.add(hub);

    return g;
}

/** Circular saw disc */
export function createSawDisc(_color = "#AAAAAA"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "weapon_saw";
    g.userData.isWeapon = true;
    g.userData.animationType = "spin";

    // Disc
    const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.03, 24),
        metalMat("#aaaaaa", 0.9, 0.1)
    );
    disc.rotation.x = Math.PI / 2;
    setShadows(disc);
    g.add(disc);

    // Teeth ring (outer ring slightly larger)
    const teeth = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.025, 6, 24),
        metalMat("#ffffff", 0.95, 0.05)
    );
    teeth.rotation.x = Math.PI / 2;
    g.add(teeth);

    // Center hub
    const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12),
        metalMat("#666666")
    );
    hub.rotation.x = Math.PI / 2;
    g.add(hub);

    return g;
}

/** Overhead hammer arm */
export function createHammerArm(_color = "#885522"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "weapon_hammer";
    g.userData.isWeapon = true;
    g.userData.animationType = "smash";

    // Arm
    const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.8, 0.1),
        metalMat("#555555", 0.6, 0.4)
    );
    arm.position.y = 0.4;
    setShadows(arm);
    g.add(arm);

    // Hammer head
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.25, 0.25),
        metalMat("#885522", 0.5, 0.5)
    );
    head.position.y = 0.85;
    setShadows(head);
    g.add(head);

    return g;
}

/** Jousting lance / spike */
export function createLance(_color = "#DDDDDD"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "weapon_lance";
    g.userData.isWeapon = true;
    g.userData.animationType = "thrust";

    // Shaft
    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8),
        metalMat("#888888")
    );
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = 0.6;
    setShadows(shaft);
    g.add(shaft);

    // Tip (cone)
    const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.3, 8),
        metalMat("#dddddd", 0.95, 0.05)
    );
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = 1.35;
    setShadows(tip);
    g.add(tip);

    // Guard plate
    const guard = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12),
        metalMat("#444444")
    );
    guard.rotation.z = Math.PI / 2;
    g.add(guard);

    return g;
}

/** Pneumatic flipper wedge */
export function createFlipper(_color = "#2266FF"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "weapon_flipper";
    g.userData.isWeapon = true;
    g.userData.animationType = "flip";

    // Flipper plate
    const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.05, 0.5),
        metalMat("#2266ff", 0.7, 0.3)
    );
    plate.position.set(0.4, 0, 0);
    setShadows(plate);
    g.add(plate);

    // Hinge
    const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.55, 12),
        metalMat("#333333")
    );
    hinge.rotation.x = Math.PI / 2;
    g.add(hinge);

    // Pneumatic cylinder
    const piston = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8),
        metalMat("#999999", 0.8, 0.2)
    );
    piston.position.set(-0.15, 0.2, 0);
    piston.rotation.z = Math.PI / 4;
    g.add(piston);

    return g;
}

// ── Locomotion Parts ──────────────────────────────────────

/** 4 wheels in a rectangle pattern */
export function createWheelSet(_color = "#1a1a1a"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "locomotion_wheels";

    const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16);
    const wheelMat = metalMat("#1a1a1a", 0.3, 0.8);

    const positions: [number, number, number][] = [
        [-0.6, 0.2, 0.65],
        [0.6, 0.2, 0.65],
        [-0.6, 0.2, -0.65],
        [0.6, 0.2, -0.65],
    ];

    positions.forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(x, y, z);
        wheel.rotation.x = Math.PI / 2;
        setShadows(wheel);
        g.add(wheel);
    });

    return g;
}

/** Tank treads (simplified as boxes) */
export function createTreads(_color = "#222222"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "locomotion_treads";

    [-0.65, 0.65].forEach(z => {
        // Track body
        const track = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.25, 0.2),
            metalMat("#222222", 0.4, 0.7)
        );
        track.position.set(0, 0.15, z);
        setShadows(track);
        g.add(track);

        // Drive sprockets
        [0.55, -0.55].forEach(x => {
            const sprocket = new THREE.Mesh(
                new THREE.CylinderGeometry(0.13, 0.13, 0.22, 12),
                metalMat("#333333")
            );
            sprocket.position.set(x, 0.15, z);
            sprocket.rotation.x = Math.PI / 2;
            setShadows(sprocket);
            g.add(sprocket);
        });
    });

    return g;
}

/** Hover pads (glowing discs underneath body) */
export function createHoverPads(_color = "#00aaff"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "locomotion_hover";

    const padGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.06, 16);
    const padMat = glowMat("#00aaff");
    const positions: [number, number, number][] = [
        [-0.4, 0.03, -0.35],
        [0.4, 0.03, -0.35],
        [-0.4, 0.03, 0.35],
        [0.4, 0.03, 0.35],
    ];

    positions.forEach(([x, y, z]) => {
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(x, y, z);
        g.add(pad);
    });

    return g;
}

// ── Armor Parts ───────────────────────────────────────────

/** Front plow shield */
export function createPlowShield(_color = "#777777"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "armor_plow";

    const plow = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.6, 1.2),
        metalMat("#777777", 0.7, 0.3)
    );
    setShadows(plow, true, true);
    g.add(plow);

    // Reinforcement bars
    [0.3, -0.3].forEach(z => {
        const bar = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.08, 0.08),
            metalMat("#555555")
        );
        bar.position.set(0.06, -0.1, z);
        setShadows(bar);
        g.add(bar);
    });

    return g;
}

/** Top spike rack */
export function createSpikeRack(_color = "#CCCCCC"): THREE.Group {
    const g = new THREE.Group();
    g.userData.partId = "armor_spikes";

    [-0.3, 0, 0.3].forEach(z => {
        const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.04, 0.25, 6),
            metalMat("#cccccc", 0.9, 0.1)
        );
        spike.position.set(0, 0.125, z);
        setShadows(spike);
        g.add(spike);
    });

    return g;
}

// ── Part Registry ─────────────────────────────────────────

/** Maps part IDs to their generator functions */
export const PART_GENERATORS: Record<string, (color?: string) => THREE.Group> = {
    // Bodies
    body_tank: createTankChassis,
    body_dome: createDomeBody,
    body_wedge: createWedgeBody,
    body_biped: createBipedTorso,
    // Weapons
    weapon_spinner: createSpinnerBlade,
    weapon_saw: createSawDisc,
    weapon_hammer: createHammerArm,
    weapon_lance: createLance,
    weapon_flipper: createFlipper,
    // Locomotion
    locomotion_wheels: createWheelSet,
    locomotion_treads: createTreads,
    locomotion_hover: createHoverPads,
    // Armor
    armor_plow: createPlowShield,
    armor_spikes: createSpikeRack,
};

// ── Parts Manifest ────────────────────────────────────────

export const PARTS_MANIFEST: PartsManifest = {
    version: 1,
    parts: [
        // Bodies
        {
            id: "body_tank",
            category: "body",
            name: "Tank Chassis",
            description: "Low-slung armored tank body with LED eyes and vent grills",
            tags: ["tank", "armored", "low", "heavy"],
            attachments: [
                { name: "weapon_top", position: [0, 0.75, 0] },
                { name: "weapon_left", position: [-0.8, 0.5, 0] },
                { name: "weapon_right", position: [0.8, 0.5, 0] },
                { name: "weapon_front", position: [0.9, 0.4, 0] },
                { name: "armor_front", position: [0.85, 0.35, 0] },
                { name: "armor_top", position: [0, 0.72, 0] },
            ],
        },
        {
            id: "body_dome",
            category: "body",
            name: "Dome Body",
            description: "Spherical dome-shaped body, compact and well-rounded",
            tags: ["dome", "round", "compact", "agile"],
            attachments: [
                { name: "weapon_top", position: [0, 0.55, 0] },
                { name: "weapon_left", position: [-0.55, 0.25, 0] },
                { name: "weapon_right", position: [0.55, 0.25, 0] },
                { name: "weapon_front", position: [0.6, 0.2, 0] },
                { name: "armor_front", position: [0.65, 0.2, 0] },
                { name: "armor_top", position: [0, 0.5, 0] },
            ],
        },
        {
            id: "body_wedge",
            category: "body",
            name: "Wedge Body",
            description: "Angled wedge for ramming, with front plow blade",
            tags: ["wedge", "rammer", "fast", "aggressive"],
            attachments: [
                { name: "weapon_top", position: [0, 0.7, 0] },
                { name: "weapon_left", position: [-0.5, 0.4, 0] },
                { name: "weapon_right", position: [0.5, 0.4, 0] },
                { name: "weapon_front", position: [0.9, 0.3, 0] },
                { name: "armor_front", position: [0.9, 0.3, 0] },
                { name: "armor_top", position: [0, 0.65, 0] },
            ],
        },
        {
            id: "body_biped",
            category: "body",
            name: "Biped Torso",
            description: "Tall upright humanoid torso with visor head",
            tags: ["biped", "tall", "humanoid", "standing"],
            attachments: [
                { name: "weapon_top", position: [0, 1.55, 0] },
                { name: "weapon_left", position: [-0.4, 0.9, 0], rotation: [0, 0, -0.3] },
                { name: "weapon_right", position: [0.4, 0.9, 0], rotation: [0, 0, 0.3] },
                { name: "weapon_front", position: [0.35, 0.7, 0] },
                { name: "armor_front", position: [0.45, 0.6, 0] },
                { name: "armor_top", position: [0, 1.5, 0] },
            ],
        },
        // Weapons
        {
            id: "weapon_spinner",
            category: "weapon",
            name: "Spinner Blade",
            description: "Horizontal spinning bar of death",
            tags: ["spinner", "blade", "kinetic", "horizontal"],
            attachments: [],
        },
        {
            id: "weapon_saw",
            category: "weapon",
            name: "Saw Disc",
            description: "Circular saw disc, high speed cutting",
            tags: ["saw", "circular", "cutting", "disc"],
            attachments: [],
        },
        {
            id: "weapon_hammer",
            category: "weapon",
            name: "Hammer Arm",
            description: "Overhead pneumatic hammer for crushing blows",
            tags: ["hammer", "overhead", "crushing", "powerful"],
            attachments: [],
        },
        {
            id: "weapon_lance",
            category: "weapon",
            name: "Jousting Lance",
            description: "Pointed lance/spike for piercing attacks",
            tags: ["lance", "spike", "piercing", "thrust"],
            attachments: [],
        },
        {
            id: "weapon_flipper",
            category: "weapon",
            name: "Flipper",
            description: "Pneumatic flipper plate to launch enemies",
            tags: ["flipper", "launcher", "pneumatic", "flip"],
            attachments: [],
        },
        // Locomotion
        {
            id: "locomotion_wheels",
            category: "locomotion",
            name: "4-Wheel Drive",
            description: "Four rubber wheels for fast movement",
            tags: ["wheels", "fast", "agile", "grip"],
            attachments: [],
        },
        {
            id: "locomotion_treads",
            category: "locomotion",
            name: "Tank Treads",
            description: "Heavy tank treads for maximum traction",
            tags: ["treads", "tracks", "heavy", "traction"],
            attachments: [],
        },
        {
            id: "locomotion_hover",
            category: "locomotion",
            name: "Hover Pads",
            description: "Anti-gravity hover pads for smooth floating movement",
            tags: ["hover", "float", "smooth", "futuristic"],
            attachments: [],
        },
        // Armor
        {
            id: "armor_plow",
            category: "armor",
            name: "Plow Shield",
            description: "Thick front plow for deflecting attacks",
            tags: ["plow", "shield", "front", "defensive"],
            attachments: [],
        },
        {
            id: "armor_spikes",
            category: "armor",
            name: "Spike Rack",
            description: "Row of metal spikes on top for passive damage",
            tags: ["spikes", "passive", "damage", "intimidating"],
            attachments: [],
        },
    ],
};

// ── Bot Assembly ──────────────────────────────────────────

/** Blueprint for assembling a 3D bot from parts */
export interface BotAssembly {
    name: string;
    color: string;
    body: string;         // part ID (e.g., "body_tank")
    weapon: string;       // part ID (e.g., "weapon_spinner")
    weaponSlot: string;   // attachment name (e.g., "weapon_top")
    locomotion: string;   // part ID (e.g., "locomotion_wheels")
    armor?: string;       // optional armor part ID
    armorSlot?: string;   // optional armor attachment name
}

/**
 * Assemble a 3D bot from a BotAssembly blueprint.
 * Returns a THREE.Group containing all parts positioned at their attachment points.
 */
export function assembleBot(assembly: BotAssembly): THREE.Group {
    const bot = new THREE.Group();
    bot.userData.assembly = assembly;

    // 1. Create body
    const bodyGen = PART_GENERATORS[assembly.body];
    if (!bodyGen) {
        console.warn(`Unknown body part: ${assembly.body}`);
        return bot;
    }
    const body = bodyGen(assembly.color);
    bot.add(body);

    // 2. Find body attachment points
    const bodyDef = PARTS_MANIFEST.parts.find(p => p.id === assembly.body);

    // 3. Add locomotion (always at base)
    const locoGen = PART_GENERATORS[assembly.locomotion];
    if (locoGen) {
        const loco = locoGen();
        bot.add(loco);
    }

    // 4. Add weapon at specified attachment point
    const weaponGen = PART_GENERATORS[assembly.weapon];
    if (weaponGen && bodyDef) {
        const weapon = weaponGen(assembly.color);
        const attachment = bodyDef.attachments.find(a => a.name === assembly.weaponSlot);
        if (attachment) {
            weapon.position.set(...attachment.position);
            if (attachment.rotation) {
                weapon.rotation.set(...attachment.rotation);
            }
        }
        bot.add(weapon);
    }

    // 5. Add armor if present
    if (assembly.armor && assembly.armorSlot) {
        const armorGen = PART_GENERATORS[assembly.armor];
        if (armorGen && bodyDef) {
            const armor = armorGen();
            const attachment = bodyDef.attachments.find(a => a.name === assembly.armorSlot);
            if (attachment) {
                armor.position.set(...attachment.position);
                if (attachment.rotation) {
                    armor.rotation.set(...attachment.rotation);
                }
            }
            bot.add(armor);
        }
    }

    return bot;
}

/**
 * Animate weapon parts in a bot group.
 * Call this in the animation loop with the elapsed time.
 */
export function animateBotWeapons(bot: THREE.Group, elapsed: number): void {
    bot.traverse((child) => {
        if (child.userData.isWeapon) {
            switch (child.userData.animationType) {
                case "spin":
                    child.rotation.y = elapsed * 8;
                    break;
                case "smash":
                    // Periodic smash: raise and slam hammer
                    child.rotation.z = Math.sin(elapsed * 3) * 0.3;
                    break;
                case "thrust":
                    // Periodic thrust: extend lance forward
                    child.position.x += Math.sin(elapsed * 4) * 0.002;
                    break;
                case "flip":
                    // Periodic flip motion
                    child.rotation.z = Math.max(0, Math.sin(elapsed * 2)) * 0.5;
                    break;
            }
        }
    });
}
