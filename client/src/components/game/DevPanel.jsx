import React, { useState, useCallback, useEffect } from 'react';
import { FlaskConical, X, ChevronDown, ChevronRight } from 'lucide-react';

const DEV_PANEL_KEY = 'Ctrl+Shift+D';

function buildTileOptions(tiles) {
	return tiles
		.filter((t) => ['property', 'station', 'utility'].includes(t.type))
		.map((t) => ({
			pos: t.pos,
			label: `[${t.pos}] ${t.name}${t.price != null ? ` ($${t.price})` : ''}`,
		}));
}

export default function DevPanel({ room, me, act }) {
	const [open, setOpen] = useState(false);
	const [section, setSection] = useState(null); // 'give' | 'roll' | 'cash' | 'pos'

	// Form state
	const [targetUserId, setTargetUserId] = useState('');
	const [selectedPos, setSelectedPos] = useState('');
	const [cashAmount, setCashAmount] = useState('');
	const [d1, setD1] = useState('3');
	const [d2, setD2] = useState('4');

	const tileOptions = React.useMemo(() => buildTileOptions(room.board.tiles), [room.board.tiles]);
	const playerOptions = room.players.filter((p) => !p.bankrupt);

	// Reset form when section changes.
	const switchSection = useCallback((s) => {
		setSection((prev) => (prev === s ? null : s));
		setTargetUserId('');
		setSelectedPos('');
		setCashAmount('');
		setD1('3');
		setD2('4');
	}, []);

	// Keyboard shortcut.
	useEffect(() => {
		function onKey(e) {
			if (e.ctrlKey && e.shiftKey && e.key === 'D') {
				e.preventDefault();
				setOpen((o) => !o);
			}
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	function send(cmd, extra = {}) {
		const payload = { cmd, userId: targetUserId || me.userId, ...extra };
		console.log('[dev-panel] sending', payload);
		act('dev-command', payload);
	}

	if (!open) {
		return (
			<button
				className="btn ghost sm"
				title={`Dev Panel (${DEV_PANEL_KEY})`}
				onClick={() => setOpen(true)}
				style={{
					position: 'fixed',
					bottom: 12,
					right: 12,
					zIndex: 9999,
					opacity: 0.5,
					background: 'var(--surface)',
					border: '1px solid var(--border)',
					borderRadius: 'var(--radius-md)',
					padding: '6px 8px',
				}}
			>
				<FlaskConical size={14} />
			</button>
		);
	}

	const sharedInputStyle = {
		width: '100%',
		padding: '4px 8px',
		borderRadius: 'var(--radius-sm)',
		border: '1px solid var(--border)',
		background: 'var(--bg)',
		color: 'var(--text)',
		fontSize: 12,
	};

	return (
		<div
			style={{
				position: 'fixed',
				bottom: 12,
				right: 12,
				zIndex: 9999,
				width: 280,
				maxHeight: 'calc(100vh - 40px)',
				overflowY: 'auto',
				background: 'var(--surface)',
				border: '1px solid var(--border)',
				borderRadius: 'var(--radius-lg)',
				boxShadow: 'var(--shadow-lg)',
				fontSize: 12,
			}}
		>
			{/* Header */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 6,
					padding: '8px 10px',
					borderBottom: '1px solid var(--border)',
					background: 'var(--accent-1)',
				}}
			>
				<FlaskConical size={14} color="var(--warning)" />
				<span style={{ fontWeight: 600, flex: 1 }}>Dev Tools</span>
				<span style={{ fontSize: 10, color: 'var(--text-3)' }}>{DEV_PANEL_KEY}</span>
				<button className="btn ghost sm" onClick={() => setOpen(false)}>
					<X size={12} />
				</button>
			</div>

			{/* Body */}
			<div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
				{/* Section: Give Property */}
				<button
					className="btn ghost sm"
					onClick={() => switchSection('give')}
					style={{ justifyContent: 'flex-start', gap: 4, fontSize: 12 }}
				>
					{section === 'give' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
					Give Property
				</button>
				{section === 'give' && (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 4,
							paddingLeft: 16,
						}}
					>
						<select
							style={sharedInputStyle}
							value={targetUserId}
							onChange={(e) => setTargetUserId(e.target.value)}
						>
							<option value="">-- Select player --</option>
							{playerOptions.map((p) => (
								<option key={p.userId} value={p.userId}>
									{p.username}
								</option>
							))}
						</select>
						<select
							style={sharedInputStyle}
							value={selectedPos}
							onChange={(e) => setSelectedPos(e.target.value)}
						>
							<option value="">-- Select property --</option>
							{tileOptions.map((t) => (
								<option key={t.pos} value={t.pos}>
									{t.label}
								</option>
							))}
						</select>
						<div style={{ display: 'flex', gap: 4 }}>
							<button
								className="btn sm"
								style={{ flex: 1, fontSize: 11 }}
								disabled={!targetUserId || !selectedPos}
								onClick={() => send('give-property', { pos: Number(selectedPos) })}
							>
								Give Free
							</button>
							<button
								className="btn sm"
								style={{ flex: 1, fontSize: 11 }}
								disabled={!targetUserId || !selectedPos}
								onClick={() => send('buy-property', { pos: Number(selectedPos) })}
							>
								Buy (pay $)
							</button>
						</div>
					</div>
				)}

				{/* Section: Force Roll */}
				<button
					className="btn ghost sm"
					onClick={() => switchSection('roll')}
					style={{ justifyContent: 'flex-start', gap: 4, fontSize: 12 }}
				>
					{section === 'roll' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
					Force Next Roll
				</button>
				{section === 'roll' && (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 4,
							paddingLeft: 16,
						}}
					>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<select
								style={{ ...sharedInputStyle, width: 60 }}
								value={d1}
								onChange={(e) => setD1(e.target.value)}
							>
								{[1, 2, 3, 4, 5, 6].map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
							<span style={{ color: 'var(--text-3)' }}>+</span>
							<select
								style={{ ...sharedInputStyle, width: 60 }}
								value={d2}
								onChange={(e) => setD2(e.target.value)}
							>
								{[1, 2, 3, 4, 5, 6].map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
							<span style={{ fontSize: 11, color: 'var(--text-3)' }}>
								= {Number(d1) + Number(d2)}
								{d1 === d2 ? ' 🎲🎲' : ''}
							</span>
						</div>
						<button
							className="btn sm"
							style={{ fontSize: 11 }}
							onClick={() => send('force-roll', { d1: Number(d1), d2: Number(d2) })}
						>
							Set Next Roll
						</button>
						<div style={{ fontSize: 10, color: 'var(--text-3)' }}>
							Sets the next dice roll. The active player must then click "Roll".
						</div>
					</div>
				)}

				{/* Section: Set Cash */}
				<button
					className="btn ghost sm"
					onClick={() => switchSection('cash')}
					style={{ justifyContent: 'flex-start', gap: 4, fontSize: 12 }}
				>
					{section === 'cash' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
					Set Cash
				</button>
				{section === 'cash' && (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 4,
							paddingLeft: 16,
						}}
					>
						<select
							style={sharedInputStyle}
							value={targetUserId}
							onChange={(e) => setTargetUserId(e.target.value)}
						>
							<option value="">-- Select player --</option>
							{playerOptions.map((p) => (
								<option key={p.userId} value={p.userId}>
									{p.username} (${p.cash})
								</option>
							))}
						</select>
						<input
							type="number"
							style={sharedInputStyle}
							placeholder="Amount"
							value={cashAmount}
							min={0}
							onChange={(e) => setCashAmount(e.target.value)}
						/>
						<button
							className="btn sm"
							style={{ fontSize: 11 }}
							disabled={!targetUserId || cashAmount === ''}
							onClick={() => send('set-cash', { amount: Number(cashAmount) })}
						>
							Set Cash
						</button>
					</div>
				)}

				{/* Section: Set Position */}
				<button
					className="btn ghost sm"
					onClick={() => switchSection('pos')}
					style={{ justifyContent: 'flex-start', gap: 4, fontSize: 12 }}
				>
					{section === 'pos' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
					Set Position
				</button>
				{section === 'pos' && (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 4,
							paddingLeft: 16,
						}}
					>
						<select
							style={sharedInputStyle}
							value={targetUserId}
							onChange={(e) => setTargetUserId(e.target.value)}
						>
							<option value="">-- Select player --</option>
							{playerOptions.map((p) => (
								<option key={p.userId} value={p.userId}>
									{p.username} (pos {p.position})
								</option>
							))}
						</select>
						<select
							style={sharedInputStyle}
							value={selectedPos}
							onChange={(e) => setSelectedPos(e.target.value)}
						>
							<option value="">-- Select tile --</option>
							{room.board.tiles.map((t) => (
								<option key={t.pos} value={t.pos}>
									[{t.pos}] {t.name}
								</option>
							))}
						</select>
						<button
							className="btn sm"
							style={{ fontSize: 11 }}
							disabled={!targetUserId || !selectedPos}
							onClick={() => send('set-position', { pos: Number(selectedPos) })}
						>
							Teleport
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
