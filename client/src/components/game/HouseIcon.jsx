import React from 'react';

/**
 * Clean mat house silhouette. The base is taller than the roof for a
 * recognizable house shape. Label (e.g. "×3") is rendered inside the SVG
 * with generous padding so it sits comfortably in the base.
 */
export default function HouseIcon({ size = 32, label }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			{/* Roof — shallow, wide triangle */}
			<polygon
				points="1,12 12,3 23,12"
				fill="#27ae60"
				stroke="#1a7a42"
				strokeWidth="1"
				strokeLinejoin="round"
			/>
			{/* Base — taller than the roof, fills width */}
			<rect
				x="3"
				y="12"
				width="18"
				height="11"
				rx="1"
				fill="#2ecc71"
				stroke="#1a7a42"
				strokeWidth="1"
			/>
			{/* Label — centered in base with ample padding */}
			{label && (
				<text
					x="12"
					y="17.5"
					textAnchor="middle"
					dominantBaseline="central"
					fontSize="11"
					fontWeight="900"
					fill="#fff"
					stroke="rgba(0,0,0,0.25)"
					strokeWidth="0.5"
					paintOrder="stroke fill"
				>
					{label}
				</text>
			)}
		</svg>
	);
}
