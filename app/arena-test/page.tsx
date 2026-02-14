"use client";

/**
 * Arena 3D Test Page — Two hardcoded bots fighting in the 3D arena.
 *
 * Visit http://localhost:3000/arena-test to see it.
 */

import dynamic from "next/dynamic";
import type { BotDefinition } from "@/lib/types/bot";

// Dynamic import to avoid SSR issues with Three.js and Rapier WASM
const Arena3D = dynamic(() => import("@/components/Arena3D"), { ssr: false });

// ── Test bots ──────────────────────────────────────────

const testBot1: BotDefinition = {
    name: "TankSlayer",
    shape: "rectangle",
    size: 4,
    color: "#ff4444",
    speed: 5,
    armor: 7,
    weapon: {
        type: "spinner",
        damage: 6,
        cooldown: 800,
        range: 60,
    },
    attackEffect: {
        color: "#ff6600",
        secondaryColor: "#ffaa00",
        particleShape: "spark",
        intensity: 4,
        trailLength: 3,
    },
    behaviorCode: `
        const enemy = api.getEnemyPosition();
        const dist = api.getDistanceToEnemy();
        
        if (dist > 80) {
            api.moveToward(enemy, 6);
        } else if (dist < 40) {
            api.moveAway(enemy, 3);
        } else {
            api.strafe(api.random(0, 1) > 0.5 ? "left" : "right");
        }
        
        if (dist < 70) {
            api.attack();
        }
        
        api.rotateTo(api.angleTo(enemy));
    `,
    strategyDescription: "Aggressive spinner that closes distance and strafes at medium range.",
};

const testBot2: BotDefinition = {
    name: "DodgeHammer",
    shape: "circle",
    size: 3,
    color: "#4488ff",
    speed: 8,
    armor: 4,
    weapon: {
        type: "hammer",
        damage: 8,
        cooldown: 1200,
        range: 45,
    },
    attackEffect: {
        color: "#44aaff",
        secondaryColor: "#2266cc",
        particleShape: "circle",
        intensity: 3,
        trailLength: 2,
    },
    behaviorCode: `
        const enemy = api.getEnemyPosition();
        const dist = api.getDistanceToEnemy();
        const hp = api.getMyHealth();
        
        if (hp < 30) {
            api.moveAway(enemy, 9);
        } else if (dist > 60) {
            api.moveToward(enemy, 8);
        } else {
            api.strafe(tick % 60 < 30 ? "left" : "right");
        }
        
        if (dist < 50) {
            api.attack();
        }
        
        api.rotateTo(api.angleTo(enemy));
    `,
    strategyDescription: "Fast hammer bot that kites when low HP.",
};

export default function ArenaTestPage() {
    return (
        <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
            <Arena3D
                bot1={testBot1}
                bot2={testBot2}
                autoStart={true}
                onMatchEnd={(winner) => {
                    console.log("Match ended! Winner:", winner);
                }}
            />
        </div>
    );
}
