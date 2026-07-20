import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api';
import Home from './components/home/Home';
import BrowseRooms from './components/rooms/BrowseRooms';
import PrivateRooms from './components/rooms/PrivateRooms';
import CreatePrivateRoom from './components/rooms/CreatePrivateRoom';
import CreateMapIntro from './components/editor/CreateMapIntro';
import Lobby from './components/lobby/Lobby';
import Game from './components/game/Game';
import MapEditor from './components/editor/MapEditor';
import MyMaps from './components/editor/MyMaps';
import Toasts from './components/common/Toasts';
import BrandLogo from './components/common/BrandLogo';
import { onError } from './socket';
import { installGlobalClickSound, play as playSound } from './sound';
import useRoom from './useRoom';

export default function App() {
	const [userId, setUserId] = useState(null);
	const [toasts, setToasts] = useState([]);

	useEffect(() => {
		api.me()
			.then((r) => setUserId(r.userId))
			.catch(() => setUserId(null));
	}, []);

	useEffect(() => {
		installGlobalClickSound();
	}, []);

	useEffect(() => {
		return onError((err) => {
			pushToast(err);
			playSound('error');
		});
	}, []);

	function pushToast(text, kind = 'error') {
		const id = Math.random().toString(36).slice(2);
		setToasts((t) => [...t, { id, text, kind }]);
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
	}

	if (userId === null) {
		return (
			<div className="grid-bg" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
				<div
					className="card"
					style={{ display: 'grid', gap: 14, justifyItems: 'center', minWidth: 260 }}
				>
					<BrandLogo size={34} />
					<div className="status-line" style={{ justifyContent: 'center' }}>
						<span className="dot" style={{ background: 'var(--accent)' }} />
						Loading session...
					</div>
				</div>
			</div>
		);
	}

	return (
		<>
			<Routes>
				<Route path="/" element={<Home userId={userId} pushToast={pushToast} />} />
				<Route path="/rooms" element={<BrowseRooms pushToast={pushToast} />} />
				<Route path="/private-rooms" element={<PrivateRooms pushToast={pushToast} />} />
				<Route
					path="/private-rooms/create"
					element={<CreatePrivateRoom pushToast={pushToast} />}
				/>
				<Route path="/create-map" element={<CreateMapIntro pushToast={pushToast} />} />
				<Route
					path="/r/:code"
					element={<RoomRouter userId={userId} pushToast={pushToast} />}
				/>
				<Route
					path="/editor"
					element={<MapEditor userId={userId} pushToast={pushToast} />}
				/>
				<Route
					path="/editor/:boardId"
					element={<MapEditor userId={userId} pushToast={pushToast} />}
				/>
				<Route path="/maps" element={<MyMaps userId={userId} pushToast={pushToast} />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
			<Toasts toasts={toasts} />
		</>
	);
}

// Switches between Lobby (before game start) and Game (after) based on
// room.started. Uses a shared socket connection so the correct component
// renders immediately on page refresh without a Lobby flicker.
function RoomRouter({ userId, pushToast }) {
	const roomSession = useRoom({ userId });
	const { room, connected } = roomSession;

	// Still connecting — show a branded loading state.
	if (!room) {
		return (
			<div className="grid-bg" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
				<div
					className="card"
					style={{ display: 'grid', gap: 14, justifyItems: 'center', minWidth: 260 }}
				>
					<BrandLogo size={34} />
					<div className="status-line" style={{ justifyContent: 'center' }}>
						<span
							className="dot"
							style={{ background: connected ? 'var(--success)' : 'var(--warning)' }}
						/>
						{connected ? 'Joining game…' : 'Connecting…'}
					</div>
				</div>
			</div>
		);
	}

	return room.started ? (
		<Game userId={userId} pushToast={pushToast} roomSession={roomSession} />
	) : (
		<Lobby userId={userId} pushToast={pushToast} roomSession={roomSession} />
	);
}
