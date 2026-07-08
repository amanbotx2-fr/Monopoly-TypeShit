import React, { useState, useEffect } from 'react';
import './dice.css';

// ── 3D CSS cube dice — richup.io style ────────────────────────────────────────
//
// Architecture (matches richup.io's HTML/CSS):
//   dice-outer   ← perspective, floor shadow (::before)
//   dice-inner   ← constant 3D tilt: rotateX(35deg) rotateZ(45deg)
//   dice-cube    ← preserve-3d, CSS transition handles ALL animation
//     6 faces    ← each at translateZ(half) with appropriate rotation
//     3 edges    ← flat fillers that hide gaps at cube seams
//
// Animation: NO keyframes, NO setInterval. Just change the inline transform
// on dice-cube and let CSS `transition: 1s cubic-bezier(0,0,0,1)` do the
// spinning + settling. Extra full rotations (e.g. rotateX(1260deg)) create
// visual tumbling during the transition; the net rotation lands on the
// correct face.
// ──────────────────────────────────────────────────────────────────────────────

// Net X/Y rotation to show each face (face 6 = front, default).
const FACE = {
	1: { x: 180, y: 0 },
	2: { x: -90, y: 0 },
	3: { x: 0, y: 90 },
	4: { x: 0, y: -90 },
	5: { x: 90, y: 0 },
	6: { x: 0, y: 0 },
};

// Pip positions as CSS grid-area names ('a'…'i' for a 3×3 grid).
const PIPS = {
	1: ['e'],
	2: ['a', 'i'],
	3: ['a', 'e', 'i'],
	4: ['a', 'c', 'g', 'i'],
	5: ['a', 'c', 'e', 'g', 'i'],
	6: ['a', 'c', 'd', 'f', 'g', 'i'],
};

export default function Dice({ dice, rolling }) {
	return (
		<div className={`dice-wrap${!dice ? ' dimmed' : ''}`}>
			<Die value={dice?.[0] ?? 1} rolling={rolling} />
			<Die value={dice?.[1] ?? 1} rolling={rolling} />
		</div>
	);
}

function Die({ value, rolling }) {
	const [spinDeg, setSpinDeg] = useState({ x: 0, y: 0, z: 0 });

	useEffect(() => {
		const f = FACE[value] ?? FACE[6];
		if (rolling) {
			// Random large rotations that net out to the target face.
			// Extra full 360° spins create the tumbling effect during transition.
			setSpinDeg({
				x: f.x + (2 + Math.floor(Math.random() * 4)) * 360,
				y: f.y + (2 + Math.floor(Math.random() * 3)) * 360 * (Math.random() > 0.5 ? 1 : -1),
				z: Math.floor(Math.random() * 360),
			});
		} else {
			// Settle: exact face rotation, no extra spins.
			setSpinDeg({ x: f.x, y: f.y, z: 0 });
		}
	}, [rolling, value]);

	const transform = `rotateZ(${spinDeg.z}deg) rotateX(${spinDeg.x}deg) rotateY(${spinDeg.y}deg)`;

	return (
		<div className="dice-outer">
			<div className="dice-inner">
				<div className="dice-cube" style={{ transform }}>
					{[1, 2, 3, 4, 5, 6].map((f) => (
						<div key={f} className="dice-face" data-side={f}>
							{PIPS[f].map((area, i) => (
								<div key={i} className="dice-dot" style={{ gridArea: area }} />
							))}
						</div>
					))}
					<div className="dice-edge d-edge-x" />
					<div className="dice-edge d-edge-y" />
					<div className="dice-edge d-edge-z" />
				</div>
			</div>
		</div>
	);
}

// Keep the same export so Game.jsx timing stays consistent.
export const DICE_TOTAL_MS = 1200;

