import React, { useEffect, useMemo, useState } from 'react';
import { Handshake, Send, X, Check, Eye } from 'lucide-react';
import { flagUrl } from '../../flagUtils.js';

// Two-sided editor with a read-only "peek" mode for non-party observers.
// Each side picks properties + cash + jail cards. Edits bump the server's
// trade.version and both sides re-accept to confirm execution.
export default function TradeModal({ room, me, counterpartyUserId, existingTrade, onClose, act }) {
	const iAmParty =
		!existingTrade ||
		existingTrade.fromUserId === me.userId ||
		existingTrade.toUserId === me.userId;
	const peek = !iAmParty;

	// Figure out "my" side + "their" side based on whose perspective we're in.
	// For peek mode we pick the proposer as "from" and the recipient as "to".
	const fromId = existingTrade?.fromUserId || me.userId;
	const toId = existingTrade?.toUserId || counterpartyUserId;

	const myId = peek ? fromId : me.userId;
	const theirId = peek
		? toId
		: existingTrade
			? existingTrade.fromUserId === me.userId
				? existingTrade.toUserId
				: existingTrade.fromUserId
			: counterpartyUserId;

	const mine = room.players.find((p) => p.userId === myId);
	const them = room.players.find((p) => p.userId === theirId);

	const [offer, setOffer] = useState(existingTrade?.offer || empty());
	const [request, setRequest] = useState(existingTrade?.request || empty());
	const [msg, setMsg] = useState('');

	// Sync state when the existing trade changes (e.g. counterparty updates).
	useEffect(() => {
		if (!existingTrade) return;
		const iAmSender = existingTrade.fromUserId === myId;
		const t = setTimeout(() => {
			setOffer(iAmSender ? existingTrade.offer : existingTrade.request);
			setRequest(iAmSender ? existingTrade.request : existingTrade.offer);
		});
		return () => clearTimeout(t);
	}, [existingTrade, myId]);

	const myProps = useMemo(
		() => (mine?.owned || []).map((pos) => ({ pos, def: room.board.tiles[pos] })),
		[mine, room],
	);
	const theirProps = useMemo(
		() => (them?.owned || []).map((pos) => ({ pos, def: room.board.tiles[pos] })),
		[them, room],
	);

	function toggleProp(side, pos) {
		if (readOnly) return;
		const bucket = side === 'mine' ? offer : request;
		const set = bucket.properties.includes(pos)
			? bucket.properties.filter((p) => p !== pos)
			: [...bucket.properties, pos];
		const next = { ...bucket, properties: set };
		side === 'mine' ? setOffer(next) : setRequest(next);
	}

	function submit() {
		const iAmSender = !existingTrade || existingTrade.fromUserId === me.userId;
		const body = iAmSender
			? { toUserId: counterpartyUserId, offer, request }
			: { tradeId: existingTrade.id, offer: request, request: offer };
		if (!existingTrade) act('trade-propose', body);
		else act('trade-update', body);
	}

	const isOpen = existingTrade?.status === 'open';
	const readOnly = peek || (!!existingTrade && !isOpen);
	const iAccepted = existingTrade?.acceptedBy?.includes(me.userId);
	const theyAccepted = existingTrade?.acceptedBy?.includes(theirId);
	const iAmProposer = existingTrade?.fromUserId === me.userId;

	return (
		<div onClick={onClose} className="modal-backdrop" style={{ zIndex: 90 }}>
			<div
				onClick={(e) => e.stopPropagation()}
				className="modal-panel fade-in"
				style={{
					width: 'min(95vw, 780px)',
					maxHeight: '92vh',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				<div className="modal-header">
					{peek ? (
						<Eye size={18} color="var(--text-3)" />
					) : (
						<Handshake size={18} color="var(--trade)" />
					)}
					<div className="modal-title">
						{peek ? 'Viewing trade' : `Trade with ${them?.username}`}
					</div>
					{peek && (
						<span className="chip" style={{ fontSize: 11 }}>
							{mine?.username} ↔ {them?.username}
						</span>
					)}
					<div style={{ flex: 1 }} />
					<button
						className="btn sm icon ghost"
						onClick={onClose}
						aria-label="Close trade"
					>
						<X size={14} />
					</button>
				</div>

				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
						gap: 16,
						padding: 16,
						overflow: 'auto',
						flex: 1,
					}}
				>
					<Side
						title={`${mine?.username} gives`}
						bundle={offer}
						props={myProps}
						onToggle={(p) => toggleProp('mine', p)}
						onCash={(v) => !readOnly && setOffer((o) => ({ ...o, cash: v }))}
						cashLimit={mine?.cash || 0}
						readOnly={readOnly}
					/>
					<Side
						title={`${them?.username} gives`}
						bundle={request}
						props={theirProps}
						onToggle={(p) => toggleProp('their', p)}
						onCash={(v) => !readOnly && setRequest((o) => ({ ...o, cash: v }))}
						cashLimit={them?.cash || 0}
						readOnly={readOnly}
					/>
				</div>

				{existingTrade && (
					<div
						style={{
							padding: '8px 16px',
							borderTop: '1px solid var(--border)',
							display: 'flex',
							gap: 10,
							alignItems: 'center',
							fontSize: 12,
							color: 'var(--text-2)',
							flexWrap: 'wrap',
						}}
					>
						{isOpen ? (
							<>
								<span>
									{mine?.username}:{' '}
									{iAccepted ? (
										<b style={{ color: 'var(--success)' }}>Accepted</b>
									) : (
										'Pending'
									)}
								</span>
								<span>·</span>
								<span>
									{them?.username}:{' '}
									{theyAccepted ? (
										<b style={{ color: 'var(--success)' }}>Accepted</b>
									) : (
										'Pending'
									)}
								</span>
							</>
						) : (
							<span style={{ fontWeight: 700 }}>
								{existingTrade.status === 'accepted'
									? '✓ Trade completed'
									: existingTrade.status === 'cancelled'
										? '✕ Trade cancelled'
										: existingTrade.status === 'rejected'
											? '✕ Trade rejected'
											: `Trade ${existingTrade.status}`}
							</span>
						)}
						<div style={{ flex: 1 }} />
						{isOpen && (
							<span style={{ color: 'var(--text-3)' }}>v{existingTrade.version}</span>
						)}
					</div>
				)}

				{existingTrade && !peek && isOpen && (
					<div
						style={{
							padding: '8px 16px',
							borderTop: '1px solid var(--border)',
							display: 'flex',
							gap: 6,
						}}
					>
						<input
							placeholder="Message…"
							style={{ flex: 1, fontSize: 13 }}
							value={msg}
							onChange={(e) => setMsg(e.target.value.slice(0, 300))}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && msg.trim()) {
									act('trade-msg', {
										tradeId: existingTrade.id,
										text: msg.trim(),
									});
									setMsg('');
								}
							}}
						/>
					</div>
				)}

				{!peek && (
					<div
						style={{
							padding: 14,
							borderTop: '1px solid var(--border)',
							display: 'flex',
							gap: 8,
							flexWrap: 'wrap',
						}}
					>
						{!existingTrade && (
							<button className="btn trade" onClick={submit}>
								<Send size={14} /> Send proposal
							</button>
						)}
						{existingTrade && isOpen && (
							<>
								<button className="btn trade" onClick={submit}>
									<Send size={14} /> Update offer
								</button>
								<button
									className="btn success"
									disabled={iAccepted}
									onClick={() =>
										act('trade-accept', { tradeId: existingTrade.id })
									}
								>
									<Check size={14} /> Accept
								</button>
								<button
									className="btn danger"
									onClick={() => {
										act('trade-reject', { tradeId: existingTrade.id });
										onClose();
									}}
								>
									<X size={14} /> {iAmProposer ? 'Cancel trade' : 'Reject'}
								</button>
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function empty() {
	return { cash: 0, properties: [], jailCards: { chance: 0, chest: 0 } };
}

function Side({ title, bundle, props, onToggle, onCash, cashLimit, readOnly }) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
			<div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-2)' }}>{title}</div>

			<div>
				<div
					style={{
						fontSize: 11,
						color: 'var(--text-3)',
						marginBottom: 4,
						display: 'flex',
						justifyContent: 'space-between',
						textTransform: 'uppercase',
						fontWeight: 800,
					}}
				>
					<span>Cash</span>
					<span className="mono" style={{ color: 'var(--text-2)' }}>
						max ${cashLimit.toLocaleString()}
					</span>
				</div>
				<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
					<input
						type="number"
						min={0}
						max={cashLimit}
						value={bundle.cash}
						disabled={readOnly}
						aria-label={`${title} cash amount`}
						onChange={(e) =>
							onCash(Math.max(0, Math.min(cashLimit, Number(e.target.value || 0))))
						}
						style={{
							width: 96,
							fontFamily: 'var(--font-mono)',
							fontSize: 15,
							fontWeight: 700,
						}}
					/>
					<input
						type="range"
						min={0}
						max={cashLimit || 0}
						step={10}
						value={bundle.cash}
						disabled={readOnly || cashLimit === 0}
						aria-label={`${title} cash slider`}
						onChange={(e) => onCash(Number(e.target.value))}
						style={{ flex: 1, accentColor: 'var(--trade)' }}
					/>
				</div>
				{!readOnly && cashLimit > 0 && (
					<div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
						{[0, 0.25, 0.5, 0.75, 1].map((f) => (
							<button
								key={f}
								className="btn sm ghost"
								onClick={() => onCash(Math.floor(cashLimit * f))}
								style={{
									flex: 1,
									justifyContent: 'center',
									fontSize: 10,
									padding: '3px 0',
								}}
							>
								{f === 0 ? '0' : f === 1 ? 'All' : `${Math.round(f * 100)}%`}
							</button>
						))}
					</div>
				)}
			</div>

			<div
				style={{
					fontSize: 11,
					color: 'var(--text-3)',
					marginTop: 6,
					marginBottom: 2,
					textTransform: 'uppercase',
					fontWeight: 800,
				}}
			>
				Properties
			</div>
			<div
				style={{
					maxHeight: 260,
					overflowY: 'auto',
					display: 'flex',
					flexDirection: 'column',
					gap: 4,
				}}
			>
				{props.length === 0 && (
					<div style={{ fontSize: 12, color: 'var(--text-4)' }}>No properties.</div>
				)}
				{props.map(({ pos, def }) => {
					const on = bundle.properties.includes(pos);
					return (
						<button
							key={pos}
							className="btn sm"
							onClick={() => !readOnly && onToggle(pos)}
							disabled={readOnly}
							style={{
								justifyContent: 'flex-start',
								background: on ? 'var(--trade-soft)' : 'var(--surface-2)',
								borderColor: on ? 'var(--trade)' : 'var(--border)',
								opacity: readOnly && !on ? 0.55 : 1,
							}}
						>
							{def.color && (
								<span
									className="dot"
									style={{ background: def.color, width: 10, height: 10 }}
								/>
							)}
							{def.type === 'property' && flagUrl(def.name) && (
								<img
									src={flagUrl(def.name)}
									alt=""
									style={{
										width: 18,
										height: 18,
										borderRadius: '50%',
										objectFit: 'cover',
										flexShrink: 0,
										border: '1px solid rgba(255,255,255,0.15)',
									}}
								/>
							)}
							<span style={{ fontSize: 12, fontWeight: 600 }}>{def.name}</span>
							<span style={{ flex: 1 }} />
							<span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
								#{pos}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
