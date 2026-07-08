import React, { useState, useEffect } from 'react';
import './dice.css';

// ── 3D CSS cube dice — richup.io EXACT approach ──────────────────────────────
// NO @keyframes, NO setInterval, NO rAF, NO refs.
// Just useState + CSS transition: 1s cubic-bezier(0,0,0,1).
// Change inline transform → browser animates everything.
// ──────────────────────────────────────────────────────────────────────────────

const FACE = {
	1: { x: 180, y:   0 }, 2: { x: -90, y:   0 },
	3: { x:   0, y:  90 }, 4: { x:   0, y: -90 },
	5: { x:  90, y:   0 }, 6: { x:   0, y:   0 },
};

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
	const [spin, setSpin] = useState({ x: 0, y: 0, z: 0 });

	useEffect(() => {
		const f = FACE[value] ?? FACE[6];
		if (rolling) {
			// rAF defers the spin until after the browser paints the current
			// state — essential for the CSS transition to have a "from" value.
			const id = requestAnimationFrame(() => {
				const r = () => Math.floor(Math.random() * 7) - 3;
				setSpin({
					x: f.x + r() * 360,
					y: f.y + r() * 360,
					z: r() * 90 + (Math.floor(Math.random() * 51) - 25),
				});
			});
			return () => cancelAnimationFrame(id);
		} else {
			setSpin({ x: f.x, y: f.y, z: 0 });
		}
	}, [rolling, value]);

	const t = `rotateZ(${spin.z}deg) rotateX(${spin.x}deg) rotateY(${spin.y}deg)`;

	return (
		<div className="dice-outer">
			<div className="dice-inner">
				<div className="dice-cube" style={{ transform: t }}>
					{[1,2,3,4,5,6].map(s => (
						<div key={s} className="dice-face" data-side={s}>
							{PIPS[s].map((a,i) => (
								<div key={i} className="dice-dot" style={{gridArea:a}} />
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

export const DICE_TOTAL_MS = 1200;
