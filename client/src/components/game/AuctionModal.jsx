import React, { useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';
import { tileIcon } from '../../flagUtils.js';

// Matches server IDLE_TIMEOUT_MS — each bid resets the clock to this duration.
const TOTAL_AUCTION_MS = 8000;

export default function AuctionModal({ room, me, act }) {
	const a = room.auction;
	const minimumBid = a ? a.currentBid + a.minIncrement : 0;
	const [secLeft, setSecLeft] = useState(8);
	const [progressPct, setProgressPct] = useState(100);
	const [customBid, setCustomBid] = useState(minimumBid);

	// Keep custom-bid input in sync when the minimum changes.
	useEffect(() => {
		setCustomBid((prev) => Math.max(prev, minimumBid));
	}, [minimumBid]);

	// Tick the countdown and progress bar.
	useEffect(() => {
		if (!a) return;
		const t = setInterval(() => {
			const remaining = Math.max(0, a.endsAt - Date.now());
			setSecLeft(Math.ceil(remaining / 1000));
			setProgressPct(Math.max(0, Math.min(100, (remaining / TOTAL_AUCTION_MS) * 100)));
		}, 200);
		return () => clearInterval(t);
	}, [a]);

	if (!a || !me) return null;

	const def = room.board.tiles[a.pos];
	const icon = tileIcon(def);
	const inAuction = a.participants.includes(me.userId);
	const passed = a.passed.includes(me.userId);
	const topBidder = a.currentBidder === me.userId;
	const effectiveBid = Math.max(minimumBid, a.currentBid + a.minIncrement);
	const canBid = inAuction && !passed && !topBidder && me.cash >= effectiveBid;

	const topBidderPlayer = a.currentBidder
		? room.players.find((p) => p.userId === a.currentBidder)
		: null;
	// Bar color: bidder's player color when someone has bid, default auction color otherwise.
	const barColor = topBidderPlayer?.color || 'var(--auction)';

	// Quick-bid buttons — the current bid + a small / medium / large bump.
	const quickBids = [
		{ amount: a.currentBid + a.minIncrement, delta: `+$${a.minIncrement}` },
		{ amount: a.currentBid + a.minIncrement + 10, delta: '+$10' },
		{ amount: a.currentBid + a.minIncrement + 100, delta: '+$100' },
	].filter((b) => me.cash >= b.amount && b.amount >= minimumBid);

	// Bid history, newest on top.
	const history = [...(a.history || [])].reverse();

	return (
		<div className="modal-backdrop" style={{ zIndex: 80 }}>
			<div className="modal-panel auction-modal fade-in" style={{ maxHeight: '95vh' }}>
				{/* ── Title ── */}
				<div className="auction-title">Auction</div>

				{/* ── Tile name + icon ── */}
				<div className="auction-tile-header">
					{icon && <img src={icon} alt="" className="auction-tile-icon" />}
					<span className="auction-tile-name">{def.name}</span>
				</div>

				{/* ── Current bid + progress bar ── */}
				<div className="auction-main">
					<div className="auction-bid-section">
						<span className="auction-section-label">Current bid</span>
						<div className="auction-bid-row">
							{topBidderPlayer && (
								<div className="auction-bidder-icon">
									<PlayerTokenBadge player={topBidderPlayer} />
								</div>
							)}
							<div className="auction-bid-value">
								{a.currentBid > 0 ? (
									<span className="money">${a.currentBid.toLocaleString()}</span>
								) : (
									<span className="money">$0</span>
								)}
							</div>
						</div>
					</div>
					<div className="auction-timer-section">
						<span className="auction-timer-label">
							Sold&nbsp;in&nbsp;{secLeft}...{' '}
							<Gavel size={12} style={{ display: 'inline-block' }} />
						</span>
						<div className="auction-progress-track">
							<div
								className="auction-progress-fill"
								style={{
									width: `${progressPct}%`,
									backgroundColor: barColor,
								}}
							/>
							<div
								className="auction-progress-glow"
								style={{
									width: `${progressPct}%`,
									color: barColor,
								}}
							/>
						</div>
					</div>
				</div>

				{/* ── Bid buttons (only for eligible participants) ── */}
				{inAuction && !passed && !topBidder && (
					<div className="auction-bid-area">
						<span className="auction-section-label">I&rsquo;m bidding...</span>
						<div className="auction-quick-bids">
							{quickBids.map((qb) => (
								<button
									key={qb.amount}
									className="btn auction-quick-btn"
									onClick={() => act('auction-bid', { amount: qb.amount })}
								>
									<span className="auction-quick-amount">
										${qb.amount.toLocaleString()}
									</span>
									<span className="auction-quick-delta">{qb.delta}</span>
								</button>
							))}
						</div>
						<div className="auction-custom-row">
							<input
								type="number"
								className="input auction-custom-input"
								min={minimumBid}
								step={a.minIncrement}
								value={customBid}
								onChange={(e) => setCustomBid(Number(e.target.value))}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && customBid >= minimumBid)
										act('auction-bid', { amount: customBid });
								}}
								aria-label="Custom bid amount"
							/>
							<button
								className="btn auction-custom-submit"
								disabled={!canBid || customBid < minimumBid}
								onClick={() => act('auction-bid', { amount: customBid })}
							>
								Bid ${customBid.toLocaleString()}
							</button>
						</div>
					</div>
				)}

				{/* ── Pass / status row ── */}
				<div className="auction-status-row">
					{inAuction && !passed && !topBidder && (
						<button
							className="btn ghost auction-pass-btn"
							onClick={() => act('auction-pass')}
						>
							Pass
						</button>
					)}
					{passed && (
						<span className="auction-status-text" style={{ color: 'var(--text-4)' }}>
							You passed
						</span>
					)}
					{topBidder && (
						<span className="auction-status-text" style={{ color: 'var(--success)' }}>
							You&rsquo;re winning
						</span>
					)}
					{!inAuction && (
						<span className="auction-status-text" style={{ color: 'var(--text-4)' }}>
							Spectating
						</span>
					)}
				</div>

				{/* ── Bid history ── */}
				{history.length > 0 && (
					<div className="auction-history">
						<div className="auction-history-scroll">
							{history.map((h, i) => {
								const p = room.players.find((x) => x.userId === h.userId);
								if (!p) return null;
								const isLatest = i === 0;
								return (
									<div
										key={`${h.userId}-${h.ts}`}
										className={`auction-history-row${isLatest ? ' auction-history-latest' : ''}`}
									>
										<span className="auction-history-player">
											<span
												className="auction-history-dot"
												style={{ background: p.color }}
											/>
											<span
												style={{
													color: p.color,
													fontWeight: isLatest ? 700 : 500,
												}}
											>
												{p.username}
											</span>
										</span>
										{' bids '}
										<span className="money">${h.amount.toLocaleString()}</span>
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* ── Sticky property info card ── */}
				<div className="auction-property-card">
					<div className="auction-property-name">
						{icon && <img src={icon} alt="" className="auction-pc-icon" />}
						{def.name}
					</div>
					<PropertyRentInfo def={def} />
					<div className="auction-property-price-row">
						<span className="auction-property-price-label">Price</span>
						<span className="money auction-property-price-value">
							${def.price.toLocaleString()}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

/* ─── Player token badge — matches board token style (colored circle + initial) ── */

function PlayerTokenBadge({ player }) {
	const initial = (player.username || '?').trim()[0]?.toUpperCase() || '?';
	const isLight = ['#FFFFFF', '#FACC15', '#FEF200'].includes(player.color?.toUpperCase());
	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				borderRadius: '50%',
				background: player.color,
				color: isLight ? '#10130f' : 'var(--text)',
				textShadow: isLight ? 'none' : '0 1px 2px rgba(0,0,0,0.7)',
				display: 'grid',
				placeItems: 'center',
				fontSize: '1.2rem',
				fontWeight: 850,
				boxShadow: '0 0 0 2px rgba(0,0,0,0.3), 0 3px 10px rgba(0,0,0,0.26)',
			}}
		>
			{initial}
		</div>
	);
}

/* ─── Property rent info (varies by tile type) ──────────────────────────── */

function PropertyRentInfo({ def }) {
	if (!def) return null;
	if (def.type === 'property') {
		const rent = def.rent || [];
		return (
			<div className="auction-rent-table">
				<div className="auction-rent-header">
					<span>Houses</span>
					<span>Rent</span>
				</div>
				{rent.map((r, i) => (
					<div key={i} className="auction-rent-row">
						<span>
							{i === 0 ? 'Site' : i >= 5 ? 'Hotel' : `${i} house${i > 1 ? 's' : ''}`}
						</span>
						<span className="money">${r.toLocaleString()}</span>
					</div>
				))}
			</div>
		);
	}
	if (def.type === 'station') {
		return (
			<div className="auction-rent-table">
				<div className="auction-rent-header">
					<span>Owned</span>
					<span>Rent</span>
				</div>
				{[1, 2, 3, 4].map((n) => (
					<div key={n} className="auction-rent-row">
						<span>
							{n} station{n > 1 ? 's' : ''}
						</span>
						<span className="money">${n * 25}</span>
					</div>
				))}
			</div>
		);
	}
	if (def.type === 'utility') {
		return (
			<div className="auction-rent-table">
				<div className="auction-rent-row">
					<span>1 owned</span>
					<span className="money">×4</span>
				</div>
				<div className="auction-rent-row">
					<span>2 owned</span>
					<span className="money">×10</span>
				</div>
			</div>
		);
	}
	return null;
}
