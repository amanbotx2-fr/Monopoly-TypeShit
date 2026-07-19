import React, { useMemo, useState } from 'react';
import Tile from './Tile';
import PlayerToken from './PlayerToken';
import Dice from './Dice';
import PropertyCard from './PropertyCard';
import BoardOverlay from './BoardOverlay';
import PlayerHoverCard from './PlayerHoverCard';
import ActionBar from './ActionBar';
import ActionLog from './ActionLog';
import { analyzeBoard, tileSide, gridArea } from './layout';
import './board.css';

// CSS Grid-based board. All tile grouping is derived from tile types
// so custom maps with different arrangements just work.
export default function Board({
	room,
	userId: _userId,
	diceRolling,
	events,
	act,
	me,
	isMyTurn,
	onTileClick,
	hoveredPlayer,
	onHoverPlayer,
	actionLog,
	onOpenTrade,
}) {
	const [hovered, setHovered] = useState(null);
	const tiles = room?.board?.tiles || [];
	const tileState = room?.tileState || [];
	const players = room?.players || [];
	const active = room?.players?.[room?.turnIndex];
	// Analyze board once — derives corner positions and side count from tile types.
	const boardInfo = useMemo(() => analyzeBoard(tiles), [tiles]);

	// Compute highlight set when hovering a player token.
	const highlightTiles = (() => {
		if (!hoveredPlayer) return {};
		const p = hoveredPlayer.player;
		const set = {};
		if (p.position != null) set[p.position] = 'position';
		for (const pos of p.owned || []) {
			if (!(pos in set)) set[pos] = 'owned';
		}
		return set;
	})();

	// Tiles that have buildings (houses/hotel) — used to trigger the
	// token peek animation so the count is visible under player tokens.
	const tilesWithBuildings = useMemo(() => {
		const set = new Set();
		for (const ts of tileState) {
			if (ts && ts.type === 'property' && ts.owner && ts.houses > 0) {
				set.add(ts.pos);
			}
		}
		return set;
	}, [tileState]);

	// Split tiles by side, driven by tile types not magic numbers.
	const cornerTiles = useMemo(() => {
		if (!boardInfo) return [];
		const { goPos, jailPos, parkingPos, gotoprisonPos } = boardInfo;
		return tiles.filter((t) => [goPos, jailPos, parkingPos, gotoprisonPos].includes(t.pos));
	}, [tiles, boardInfo]);

	const topTiles = useMemo(() => {
		if (!boardInfo) return [];
		const { goPos, jailPos } = boardInfo;
		return tiles.filter((t) => t.pos > goPos && t.pos < jailPos);
	}, [tiles, boardInfo]);

	const rightTiles = useMemo(() => {
		if (!boardInfo) return [];
		const { jailPos, parkingPos } = boardInfo;
		return tiles.filter((t) => t.pos > jailPos && t.pos < parkingPos);
	}, [tiles, boardInfo]);

	const bottomTiles = useMemo(() => {
		if (!boardInfo) return [];
		const { parkingPos, gotoprisonPos } = boardInfo;
		return tiles.filter((t) => t.pos > parkingPos && t.pos < gotoprisonPos);
	}, [tiles, boardInfo]);

	const leftTiles = useMemo(() => {
		if (!boardInfo) return [];
		const { gotoprisonPos, goPos } = boardInfo;
		return tiles.filter((t) => t.pos > gotoprisonPos || t.pos < goPos);
	}, [tiles, boardInfo]);

	const renderTile = (t) => {
		const side = boardInfo ? tileSide(t.pos, boardInfo) : 'corner';
		const area = boardInfo ? gridArea(t.pos, boardInfo) : null;
		return (
			<Tile
				key={t.pos}
				def={t}
				side={side}
				gridArea={area}
				state={tileState[t.pos]}
				players={players}
				onClick={() => onTileClick?.(t.pos)}
				onHover={(e, def) => setHovered(def ? { def, state: tileState[t.pos], e } : null)}
				highlight={highlightTiles[t.pos] || null}
				highlightColor={hoveredPlayer?.player?.color}
			/>
		);
	};

	return (
		<div className="board">
			{/* Corner tiles (placed by grid-area) */}
			{cornerTiles.map(renderTile)}

			{/* Top row */}
			<div className="side-row side-row-top">{topTiles.map(renderTile)}</div>

			{/* Right column */}
			<div className="side-col side-col-right">{rightTiles.map(renderTile)}</div>

			{/* Bottom row */}
			<div className="side-row side-row-bottom">{bottomTiles.map(renderTile)}</div>

			{/* Left column */}
			<div className="side-col side-col-left">{leftTiles.map(renderTile)}</div>

			{/* Center area */}
			<div className="board-center">
				<div className="board-brand">MONOPOLY</div>
				<div className="center-stack">
					<Dice dice={room?.lastDice} rolling={diceRolling} />
					{room?.lastDiceRoller && (
						<div className="dice-roller">
							{players.find((p) => p.userId === room.lastDiceRoller)?.username || '—'}{' '}
							rolled
						</div>
					)}
					<ActionBar room={room} me={me} isMyTurn={isMyTurn} act={act} />
					<ActionLog
						variant="board"
						log={actionLog}
						players={players}
						tiles={tiles}
						onTradeClick={onOpenTrade}
					/>
				</div>

				{room?.lastDice && !diceRolling && (
					<div className="dice-roller" style={{ marginTop: 4 }}>
						{room.lastDice[0]} + {room.lastDice[1]}
					</div>
				)}
			</div>

			{/* Player tokens overlay */}
			<div className="board-tokens">
				{players
					.filter((p) => !p.bankrupt)
					.map((p) => {
						const stackIdx = players
							.filter((x) => !x.bankrupt && x.position === p.position)
							.findIndex((x) => x.userId === p.userId);
						return (
							<PlayerToken
								key={p.userId}
								player={p}
								isActive={active?.userId === p.userId && room?.started}
								stackIndex={stackIdx}
								events={events}
								boardInfo={boardInfo}
								tilesWithBuildings={tilesWithBuildings}
								onHover={(e, pl) => onHoverPlayer(pl ? { player: pl, e } : null)}
							/>
						);
					})}
			</div>

			<BoardOverlay room={room} events={events} players={players} boardInfo={boardInfo} />

			{hoveredPlayer && <div className="board-dim" />}

			{hovered && (
				<PropertyCard
					def={hovered.def}
					state={hovered.state}
					players={players}
					style={floatPos(hovered.e)}
				/>
			)}
			{hoveredPlayer && (
				<PlayerHoverCard
					player={hoveredPlayer.player}
					room={room}
					anchor={hoveredPlayer.e}
				/>
			)}
		</div>
	);
}

function floatPos(e) {
	if (!e) return {};
	const x = e.clientX || 0;
	const y = e.clientY || 0;
	return {
		position: 'fixed',
		left: Math.min(x + 16, window.innerWidth - 300),
		top: Math.min(y + 12, window.innerHeight - 220),
		pointerEvents: 'none',
	};
}
