import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useRoom from '../../useRoom';
import useIsMobile from '../../useIsMobile';
import Board from './Board';
import PlayerPanel from './PlayerPanel';
import PlayerStrip from './PlayerStrip';
import ChatPanel from './ChatPanel';
import TradesPanel from './TradesPanel';
import LogDrawer from './LogDrawer';
import ActionLog from './ActionLog';
import CardModal from './CardModal';
import AuctionModal from './AuctionModal';
import TradeModal from './TradeModal';
import PropertyModal from './PropertyModal';
import SoundToggle from './SoundToggle';
import Victory from './Victory';
import BrandLogo from '../common/BrandLogo';
import { LogOut, Copy, ScrollText } from 'lucide-react';

const DESKTOP_GAME_PADDING = 16;
const DESKTOP_PANEL_BORDER_WIDTH = 1;
const DESKTOP_PANEL_BORDER = `${DESKTOP_PANEL_BORDER_WIDTH}px solid var(--border)`;
const BOARD_STAGE_PADDING = 12;
const DESKTOP_BOARD_VIEWPORT_OFFSET =
	DESKTOP_GAME_PADDING * 2 + DESKTOP_PANEL_BORDER_WIDTH * 2 + BOARD_STAGE_PADDING * 2;
const DESKTOP_BOARD_MAX_SIZE = `calc(100vh - ${DESKTOP_BOARD_VIEWPORT_OFFSET}px)`;

function isAnimatedMoveEvent(event) {
	return (
		event?.type === 'move' &&
		event.animate !== false &&
		Array.isArray(event.path) &&
		event.path.length > 0
	);
}

function appendMissing(existing, incoming) {
	let next = existing;
	for (const key of incoming) {
		if (!key || next.includes(key)) continue;
		if (next === existing) next = existing.slice();
		next.push(key);
	}
	return next;
}

export default function Game({ userId, pushToast }) {
	const nav = useNavigate();
	const isMobile = useIsMobile();
	const { roomCode, room, events, chat, connected, act, sendChat } = useRoom({ userId });

	const [hoveredPlayer, setHoveredPlayer] = useState(null);
	const [tradeWith, setTradeWith] = useState(null);
	const [peekTradeId, setPeekTradeId] = useState(null);
	const [openPropertyPos, setOpenPropertyPos] = useState(null);
	const [drawnCard, setDrawnCard] = useState(null);
	const handleTradeClick = useCallback((id) => setPeekTradeId(id), []);
	const [chatOpen, setChatOpen] = useState(false);
	const [logOpen, setLogOpen] = useState(false);
	const drawCardCursorRef = useRef(null);
	const [completedAnimationKeys, setCompletedAnimationKeys] = useState({
		rolls: [],
		moves: [],
	});

	const pendingRollKeys = useMemo(
		() =>
			events
				.filter(
					(event) =>
						event.type === 'roll' && !completedAnimationKeys.rolls.includes(event._k),
				)
				.map((event) => event._k),
		[events, completedAnimationKeys.rolls],
	);
	const pendingMoveKeys = useMemo(
		() =>
			events
				.filter(
					(event) =>
						isAnimatedMoveEvent(event) &&
						!completedAnimationKeys.moves.includes(event._k),
				)
				.map((event) => event._k),
		[events, completedAnimationKeys.moves],
	);
	const diceRolling = pendingRollKeys.length > 0;
	const actionsUnlocked = pendingRollKeys.length === 0 && pendingMoveKeys.length === 0;

	const handleDiceAnimationComplete = useCallback(() => {
		if (!pendingRollKeys.length) return;
		setCompletedAnimationKeys((keys) => ({
			...keys,
			rolls: appendMissing(keys.rolls, pendingRollKeys),
		}));
	}, [pendingRollKeys]);

	const handleTokenMotionComplete = useCallback((eventKey) => {
		if (!eventKey) return;
		setCompletedAnimationKeys((keys) => {
			if (keys.moves.includes(eventKey)) return keys;
			return {
				...keys,
				moves: keys.moves.concat(eventKey),
			};
		});
	}, []);

	useEffect(() => {
		const drawn = [...events].reverse().find((e) => e.type === 'draw-card');
		if (!drawn || drawn._k === drawCardCursorRef.current) return;
		drawCardCursorRef.current = drawn._k;
		const t = setTimeout(() =>
			setDrawnCard({ deck: drawn.deck, cardId: drawn.cardId, text: drawn.text }),
		);
		return () => clearTimeout(t);
	}, [events]);

	if (!room) {
		return (
			<div className="app-page grid-bg" style={{ display: 'grid', placeItems: 'center' }}>
				<div
					className="card"
					style={{ display: 'grid', gap: 14, justifyItems: 'center', minWidth: 260 }}
				>
					<BrandLogo size={32} />
					<div className="status-line" style={{ justifyContent: 'center' }}>
						<span
							className="dot"
							style={{ background: connected ? 'var(--success)' : 'var(--warning)' }}
						/>
						{connected ? 'Loading game...' : 'Connecting...'}
					</div>
				</div>
			</div>
		);
	}

	const me = room.players.find((p) => p.userId === userId);
	const active = room.players[room.turnIndex];
	const isMyTurn = active?.userId === userId && !room.ended;
	const openTrade = peekTradeId
		? room.trades?.find((t) => t.id === peekTradeId)
		: room.trades?.find(
				(t) => t.status === 'open' && (t.fromUserId === userId || t.toUserId === userId),
			);

	function copyLink() {
		navigator.clipboard
			.writeText(`${window.location.origin}/r/${roomCode}`)
			.then(() => pushToast('Link copied', 'success'));
	}

	const modals = (
		<>
			{drawnCard && (
				<CardModal
					deck={drawnCard.deck}
					text={drawnCard.text}
					onClose={() => setDrawnCard(null)}
				/>
			)}
			{room.auction && <AuctionModal room={room} me={me} act={act} />}
			{(tradeWith || openTrade) && (
				<TradeModal
					room={room}
					me={me}
					counterpartyUserId={
						openTrade
							? openTrade.fromUserId === userId
								? openTrade.toUserId
								: openTrade.fromUserId
							: tradeWith
					}
					existingTrade={openTrade}
					onClose={() => {
						setTradeWith(null);
						setPeekTradeId(null);
					}}
					act={act}
				/>
			)}
			{openPropertyPos != null && (
				<PropertyModal
					pos={openPropertyPos}
					room={room}
					me={me}
					act={act}
					onClose={() => setOpenPropertyPos(null)}
				/>
			)}
			<TradesPanel room={room} me={me} onOpenTrade={(t) => setPeekTradeId(t.id)} />
			<ChatPanel
				chat={chat}
				sendChat={sendChat}
				me={me}
				open={chatOpen}
				onOpen={() => setChatOpen(true)}
				onClose={() => setChatOpen(false)}
			/>
			{room.ended && <Victory room={room} onLeave={() => nav('/')} />}
		</>
	);

	if (isMobile) {
		return (
			<div
				style={{
					display: 'grid',
					gridTemplateRows: 'auto auto 1fr',
					height: '100vh',
					overflow: 'hidden',
					background: 'var(--bg)',
				}}
			>
				<header
					style={{
						display: 'flex',
						gap: 6,
						alignItems: 'center',
						padding: '8px 10px',
						borderBottom: '1px solid var(--border)',
						background: 'var(--surface)',
					}}
				>
					<button className="btn ghost sm" onClick={() => nav('/')}>
						<LogOut size={13} />
					</button>
					<BrandLogo size={26} showText={false} />
					<div className="chip" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
						{roomCode}
					</div>
					<button className="btn sm ghost" onClick={copyLink}>
						<Copy size={12} />
					</button>
					<div style={{ flex: 1 }} />
					<SoundToggle />
				</header>

				<PlayerStrip
					room={room}
					me={me}
					onTrade={(uid) => setTradeWith(uid)}
					onHover={(p) => setHoveredPlayer(p)}
				/>

				<main
					style={{
						display: 'grid',
						placeItems: 'center',
						padding: 10,
						minHeight: 0,
						background: 'var(--bg)',
					}}
				>
					<div
						style={{
							width: 'min(100%, 100vw - 20px)',
							maxHeight: '100%',
							aspectRatio: '1 / 1',
						}}
					>
						<Board
							room={room}
							userId={userId}
							diceRolling={diceRolling}
							events={events}
							me={me}
							isMyTurn={isMyTurn}
							act={act}
							onTileClick={(pos) => setOpenPropertyPos(pos)}
							hoveredPlayer={hoveredPlayer}
							onHoverPlayer={setHoveredPlayer}
							onDiceAnimationComplete={handleDiceAnimationComplete}
							onTokenMotionComplete={handleTokenMotionComplete}
							actionsUnlocked={actionsUnlocked}
						/>
					</div>
				</main>

				<LogDrawer
					open={logOpen}
					onOpen={() => setLogOpen(true)}
					onClose={() => setLogOpen(false)}
					room={room}
					onTradeClick={handleTradeClick}
				/>
				{modals}
			</div>
		);
	}

	// Desktop layout
	return (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: 'minmax(270px, 310px) 1fr minmax(290px, 350px)',
				gap: 16,
				padding: DESKTOP_GAME_PADDING,
				height: '100vh',
				overflow: 'hidden',
				background: 'var(--bg)',
			}}
		>
			<aside
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 12,
					minHeight: 0,
					padding: 12,
					background: 'var(--surface)',
					border: DESKTOP_PANEL_BORDER,
					borderRadius: 'var(--radius-lg)',
				}}
			>
				<header style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<button className="btn ghost sm" onClick={() => nav('/')}>
						<LogOut size={13} />
					</button>
					<BrandLogo size={28} showText={false} />
					<div className="chip" style={{ fontFamily: 'var(--font-mono)' }}>
						{roomCode}
					</div>
					<button className="btn sm ghost" onClick={copyLink}>
						<Copy size={12} />
					</button>
					<div style={{ flex: 1 }} />
					<SoundToggle />
				</header>
				<div className="status-line" style={{ padding: '2px 2px 0' }}>
					<span
						className="dot"
						style={{ background: connected ? 'var(--success)' : 'var(--warning)' }}
					/>
					{room.ended ? 'Game finished' : `${active?.username || 'Guest'} to act`}
				</div>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: 8,
						overflowY: 'auto',
						paddingRight: 4,
						flex: 1,
					}}
				>
					{room.players.map((p) => (
						<PlayerPanel
							key={p.userId}
							p={p}
							isMe={p.userId === userId}
							isActive={active?.userId === p.userId}
							room={room}
							onTrade={() => setTradeWith(p.userId)}
							onHover={(pl) => setHoveredPlayer(pl)}
						/>
					))}
				</div>
			</aside>

			<main
				style={{
					display: 'flex',
					flexDirection: 'column',
					minHeight: 0,
					border: DESKTOP_PANEL_BORDER,
					borderRadius: 'var(--radius-lg)',
					background: 'var(--bg-1)',
					boxShadow: 'var(--shadow-lg)',
					overflow: 'hidden',
				}}
			>
				<div
					style={{
						flex: 1,
						minHeight: 0,
						display: 'grid',
						placeItems: 'center',
						padding: BOARD_STAGE_PADDING,
					}}
				>
					<div
						style={{
							width: `min(100%, ${DESKTOP_BOARD_MAX_SIZE})`,
							aspectRatio: '1 / 1',
							maxHeight: DESKTOP_BOARD_MAX_SIZE,
						}}
					>
						<Board
							room={room}
							userId={userId}
							diceRolling={diceRolling}
							events={events}
							me={me}
							isMyTurn={isMyTurn}
							act={act}
							onTileClick={(pos) => setOpenPropertyPos(pos)}
							hoveredPlayer={hoveredPlayer}
							onHoverPlayer={setHoveredPlayer}
							onDiceAnimationComplete={handleDiceAnimationComplete}
							onTokenMotionComplete={handleTokenMotionComplete}
							actionsUnlocked={actionsUnlocked}
						/>
					</div>
				</div>
			</main>

			<aside
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 8,
					minHeight: 0,
					padding: 12,
					background: 'var(--surface)',
					border: DESKTOP_PANEL_BORDER,
					borderRadius: 'var(--radius-lg)',
				}}
			>
				<header className="section-title" style={{ padding: '2px 2px 0' }}>
					<ScrollText size={14} color="var(--text-3)" />
					<div>Action Log</div>
				</header>
				<ActionLog
					log={room.actionLog}
					players={room.players}
					tiles={room.board.tiles}
					onTradeClick={handleTradeClick}
				/>
			</aside>

			{modals}
		</div>
	);
}
