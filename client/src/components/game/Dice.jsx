import React, { useEffect, useRef } from 'react';
import './dice.css';

// Face transforms — which rotation shows that pip face to the viewer.
// These are applied as inline el.style.transform (no CSS var() in keyframes).
const FACE = {
	1: 'rotateX(180deg)',
	2: 'rotateX(-90deg)',
	3: 'rotateY(90deg)',
	4: 'rotateY(-90deg)',
	5: 'rotateX(90deg)',
	6: 'rotateX(0deg)',
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
			<Die value={dice?.[0] ?? 1} rolling={rolling} altSpin={false} />
			<Die value={dice?.[1] ?? 1} rolling={rolling} altSpin={true} />
		</div>
	);
}

function Die({ value, rolling, altSpin }) {
	const cubeRef = useRef(null);
	// Tracks state between renders without causing re-renders
	const s = useRef({ mounted: false, wasRolling: false });

	useEffect(() => {
		const el = cubeRef.current;
		if (!el) return;

		if (rolling) {
			// ── Start spin ──────────────────────────────────────────
			s.current.wasRolling = true;
			el.style.setProperty('transition', 'none', 'important');
			el.style.removeProperty('transform');
			el.classList.remove('dice-spin', 'dice-spin-alt');
			// Force reflow so re-adding the class restarts the animation
			void el.offsetHeight;
			el.classList.add(altSpin ? 'dice-spin-alt' : 'dice-spin');
		} else {
			const justSettling = s.current.wasRolling;
			s.current.wasRolling = false;
			el.classList.remove('dice-spin', 'dice-spin-alt');
			void el.offsetHeight;
			// Only update the face when:
			// • First mount (show initial face, no transition)
			// • Just finished rolling (settle with ease-out transition)
			// Otherwise the server updates lastDice BEFORE rolling=true fires,
			// which would instantly reveal the result before any spin.
			if (!s.current.mounted || justSettling) {
				const tr = justSettling ? 'transform 0.1s ease-out' : 'none';
				el.style.setProperty('transition', tr, 'important');
				s.current.mounted = true;
				el.style.setProperty('transform', FACE[value] ?? FACE[6], 'important');
			}
		}
	}, [rolling, value, altSpin]);

	return (
		<div className="dice-outer">
			<div className="dice-inner">
				<div className="dice-cube" ref={cubeRef}>
					{[1, 2, 3, 4, 5, 6].map((s) => (
						<div key={s} className="dice-face" data-side={s}>
							{PIPS[s].map((a, i) => (
								<div key={i} className="dice-dot" style={{ gridArea: a }} />
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

// Intentionally slow while testing. Increase speed later.
export const DICE_TOTAL_MS = 350;
