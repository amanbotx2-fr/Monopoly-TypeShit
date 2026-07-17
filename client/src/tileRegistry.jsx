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
import HouseIcon from './components/game/HouseIcon.jsx';
import HotelIcon from './components/game/HotelIcon.jsx';

// ─── Icon helpers ────────────────────────────────────────────────────────────

function IconImg({ src, size = 20 }) {
	return (
		<img
			src={src}
			alt=""
			className="tile-icon"
			style={{ objectFit: 'contain', width: size, height: size }}
		/>
	);
}

// ─── Houses / Hotel display (shown under property name when owned) ─────────────

function HousesDisplay({ houses }) {
	if (houses >= 5) {
		return (
			<div className="tile-building-wrap">
				<HotelIcon size={32} />
			</div>
		);
	}
	if (houses === 0) {
		return <div className="tile-owned-label">Owned</div>;
	}
	if (houses === 1) {
		return (
			<div className="tile-building-wrap">
				<HouseIcon size={32} />
			</div>
		);
	}
	return (
		<div className="tile-building-wrap">
			<HouseIcon size={32} label={`×${houses}`} />
		</div>
	);
}

// ─── Registry ────────────────────────────────────────────────────────────────
// Every tile type owns its rendering config in one place.
// Adding a new type = adding one entry here + an SVG in public/icons/.

const TYPES = {
	// ═══ Property / City ═════════════════════════════════════════════════════
	property: {
		corner: false,
		clickable: true,
		colorBar: true,
		badge: 'flag', // circular badge at inner edge (country flag)
		icon: (def) => def.icon || null, // def.icon set by boards.js
		body: (def, state) => (
			<>
				<div className="tile-name">{def.name}</div>
				{state?.owner != null ? (
					<HousesDisplay houses={state.houses ?? 0} />
				) : (
					<div className="tile-price">{def.price}</div>
				)}
			</>
		),
	},

	// ═══ Station / Transport ═════════════════════════════════════════════════
	station: {
		corner: false,
		clickable: true,
		colorBar: false,
		badge: null,
		cssClass: 'tile-station',
		icon: (def) => def.icon || '/icons/station.svg',
		body: (def, _state, icon) => (
			<>
				{icon ? <IconImg src={icon} /> : <Train className="tile-icon station-icon" />}
				<div className="tile-name">{def.name}</div>
				<div className="tile-price">{def.price}</div>
			</>
		),
	},

	// ═══ Utility ═════════════════════════════════════════════════════════════
	utility: {
		corner: false,
		clickable: true,
		colorBar: false,
		badge: null,
		icon: (def) =>
			def.icon ||
			(def.name?.toLowerCase().includes('electric')
				? '/icons/utility-power.svg'
				: '/icons/utility-water.svg'),
		body: (def, _state, icon) => {
			const isElectric = def.name?.toLowerCase().includes('electric');
			const LucideIcon = isElectric ? Lightbulb : Droplet;
			const cssClass = isElectric ? 'tile-utility-power' : 'tile-utility-water';
			return (
				<>
					{icon ? (
						<IconImg src={icon} />
					) : (
						<LucideIcon className="tile-icon" color={isElectric ? '#ff0' : '#0ff'} />
					)}
					<div className="tile-name">{def.name}</div>
					<div className="tile-price">{def.price}</div>
				</>
			);
		},
		cssClassFn: (def) =>
			def.name?.toLowerCase().includes('electric')
				? 'tile-utility-power'
				: 'tile-utility-water',
	},

	// ═══ Chance / Surprise ════════════════════════════════════════════════════
	chance: {
		corner: false,
		clickable: false,
		colorBar: false,
		badge: null,
		cssClass: 'tile-chance',
		icon: (def) => def.icon || '/icons/surprise.png',
		body: (_def, _state, icon) => (
			<>
				{icon ? (
					<IconImg src={icon} />
				) : (
					<HelpCircle className="tile-icon" color="#ff95bc" />
				)}
				<div className="tile-name" style={{ color: '#ff95bc' }}>
					Surprise
				</div>
			</>
		),
	},

	// ═══ Community Chest / Treasure ═══════════════════════════════════════════
	chest: {
		corner: false,
		clickable: false,
		colorBar: false,
		badge: null,
		cssClass: 'tile-chest',
		icon: (def) => def.icon || '/icons/treasure.png',
		body: (_def, _state, icon) => (
			<>
				{icon ? <IconImg src={icon} /> : <Package className="tile-icon" color="#f2a841" />}
				<div className="tile-name" style={{ color: '#f2a841' }}>
					Treasure
				</div>
			</>
		),
	},

	// ═══ Tax ══════════════════════════════════════════════════════════════════
	tax: {
		corner: false,
		clickable: false,
		colorBar: false,
		badge: null,
		cssClass: 'tile-tax',
		icon: (def) =>
			def.icon ||
			(def.name?.toLowerCase().includes('income')
				? '/icons/tax-income.svg'
				: '/icons/tax-luxury.svg'),
		body: (def, _state, icon) => (
			<>
				{icon ? <IconImg src={icon} /> : <Coins className="tile-icon" color="#ff6b6b" />}
				<div className="tile-name">{def.name}</div>
				<div className="tile-tax-amount">${def.amount}</div>
			</>
		),
	},

	// ═══ GO corner ════════════════════════════════════════════════════════════
	go: {
		corner: true,
		clickable: false,
		colorBar: false,
		badge: null,
		cssClass: 'tile-go',
		icon: (def) => def.icon || '/icons/go.svg',
		cornerBody: (def, icon) => (
			<>
				{icon ? (
					<IconImg src={icon} size={28} />
				) : (
					<PlayCircle className="tile-icon" color="#4ade80" />
				)}
				<div className="tile-corner-label" style={{ color: '#4ade80' }}>
					GO
				</div>
				<div className="tile-corner-sub">Collect salary</div>
			</>
		),
	},

	// ═══ Jail corner ══════════════════════════════════════════════════════════
	jail: {
		corner: true,
		clickable: false,
		colorBar: false,
		badge: null,
		cssClass: 'tile-jail',
		icon: (def) => def.icon || '/icons/jail.svg',
		cornerBody: (def, icon) => (
			<>
				{icon && <IconImg src={icon} size={28} />}
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
			</>
		),
	},

	// ═══ Free Parking / Vacation corner ═══════════════════════════════════════
	parking: {
		corner: true,
		clickable: false,
		colorBar: false,
		badge: null,
		cssClass: 'tile-parking',
		icon: (def) => def.icon || '/icons/vacation.png',
		cornerBody: (def, icon) => (
			<>
				<div className="parking-image">
					{icon ? (
						<IconImg src={icon} size={28} />
					) : (
						<Palmtree size={28} color="#a78bfa" />
					)}
				</div>
				<div className="tile-corner-label">Vacation</div>
			</>
		),
	},

	// ═══ Go To Jail corner ════════════════════════════════════════════════════
	gotojail: {
		corner: true,
		clickable: false,
		colorBar: false,
		badge: null,
		cssClass: 'tile-gotojail',
		icon: (def) => def.icon || '/icons/gotojail.svg',
		cornerBody: (def, icon) => (
			<>
				{icon ? (
					<IconImg src={icon} size={28} />
				) : (
					<Car className="tile-icon" color="#ff6b6b" />
				)}
				<div className="tile-corner-label" style={{ color: '#ff6b6b' }}>
					Go to prison
				</div>
			</>
		),
	},
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Look up the rendering config for a tile type.
 * Returns a frozen config object, or null for unknown types.
 */
export function getTileConfig(type) {
	return TYPES[type] || null;
}

/**
 * Resolve the icon path for a tile def.
 * Always def.icon first; falls back to type-specific default.
 */
export function resolveIcon(def) {
	if (!def) return null;
	const cfg = TYPES[def.type];
	if (!cfg?.icon) return null;
	return cfg.icon(def);
}
