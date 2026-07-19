import React from 'react';

/**
 * Bold, clean hotel icon for tile display.
 * Fills the viewBox — no dead space.
 */
export default function HotelIcon({ size = 32 }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			{/* Main tower */}
			<rect
				x="2"
				y="5"
				width="20"
				height="18"
				rx="1.5"
				fill="#e74c3c"
				stroke="#a71d2a"
				strokeWidth="1.5"
			/>
			{/* Roof ledge */}
			<rect
				x="1"
				y="3"
				width="22"
				height="4"
				rx="1"
				fill="#c0392b"
				stroke="#a71d2a"
				strokeWidth="1.5"
			/>
			{/* H sign board */}
			<rect
				x="6"
				y="1"
				width="12"
				height="4"
				rx="2"
				fill="#f1c40f"
				stroke="#d4a017"
				strokeWidth="1"
			/>
			{/* "H" letter on sign */}
			<text x="12" y="4" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#a71d2a">
				H
			</text>
			{/* Windows — 2 columns, 2 rows */}
			<rect x="5" y="10" width="5" height="5" rx="1" fill="#fdd" />
			<rect x="14" y="10" width="5" height="5" rx="1" fill="#fdd" />
			<rect x="5" y="17" width="5" height="5" rx="1" fill="#fdd" />
			<rect x="14" y="17" width="5" height="5" rx="1" fill="#fdd" />
		</svg>
	);
}
