import React from 'react';
import { Dice5, ShoppingCart, X, Check, Gavel, Coins, Key } from 'lucide-react';

// Richup-style gradient action buttons in the board center.
export default function ActionBar({ room, me, isMyTurn, act }) {
	if (!room || !me) return null;

	const phase = room.turnPhase;
	const def = room.board.tiles[me.position];
	const price = def?.price;

	const actions = [];

	if (me.inJail && isMyTurn && phase === 'awaiting-roll') {
		actions.push({
			key: 'jail-pay',
			icon: Coins,
			label: `Pay $${room.rules.jailFine}`,
			on: () => act('jail-pay'),
		});
		if (
			(room.jailFreeLedger[me.userId]?.chance || 0) +
				(room.jailFreeLedger[me.userId]?.chest || 0) >
			0
		) {
			actions.push({
				key: 'jail-card',
				icon: Key,
				label: 'Use card',
				on: () => act('jail-card'),
			});
		}
		actions.push({
			key: 'roll',
			icon: Dice5,
			label: 'Roll for doubles',
			primary: true,
			on: () => act('roll'),
		});
	} else if (isMyTurn && (phase === 'awaiting-roll' || phase === 'rolling')) {
		actions.push({
			key: 'roll',
			icon: Dice5,
			label: 'Roll dice',
			primary: true,
			on: () => act('roll'),
		});
	} else if (isMyTurn && phase === 'buying') {
		actions.push({
			key: 'buy',
			icon: ShoppingCart,
			label: `Buy ${def?.name} — $${price}`,
			primary: true,
			disabled: me.cash < (price || 0),
			on: () => act('buy'),
		});
		actions.push({
			key: 'skip',
			icon: room.rules.auctionUnbought ? Gavel : X,
			label: room.rules.auctionUnbought ? 'Auction' : 'Decline',
			on: () => act('decline-buy'),
		});
	} else if (isMyTurn && phase === 'awaiting-end-turn') {
		actions.push({
			key: 'end',
			icon: Check,
			label: 'End turn',
			primary: true,
			on: () => act('end-turn'),
		});
	} else if (phase === 'resolving' && isMyTurn) {
		actions.push({
			key: 'bankrupt',
			icon: X,
			label: 'Declare bankruptcy',
			danger: true,
			on: () => act('bankrupt', {}),
		});
	}

	const status = (() => {
		if (room.ended) return 'Game over';
		if (phase === 'auctioning') return 'Auction in progress…';
		if (phase === 'trading') return 'Trade negotiation…';
		if (isMyTurn) return phase === 'buying' ? 'Your decision' : 'Your turn';
		const active = room.players[room.turnIndex];
		return `Waiting for ${active?.username}…`;
	})();

	return (
		<div className="board-action-bar">
			<div className="board-action-buttons">
				{actions.map((a) => (
					<button
						key={a.key}
						className={`board-btn${a.primary ? ' primary' : ''}${a.danger ? ' danger' : ''}`}
						disabled={a.disabled}
						onClick={a.on}
					>
						{a.icon && <a.icon size={14} />}
						{a.label}
					</button>
				))}
			</div>
			<div className="board-turn-status">{status}</div>
		</div>
	);
}
