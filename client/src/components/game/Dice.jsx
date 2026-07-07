import React, { useEffect, useRef } from 'react';

// 3D CSS cube dice — inline transforms + CSS transition for smooth rotation,
// like richup.io. During rolling the cube spins through random faces with
// extra full rotations for visual spin; when done it settles on the result.

// Face → cube rotation to show that face (front face = 6 is default).
const FACE_ROTATION = {
	1: 'rotateX(180deg)',
	2: 'rotateX(-90deg)',
	3: 'rotateY(90deg)',
	4: 'rotateY(-90deg)',
	5: 'rotateX(90deg)',
	6: 'rotateX(0deg)',
};

// Pip positions for each face (1..6) in a 3×3 grid. [row, col].
const PIPS = {
	1: [[1, 1]],
	2: [[0, 0], [2, 2]],
	3: [[0, 0], [1, 1], [2, 2]],
	4: [[0, 0], [0, 2], [2, 0], [2, 2]],
	5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
	6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

const CYCLE_MS = 100;
const FREEZE_MS = 800;  // when to stop spinning
const SETTLE_MS = 1100;  // total time before we consider roll "done"

export default function Dice({ dice, rolling }) {
	const d1 = dice?.[0] || 1;
	const d2 = dice?.[1] || 1;

	return (
		<div className={`dice-wrap${!dice ? ' dimmed' : ''}`}>
			<Die value={d1} rolling={rolling} />
			<Die value={d2} rolling={rolling} />
		</div>
	);
}

function Die({ value, rolling }) {
	const [phase, setPhase] = React.useState('idle'); // idle | spinning | settling
	const [displayFace, setDisplayFace] = React.useState(value);
	const timerRef = useRef(null);
	const prevRolling = useRef(rolling);
	const targetRef = useRef(value);

	// Keep target face in sync when not rolling.
	useEffect(() => {
		targetRef.current = value;
		if (!rolling) {
			setDisplayFace(value);
			setPhase('idle');
		}
	}, [value, rolling]);

	// Rolling lifecycle.
	useEffect(() => {
		// Detect rolling start: was false, now true.
		if (rolling && !prevRolling.current) {
			setPhase('spinning');
			const start = Date.now();

			const tick = () => {
				const elapsed = Date.now() - start;
				if (elapsed >= FREEZE_MS) {
					// Settle on the real result.
					setDisplayFace(targetRef.current);
					setPhase('settling');
					return;
				}
				// Spin: show a random face.
				setDisplayFace(1 + Math.floor(Math.random() * 6));
				timerRef.current = setTimeout(tick, CYCLE_MS);
			};
			tick();
		}
		prevRolling.current = rolling;

		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [rolling]);

	// Build the rotation string. During spinning we add extra full rotations
	// for visual spin; otherwise just the face rotation.
	const rotation = (() => {
		const base = FACE_ROTATION[displayFace] || FACE_ROTATION[6];
		if (phase === 'spinning') {
			// Add random full spins to make the cube tumble.
			const rx = Math.floor(Math.random() * 4) * 360;
			const ry = Math.floor(Math.random() * 4) * 360;
			const rz = (Math.floor(Math.random() * 3) - 1) * 30;
			return `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
		}
		return base;
	})();

	const spinClass = phase === 'spinning' ? ' spinning' : phase === 'settling' ? ' settling' : '';

	return (
		<div className="dice-cube-scene">
			<div
				className={`dice-cube${spinClass}`}
				style={{ transform: rotation }}
			>
				{/* Face 1 — back */}
				<div className="dice-face dice-face-back">
					{PIPS[1].map(([r, c], i) => (
						<div key={i} className="dice-pip" style={{ gridRow: r + 1, gridColumn: c + 1 }} />
					))}
				</div>
				{/* Face 2 — top */}
				<div className="dice-face dice-face-top">
					{PIPS[2].map(([r, c], i) => (
						<div key={i} className="dice-pip" style={{ gridRow: r + 1, gridColumn: c + 1 }} />
					))}
				</div>
				{/* Face 3 — left */}
				<div className="dice-face dice-face-left">
					{PIPS[3].map(([r, c], i) => (
						<div key={i} className="dice-pip" style={{ gridRow: r + 1, gridColumn: c + 1 }} />
					))}
				</div>
				{/* Face 4 — right */}
				<div className="dice-face dice-face-right">
					{PIPS[4].map(([r, c], i) => (
						<div key={i} className="dice-pip" style={{ gridRow: r + 1, gridColumn: c + 1 }} />
					))}
				</div>
				{/* Face 5 — bottom */}
				<div className="dice-face dice-face-bottom">
					{PIPS[5].map(([r, c], i) => (
						<div key={i} className="dice-pip" style={{ gridRow: r + 1, gridColumn: c + 1 }} />
					))}
				</div>
				{/* Face 6 — front */}
				<div className="dice-face dice-face-front">
					{PIPS[6].map(([r, c], i) => (
						<div key={i} className="dice-pip" style={{ gridRow: r + 1, gridColumn: c + 1 }} />
					))}
				</div>
			</div>
		</div>
	);
}

export const DICE_TOTAL_MS = SETTLE_MS;

