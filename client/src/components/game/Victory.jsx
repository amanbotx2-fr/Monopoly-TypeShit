import React from 'react';
import { Trophy, LogOut } from 'lucide-react';

export default function Victory({ room, onLeave }) {
	const winner = room.players.find((p) => p.userId === room.winnerUserId);
	const rest = room.players
		.filter((p) => p.userId !== room.winnerUserId)
		.sort(
			(a, b) => b.cash + (b.owned?.length || 0) * 50 - (a.cash + (a.owned?.length || 0) * 50),
		);

	return (
		<div
			className="modal-backdrop fade-in"
			style={{ zIndex: 200, background: 'rgba(0,0,0,0.8)' }}
		>
			<div
				className="modal-panel slide-up"
				style={{
					width: 'min(100%, 420px)',
					padding: 32,
					borderColor: 'var(--auction)',
					textAlign: 'center',
				}}
			>
				<Trophy size={56} color="var(--auction)" style={{ marginBottom: 10 }} />
				<div className="section-title" style={{ justifyContent: 'center' }}>
					Winner
				</div>
				{winner && (
					<>
						<div
							className="dot"
							style={{
								background: winner.color,
								width: 24,
								height: 24,
								margin: '12px auto',
							}}
						/>
						<div style={{ fontSize: 28, fontWeight: 900 }}>{winner.username}</div>
						<div className="money" style={{ fontSize: 18, marginTop: 2 }}>
							${winner.cash.toLocaleString()}
						</div>
					</>
				)}

				<div style={{ marginTop: 22, textAlign: 'left' }}>
					{rest.map((p, i) => (
						<div
							key={p.userId}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 8,
								padding: '6px 0',
								fontSize: 13,
								color: p.bankrupt ? 'var(--text-4)' : 'var(--text-2)',
							}}
						>
							<span style={{ color: 'var(--text-4)', width: 20 }}>{i + 2}.</span>
							<span className="dot" style={{ background: p.color }} />
							<span style={{ flex: 1 }}>{p.username}</span>
							<span className="mono" style={{ color: 'var(--text-3)' }}>
								{p.bankrupt ? 'Bankrupt' : `$${p.cash.toLocaleString()}`}
							</span>
						</div>
					))}
				</div>

				<button
					className="btn primary lg"
					onClick={onLeave}
					style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}
				>
					<LogOut size={16} /> Back to home
				</button>
			</div>
		</div>
	);
}
