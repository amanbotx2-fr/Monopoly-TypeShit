import React, { useEffect, useState } from 'react';
import { Gavel, X } from 'lucide-react';
import { tileIcon } from '../../flagUtils.js';

export default function AuctionModal({ room, me, act }) {
	const a = room.auction;
	const minimumBid = a ? a.currentBid + a.minIncrement : 0;
	const [bid, setBid] = useState(minimumBid);
	const [secLeft, setSecLeft] = useState(8);
	const effectiveBid = Math.max(bid, minimumBid);
	useEffect(() => {
		if (!a) return;
		const t = setInterval(() => {
			setSecLeft(Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000)));
		}, 200);
		return () => clearInterval(t);
	}, [a]);

	if (!a || !me) return null;

	const def = room.board.tiles[a.pos];
	const inAuction = a.participants.includes(me.userId);
	const passed = a.passed.includes(me.userId);
	const topBidder = a.currentBidder === me.userId;
	const canBid = inAuction && !passed && !topBidder && me.cash >= effectiveBid;

	return (
		<div className="modal-backdrop" style={{ zIndex: 80 }}>
			<div
				className="modal-panel fade-in"
				style={{
					width: 'min(100%, 460px)',
					background: 'var(--surface)',
				}}
			>
				<div style={{ background: def.color || 'var(--auction)', height: 5 }} />
				<div style={{ padding: 24 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<Gavel size={20} color="var(--warning)" />
					{tileIcon(def) && (
						<img
							src={tileIcon(def)}
							alt=""
							style={{
								width: 24,
								height: 24,
								borderRadius: def.type === 'property' ? '50%' : 4,
								objectFit: 'cover',
								flexShrink: 0,
								border: def.type === 'property' ? '1px solid rgba(255,255,255,0.15)' : 'none',
							}}
						/>
					)}
					<div style={{ fontSize: 20, fontWeight: 800 }}>Auction: {def.name}</div>
						<div style={{ flex: 1 }} />
						<div
							className="chip mono"
							style={{
								color: secLeft < 3 ? 'var(--danger)' : 'var(--text-2)',
								fontSize: 13,
								fontWeight: 700,
							}}
						>
							{secLeft}s
						</div>
					</div>

					<div
						className="metric-grid"
						style={{ gridTemplateColumns: '1fr 1fr', marginTop: 20 }}
					>
						<div className="metric">
							<div className="metric-label">List price</div>
							<div className="metric-value mono">${def.price}</div>
						</div>
						<div className="metric">
							<div className="metric-label">Top bid</div>
							<div className="money metric-value">
								${a.currentBid || 0}
								{a.currentBidder && (
									<span
										style={{
											fontSize: 11,
											color: 'var(--text-3)',
											marginLeft: 6,
											fontWeight: 600,
										}}
									>
										by{' '}
										{
											room.players.find((p) => p.userId === a.currentBidder)
												?.username
										}
									</span>
								)}
							</div>
						</div>
					</div>

					{inAuction && !passed && !topBidder && (
						<div
							style={{ marginTop: 20, display: 'flex', gap: 8, alignItems: 'center' }}
						>
							<button
								className="btn sm"
								onClick={() =>
									setBid((b) => Math.max(a.currentBid + a.minIncrement, b - 10))
								}
							>
								−10
							</button>
							<input
								type="number"
								style={{
									flex: 1,
									fontFamily: 'var(--font-mono)',
									fontSize: 18,
									fontWeight: 700,
									textAlign: 'center',
								}}
								min={a.currentBid + a.minIncrement}
								aria-label="Auction bid amount"
								value={bid}
								onChange={(e) => setBid(Number(e.target.value))}
							/>
							<button className="btn sm" onClick={() => setBid((b) => b + 10)}>
								+10
							</button>
							<button className="btn sm" onClick={() => setBid((b) => b + 50)}>
								+50
							</button>
						</div>
					)}

					<div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
						<button
							className="btn auction"
							style={{ flex: 1, justifyContent: 'center' }}
							disabled={!canBid}
							onClick={() => act('auction-bid', { amount: effectiveBid })}
						>
							Bid ${effectiveBid}
						</button>
						<button
							className="btn"
							disabled={!inAuction || passed}
							onClick={() => act('auction-pass')}
						>
							<X size={14} /> Pass
						</button>
					</div>

					<div style={{ marginTop: 18, fontSize: 12, color: 'var(--text-3)' }}>
						Participants:{' '}
						{a.participants.map((uid) => {
							const p = room.players.find((x) => x.userId === uid);
							const pass = a.passed.includes(uid);
							return p ? (
								<span
									key={uid}
									style={{
										color: pass ? 'var(--text-4)' : p.color,
										textDecoration: pass ? 'line-through' : 'none',
										marginRight: 8,
										fontWeight: 600,
									}}
								>
									{p.username}
								</span>
							) : null;
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
