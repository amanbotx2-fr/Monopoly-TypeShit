import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	ArrowLeft,
	CarFront,
	ChevronDown,
	CircleHelp,
	Crown,
	Dog,
	Footprints,
	MapPinned,
	Plus,
	RefreshCw,
	Search,
	ShipWheel,
	UsersRound,
} from 'lucide-react';
import { api } from '../../api';
import PremiumHeader from '../common/PremiumHeader';
import '../home/Home.css';
import './BrowseRooms.css';

const ROOM_ICONS = [Crown, CarFront, Dog, ShipWheel, Footprints, CircleHelp];
const PLAYER_COLORS = [
	'oklch(67% 0.17 24)',
	'oklch(67% 0.12 230)',
	'oklch(65% 0.14 145)',
	'oklch(68% 0.13 295)',
	'oklch(76% 0.15 88)',
	'oklch(69% 0.14 43)',
	'oklch(62% 0.13 265)',
	'oklch(72% 0.09 340)',
];

export default function BrowseRooms({ pushToast }) {
	const nav = useNavigate();
	const [rooms, setRooms] = useState([]);
	const [search, setSearch] = useState('');
	const [mode, setMode] = useState('all');
	const [playerFilter, setPlayerFilter] = useState('all');
	const [boardFilter, setBoardFilter] = useState('all');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState('');

	const refreshRooms = useCallback(async ({ quiet = false } = {}) => {
		if (!quiet) setRefreshing(true);
		try {
			setRooms(await api.listRooms());
			setError('');
		} catch {
			setError('Rooms could not be refreshed');
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		let isCurrent = true;
		api.listRooms()
			.then((nextRooms) => {
				if (!isCurrent) return;
				setRooms(nextRooms);
				setError('');
			})
			.catch(() => {
				if (isCurrent) setError('Rooms could not be refreshed');
			})
			.finally(() => {
				if (isCurrent) setLoading(false);
			});
		const timer = setInterval(() => refreshRooms({ quiet: true }), 5000);
		return () => {
			isCurrent = false;
			clearInterval(timer);
		};
	}, [refreshRooms]);

	const boardOptions = useMemo(
		() => [...new Set(rooms.map((room) => room.boardName).filter(Boolean))].sort(),
		[rooms],
	);

	const filteredRooms = useMemo(() => {
		const query = search.trim().toLowerCase();
		return rooms.filter((room) => {
			const roomCode = String(room.roomCode || '').toLowerCase();
			const host = String(room.host || '').toLowerCase();
			const boardName = String(room.boardName || '').toLowerCase();
			const matchesSearch =
				!query ||
				roomCode.includes(query) ||
				host.includes(query) ||
				boardName.includes(query);
			const matchesBoard = boardFilter === 'all' || room.boardName === boardFilter;
			const matchesPlayers =
				playerFilter === 'all' ||
				(playerFilter === 'small' && room.players <= 2) ||
				(playerFilter === 'medium' && room.players >= 3 && room.players <= 5) ||
				(playerFilter === 'large' && room.players >= 6);
			const matchesMode = mode === 'all' || mode === 'classic';
			return matchesSearch && matchesBoard && matchesPlayers && matchesMode;
		});
	}, [boardFilter, mode, playerFilter, rooms, search]);

	function savedIdentity() {
		return {
			username: (localStorage.getItem('monopoly.username') || '').trim(),
			color: localStorage.getItem('monopoly.color') || '#EF4444',
		};
	}

	function requireIdentity() {
		const identity = savedIdentity();
		if (identity.username) return identity;
		pushToast('Enter your nickname on the home page first', 'error');
		nav('/');
		return null;
	}

	async function createRoom() {
		const identity = requireIdentity();
		if (!identity) return;
		try {
			const { roomCode } = await api.createRoom({
				...identity,
				boardId: 'world-tour',
			});
			nav(`/r/${roomCode}`);
		} catch (requestError) {
			pushToast(requestError.message || 'Failed to create room', 'error');
		}
	}

	async function joinRoom(roomCode) {
		if (!requireIdentity()) return;
		try {
			await api.getRoom(roomCode);
			nav(`/r/${roomCode}`);
		} catch {
			pushToast('That room is no longer available', 'error');
			refreshRooms({ quiet: true });
		}
	}

	return (
		<main className="app-page landing-page browse-rooms-page">
			<PremiumHeader pushToast={pushToast} showLogo onLogoClick={() => nav('/')} />

			<div className="browse-rooms-shell">
				<button className="browse-back-button" type="button" onClick={() => nav('/')}>
					<ArrowLeft aria-hidden="true" /> Back
				</button>

				<div className="browse-title-row">
					<div>
						<h1>Browse rooms</h1>
						<p>Join a public room or create your own to start playing.</p>
					</div>
					<button className="browse-create-button" type="button" onClick={createRoom}>
						<Plus aria-hidden="true" /> Create room
					</button>
				</div>

				<div className="browse-filters" aria-label="Room filters">
					<label className="browse-search">
						<span className="sr-only">Search rooms</span>
						<Search aria-hidden="true" />
						<input
							type="search"
							placeholder="Search rooms..."
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</label>
					<FilterSelect label="Game mode" value={mode} onChange={setMode}>
						<option value="all">All</option>
						<option value="classic">Classic</option>
					</FilterSelect>
					<FilterSelect label="Players" value={playerFilter} onChange={setPlayerFilter}>
						<option value="all">All</option>
						<option value="small">1–2 players</option>
						<option value="medium">3–5 players</option>
						<option value="large">6–7 players</option>
					</FilterSelect>
					<FilterSelect label="Board" value={boardFilter} onChange={setBoardFilter}>
						<option value="all">All</option>
						{boardOptions.map((board) => (
							<option key={board} value={board}>
								{board}
							</option>
						))}
					</FilterSelect>
				</div>

				<div className="browse-room-table" role="table" aria-label="Public rooms">
					<div className="browse-table-head" role="row">
						<span role="columnheader">Room</span>
						<span role="columnheader">Mode</span>
						<span role="columnheader">Players</span>
						<span role="columnheader">Board</span>
						<span aria-hidden="true" />
					</div>

					<div className="browse-table-body" role="rowgroup">
						{loading && rooms.length === 0 && <RoomSkeletons />}
						{!loading && filteredRooms.length === 0 && (
							<div className="browse-empty-state">
								<UsersRound aria-hidden="true" />
								<strong>
									{rooms.length
										? 'No rooms match these filters'
										: 'No public rooms are open'}
								</strong>
								<span>
									{rooms.length
										? 'Try a broader search or reset a filter.'
										: 'Create the first room and invite other players.'}
								</span>
							</div>
						)}
						{filteredRooms.map((room) => (
							<RoomRow key={room.roomCode} room={room} onJoin={joinRoom} />
						))}
					</div>
				</div>

				<button
					className={`browse-refresh-status${refreshing ? ' is-refreshing' : ''}`}
					type="button"
					onClick={() => refreshRooms()}
					aria-label="Refresh rooms now"
				>
					<RefreshCw aria-hidden="true" />
					<span aria-live="polite">{error || 'Rooms refresh automatically'}</span>
				</button>
			</div>
		</main>
	);
}

function FilterSelect({ label, value, onChange, children }) {
	return (
		<label className="browse-filter-select">
			<span>{label}</span>
			<select
				aria-label={label}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			>
				{children}
			</select>
			<ChevronDown aria-hidden="true" />
		</label>
	);
}

function RoomRow({ room, onJoin }) {
	const RoomIcon = ROOM_ICONS[hashCode(room.roomCode) % ROOM_ICONS.length];
	const roomName = room.host ? `${room.host}'s room` : `Room ${room.roomCode}`;

	return (
		<div className="browse-room-row" role="row">
			<div className="browse-room-identity" role="cell">
				<span className="browse-room-icon" aria-hidden="true">
					<RoomIcon />
				</span>
				<span>
					<strong>{roomName}</strong>
					<small>
						Created by {room.host || 'Guest'} <i aria-hidden="true" /> Code{' '}
						{room.roomCode}
					</small>
				</span>
			</div>
			<div className="browse-room-mode" role="cell" data-label="Mode">
				<Crown aria-hidden="true" /> Classic
			</div>
			<div className="browse-player-cell" role="cell" data-label="Players">
				<span>{room.players} / 8</span>
				<PlayerAvatars count={room.players} seed={hashCode(room.roomCode)} />
			</div>
			<div className="browse-board-cell" role="cell" data-label="Board">
				<MapPinned aria-hidden="true" /> {room.boardName}
			</div>
			<button
				className="browse-join-button"
				type="button"
				onClick={() => onJoin(room.roomCode)}
			>
				Join
			</button>
		</div>
	);
}

function PlayerAvatars({ count, seed }) {
	const avatarCount = Math.min(Math.max(Number(count) || 0, 0), 8);
	return (
		<span className="browse-player-avatars" aria-hidden="true">
			{Array.from({ length: avatarCount }, (_, index) => (
				<i
					key={index}
					style={{ background: PLAYER_COLORS[(seed + index) % PLAYER_COLORS.length] }}
				/>
			))}
		</span>
	);
}

function RoomSkeletons() {
	return Array.from({ length: 4 }, (_, index) => (
		<div className="browse-room-skeleton" key={index} aria-hidden="true">
			<span />
			<span />
			<span />
		</div>
	));
}

function hashCode(value) {
	return [...String(value || '')].reduce(
		(total, character) => total + character.charCodeAt(0),
		0,
	);
}
