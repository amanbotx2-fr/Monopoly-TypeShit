import React from 'react';
import {
	Train,
	Lightbulb,
	Droplet,
	HelpCircle,
	Package,
	Coins,
	Car,
	PlayCircle,
	Palmtree,
} from 'lucide-react';
import { flagUrl } from '../../flagUtils.js';

// Side is passed in from Board.jsx — no hardcoded position logic here.
export default function Tile({ def, side, gridArea, state, players, onClick, onHover, highlight, highlightColor }) {
	const mortgaged = state?.mortgaged;
	const isClickable = ['property', 'station', 'utility'].includes(def.type);
	const ownerColor = state?.owner ? players.find((p) => p.userId === state.owner)?.color : null;

	const tileClass = [
		'tile',
		`tile-side-${side}`,
		side === 'corner' ? 'tile-corner' : '',
		mortgaged ? 'mortgaged' : '',
		isClickable ? 'clickable' : '',
		highlight ? `highlight-${highlight}` : '',
		// Special type classes for gradient backgrounds
		def.type === 'station' ? 'tile-station' : '',
		def.type === 'utility' && def.name?.toLowerCase().includes('electric')
			? 'tile-utility-power'
			: '',
		def.type === 'utility' && def.name?.toLowerCase().includes('water')
			? 'tile-utility-water'
			: '',
		def.type === 'tax' ? 'tile-tax' : '',
		def.type === 'chance' ? 'tile-chance' : '',
		def.type === 'chest' ? 'tile-chest' : '',
		def.type === 'jail' ? 'tile-jail' : '',
		def.type === 'go' ? 'tile-go' : '',
		def.type === 'parking' ? 'tile-parking' : '',
		def.type === 'gotojail' ? 'tile-gotojail' : '',
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
			{/* Owner glow stripe on outer edge */}
			{ownerColor && (
				<div className="owner-stripe" style={{ color: ownerColor, background: ownerColor }} />
			)}

			{/* Position highlight ring */}
			{highlight === 'position' && (
				<div className="position-highlight" style={{ '--hl-color': highlightColor }} />
			)}

			{/* Color bar (properties only) */}
			{def.type === 'property' && def.color && (
				<div className="tile-color-bar" style={{ background: def.color }}>
					<HouseRow state={state} side={side} />
				</div>
			)}

			{/* Flag circle at inner edge (properties only, like RichUp) */}
			{def.type === 'property' && flagUrl(def.name) && (
				<div className="tile-flag">
					<img src={flagUrl(def.name)} alt={def.name} loading="lazy" />
				</div>
			)}

			{/* Tile content */}
			{side === 'corner' ? (
				<CornerContent def={def} />
			) : (
				<TileBody def={def} state={state} />
			)}
		</div>
	);
}

// ─── Side tile body ──────────────────────────────────────────────────────────
function TileBody({ def, state }) {
	if (def.type === 'property') {
		return (
			<div className="tile-body">
				<div className="tile-name">{def.name}</div>
				<div className="tile-price">{def.price}</div>
			</div>
		);
	}
	if (def.type === 'station') {
		return (
			<div className="tile-body">
				<Train className="tile-icon station-icon" />
				<div className="tile-name">{def.name}</div>
				<div className="tile-price">{def.price}</div>
			</div>
		);
	}
	if (def.type === 'utility') {
		const isElectric = def.name?.toLowerCase().includes('electric');
		const Icon = isElectric ? Lightbulb : Droplet;
		return (
			<div className="tile-body">
				<Icon className="tile-icon" color={isElectric ? '#ff0' : '#0ff'} />
				<div className="tile-name">{def.name}</div>
				<div className="tile-price">{def.price}</div>
			</div>
		);
	}
	if (def.type === 'chance') {
		return (
			<div className="tile-body">
				<HelpCircle className="tile-icon" color="#ff95bc" />
				<div className="tile-name" style={{ color: '#ff95bc' }}>
					Chance
				</div>
			</div>
		);
	}
	if (def.type === 'chest') {
		return (
			<div className="tile-body">
				<Package className="tile-icon" color="#f2a841" />
				<div className="tile-name" style={{ color: '#f2a841' }}>
					Chest
				</div>
			</div>
		);
	}
	if (def.type === 'tax') {
		return (
			<div className="tile-body">
				<Coins className="tile-icon" color="#ff6b6b" />
				<div className="tile-name">{def.name}</div>
				<div className="tile-tax-amount">${def.amount}</div>
			</div>
		);
	}
	return null;
}

// ─── Corner tiles ────────────────────────────────────────────────────────────
function CornerContent({ def }) {
	if (def.type === 'go') {
		return (
			<div className="tile-corner-body">
				<PlayCircle className="tile-icon" color="#4ade80" />
				<div className="tile-corner-label" style={{ color: '#4ade80' }}>
					GO
				</div>
				<div className="tile-corner-sub">Collect salary</div>
			</div>
		);
	}
	if (def.type === 'jail') {
		return (
			<div className="tile-corner-body">
				<div className="tile-corner-label" style={{ opacity: 0.6 }}>
					Passing by
				</div>
				<div className="jail-bars">
					<div
						className="jail-label"
						style={{
							position: 'absolute',
							bottom: 0,
							right: 0,
							left: 0,
							textAlign: 'center',
							margin: '0 auto',
							background: 'linear-gradient(to bottom, transparent, #607d8b)',
							padding: '0.5em 0.5em 0.125em',
							borderRadius: '0.25em 0.25em 0 0',
							zIndex: 5,
						}}
					>
						In Prison
					</div>
				</div>
			</div>
		);
	}
	if (def.type === 'parking') {
		return (
			<div className="tile-corner-body">
				<div className="parking-image">
					<Palmtree size={28} color="#a78bfa" />
				</div>
				<div className="tile-corner-label">Vacation</div>
			</div>
		);
	}
	if (def.type === 'gotojail') {
		return (
			<div className="tile-corner-body">
				<Car className="tile-icon" color="#ff6b6b" />
				<div className="tile-corner-label" style={{ color: '#ff6b6b' }}>
					Go to prison
				</div>
			</div>
		);
	}
	return null;
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
