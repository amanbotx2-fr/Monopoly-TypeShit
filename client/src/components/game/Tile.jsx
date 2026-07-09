import React from 'react';
import { getTileConfig, resolveIcon } from '../../tileRegistry.jsx';

// Side is passed in from Board.jsx — no hardcoded position logic here.
export default function Tile({
	def,
	side,
	gridArea,
	state,
	players,
	onClick,
	onHover,
	highlight,
	highlightColor,
}) {
	const mortgaged = state?.mortgaged;
	const cfg = getTileConfig(def.type);
	const isClickable = cfg?.clickable ?? false;
	const ownerColor = state?.owner ? players.find((p) => p.userId === state.owner)?.color : null;
	const icon = resolveIcon(def);

	const tileClass = [
		'tile',
		`tile-side-${side}`,
		side === 'corner' ? 'tile-corner' : '',
		mortgaged ? 'mortgaged' : '',
		isClickable ? 'clickable' : '',
		highlight ? `highlight-${highlight}` : '',
		cfg?.cssClass || '',
		typeof cfg?.cssClassFn === 'function' ? cfg.cssClassFn(def) : '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<div
			className={tileClass}
			style={gridArea ? { gridArea } : undefined}
			onClick={isClickable ? onClick : undefined}
			onMouseEnter={(e) => isClickable && onHover?.(e, def)}
			onMouseLeave={() => onHover?.(null, null)}
		>
			{/* Blurred flag background (richup-style glow) */}
			{cfg?.badge === 'flag' && icon && (
				<div className="tile-flag-bg">
					<div className="tile-flag-bg-inner">
						<img src={icon} alt="" aria-hidden="true" />
					</div>
				</div>
			)}

			{/* Owner glow stripe on outer edge */}
			{ownerColor && (
				<div
					className="owner-stripe"
					style={{ color: ownerColor, background: ownerColor }}
				/>
			)}

			{/* Player hover highlight ring */}
			{(highlight === 'position' || highlight === 'owned') && (
				<div className="position-highlight" style={{ '--hl-color': highlightColor }} />
			)}

			{/* Color bar (property tiles) */}
			{cfg?.colorBar && def.color && (
				<div className="tile-color-bar" style={{ background: def.color }}>
					<HouseRow state={state} side={side} />
				</div>
			)}

			{/* Flag badge at inner edge */}
			{cfg?.badge === 'flag' && icon && (
				<div className="tile-flag">
					<img src={icon} alt={def.name} loading="lazy" />
				</div>
			)}

			{/* Tile content */}
			{cfg?.corner ? (
				<CornerBody def={def} cfg={cfg} icon={icon} />
			) : (
				<SideBody def={def} state={state} cfg={cfg} icon={icon} />
			)}
		</div>
	);
}

// ─── Side tile body ──────────────────────────────────────────────────────────
function SideBody({ def, state, cfg, icon }) {
	if (!cfg) return null;
	return <div className="tile-body">{cfg.body(def, state, icon)}</div>;
}

// ─── Corner tile body ────────────────────────────────────────────────────────
function CornerBody({ def, cfg, icon }) {
	if (!cfg) return null;
	return <div className="tile-corner-body">{cfg.cornerBody(def, icon)}</div>;
}

// ─── Houses / Hotel row ──────────────────────────────────────────────────────
function HouseRow({ state, side }) {
	if (!state || state.houses === 0) return null;
	const isVertical = side === 'left' || side === 'right';
	const dir = isVertical ? 'column' : 'row';

	if (state.houses >= 5) {
		return (
			<div className="tile-houses" style={{ flexDirection: dir }}>
				<div className="hotel" />
			</div>
		);
	}
	return (
		<div className="tile-houses" style={{ flexDirection: dir }}>
			{Array.from({ length: state.houses }, (_, i) => (
				<div key={i} className="house" />
			))}
		</div>
	);
}
