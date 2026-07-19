import React, { useEffect, useRef } from 'react';

// Renders a formatted event history. Log entries have `kind` + varying payload;
// we translate each into a short human string with player colors. Tile names
// are looked up from the board so the log says "Paris" not "#34".
//
// `onTradeClick(tradeId)` is called when the user clicks a trade-related log
// entry, opening that trade for viewing (even after it's completed/closed).
//
// `variant`:
//   - "board"  — compact, dark, for the board center (handles its own styling)
//   - default  — card-style, for sidebars/drawers
//
// Performance: uses event delegation (single click handler on the scroll
// container) and CSS hover instead of per-row JS handlers, so it stays
// cheap even with hundreds of log entries.
export default function ActionLog({ log, players, tiles, onTradeClick, variant }) {
	const ref = useRef(null);
	const isBoard = variant === 'board';

	useEffect(() => {
		if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
	}, [log?.length]);

	const nameOf = (uid) => {
		const p = players.find((x) => x.userId === uid);
		return p ? (
			<span style={{ color: p.color, fontWeight: 700 }}>{p.username}</span>
		) : (
			'someone'
		);
	};
	const tile = (pos) => {
		const t = tiles?.[pos];
		if (!t) return `#${pos}`;
		return <b style={{ color: t.color || 'var(--text)' }}>{t.name}</b>;
	};

	// Single delegated click handler — reads data-trade-id from the clicked
	// row instead of attaching per-row onClick.
	function handleContainerClick(e) {
		if (!onTradeClick) return;
		const row = e.target.closest('[data-trade-id]');
		if (!row) return;
		const id = row.getAttribute('data-trade-id');
		if (id) onTradeClick(id);
	}

	const baseStyle = isBoard
		? {
				flex: 1,
				width: '75%',
				minHeight: 0,
				overflowY: 'auto',
				fontSize: 'clamp(8px, 1.3cqi, 11px)',
				lineHeight: 1.45,
				color: '#b0a8cc',
				display: 'flex',
				flexDirection: 'column',
				gap: 3,
				padding: '6px clamp(4px, 2cqi, 12px)',
				background: 'rgba(0, 0, 0, 0.18)',
				borderRadius: '0.5em',
				border: '1px solid rgba(255, 255, 255, 0.05)',
			}
		: {
				flex: 1,
				overflowY: 'auto',
				padding: 12,
				display: 'flex',
				flexDirection: 'column',
				gap: 4,
				fontSize: 12,
				lineHeight: 1.55,
				color: 'var(--text-2)',
				minHeight: 0,
			};

	return (
		<div
			className={isBoard ? undefined : 'card'}
			ref={ref}
			onClick={handleContainerClick}
			style={baseStyle}
		>
			{(!log || log.length === 0) && (
				<div style={{ color: 'var(--text-4)', textAlign: 'center', paddingTop: 16 }}>
					Nothing happened yet.
				</div>
			)}
			{log?.map((e) => (
				<LogRow key={e.id} e={e} nameOf={nameOf} tile={tile} />
			))}
		</div>
	);
}

function LogRow({ e, nameOf, tile }) {
	// Trade entries get a data attribute and CSS hover class so the parent can
	// use event delegation instead of per-row onClick handlers.
	const isTradeEntry =
		e.kind === 'trade-open' ||
		e.kind === 'trade-update' ||
		e.kind === 'trade-executed' ||
		e.kind === 'trade-close';

	let body = null;
	switch (e.kind) {
		case 'game-start':
			body = <em style={{ color: 'var(--text-3)' }}>Game started.</em>;
			break;
		case 'turn-start':
			body = (
				<div
					style={{
						color: 'var(--text-3)',
						marginTop: 4,
						borderTop: '1px dashed var(--border)',
						paddingTop: 4,
					}}
				>
					— {nameOf(e.userId)}&rsquo;s turn
				</div>
			);
			break;
		case 'roll':
			body = (
				<>
					{nameOf(e.userId)} rolled{' '}
					<b className="mono">
						{e.dice[0]} + {e.dice[1]} = {e.dice[0] + e.dice[1]}
					</b>
					{e.isDouble && (
						<span style={{ color: 'var(--warning)', fontWeight: 700 }}>
							{' '}
							· doubles!
						</span>
					)}
				</>
			);
			break;
		case 'land':
			body = (
				<>
					{nameOf(e.userId)} landed on {tile(e.pos)}
				</>
			);
			break;
		case 'pass-go':
			body = (
				<>
					{nameOf(e.userId)} passed GO, collected{' '}
					<span className="money">${e.amount}</span>
				</>
			);
			break;
		case 'buy':
			body = (
				<>
					{nameOf(e.userId)} bought {tile(e.pos)} for{' '}
					<span className="money">${e.price}</span>
				</>
			);
			break;
		case 'rent':
			body = (
				<>
					{nameOf(e.fromUserId)} paid {nameOf(e.toUserId)}{' '}
					<span className="money">${e.amount}</span> rent
				</>
			);
			break;
		case 'tax':
			body = (
				<>
					{nameOf(e.userId)} paid tax <span className="money">${e.amount}</span>
				</>
			);
			break;
		case 'go-to-jail':
			body = <>{nameOf(e.userId)} went to Jail</>;
			break;
		case 'jail-pay':
			body = <>{nameOf(e.userId)} paid to leave jail</>;
			break;
		case 'jail-card':
			body = <>{nameOf(e.userId)} used a Get Out of Jail Free card</>;
			break;
		case 'parking-payout':
			body = (
				<>
					{nameOf(e.userId)} collected <span className="money">${e.amount}</span> from the
					pot
				</>
			);
			break;
		case 'mortgage':
			body = (
				<>
					{nameOf(e.userId)} mortgaged {tile(e.pos)} for{' '}
					<span className="money">${e.amount}</span>
				</>
			);
			break;
		case 'unmortgage':
			body = (
				<>
					{nameOf(e.userId)} unmortgaged {tile(e.pos)} (
					<span className="money">-${e.amount}</span>)
				</>
			);
			break;
		case 'build':
			body = (
				<>
					{nameOf(e.userId)} built on {tile(e.pos)} (
					{e.houses >= 5 ? 'hotel' : e.houses + ' house' + (e.houses === 1 ? '' : 's')})
				</>
			);
			break;
		case 'sell-house':
			body = (
				<>
					{nameOf(e.userId)} sold a building on {tile(e.pos)}
				</>
			);
			break;
		case 'card':
			body = (
				<>
					{nameOf(e.userId)} drew{' '}
					<i
						style={{
							color: e.deck === 'chance' ? 'var(--warning)' : 'var(--accent-2)',
						}}
					>
						{e.deck}
					</i>
					: {e.text}
				</>
			);
			break;
		case 'auction-start':
			body = (
				<>
					Auction: <b>{e.name}</b>
				</>
			);
			break;
		case 'auction-end':
			body = e.winnerId ? (
				<>
					{nameOf(e.winnerId)} won the auction for{' '}
					<span className="money">${e.price}</span>
				</>
			) : (
				<>Auction ended with no bids.</>
			);
			break;
		case 'trade-open':
			body = (
				<>
					{nameOf(e.fromUserId)} proposed <span className="trade-clickable">a trade</span>{' '}
					to {nameOf(e.toUserId)}
				</>
			);
			break;
		case 'trade-update':
			body = (
				<>
					<span className="trade-clickable">Trade</span> revised.
				</>
			);
			break;
		case 'trade-executed':
			body = (
				<>
					<b style={{ color: 'var(--success)' }}>
						<span className="trade-clickable">Trade completed.</span>
					</b>
				</>
			);
			break;
		case 'trade-close':
			body = (
				<>
					<span className="trade-clickable">Trade</span> {e.status}.
				</>
			);
			break;
		case 'bankrupt':
			body = (
				<>
					<span style={{ color: 'var(--danger)', fontWeight: 700 }}>
						{nameOf(e.userId)} went bankrupt
					</span>
					{e.creditor ? <> to {nameOf(e.creditor)}</> : ''}.
				</>
			);
			break;
		case 'victory':
			body = (
				<>
					<b style={{ color: 'var(--success)' }}>{nameOf(e.userId)} wins.</b>
				</>
			);
			break;
		default:
			body = <em style={{ color: 'var(--text-4)' }}>{e.kind}</em>;
	}

	const attrs = isTradeEntry ? { 'data-trade-id': e.tradeId, className: 'trade-row' } : {};
	return <div {...attrs}>{body}</div>;
}
