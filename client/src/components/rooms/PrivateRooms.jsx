import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	Archive,
	ArrowLeft,
	LockKeyhole,
	MapPinned,
	Plus,
	RefreshCw,
	ShieldCheck,
	UsersRound,
} from 'lucide-react';
import { api } from '../../api';
import PremiumHeader from '../common/PremiumHeader';
import '../home/Home.css';
import './BrowseRooms.css';
import './PrivateRooms.css';

export default function PrivateRooms({ pushToast }) {
	const nav = useNavigate();
	const [roomCode, setRoomCode] = useState('');
	const [rooms, setRooms] = useState([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [joiningCode, setJoiningCode] = useState('');
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

	async function joinPrivateRoom(code) {
		const normalizedCode = String(code || roomCode)
			.trim()
			.toUpperCase();
		if (!normalizedCode) {
			pushToast('Enter a room code', 'error');
			return;
		}
		if (!requireIdentity() || joiningCode) return;
		setJoiningCode(normalizedCode);
		try {
			await api.getRoom(normalizedCode);
			nav(`/r/${normalizedCode}`);
		} catch {
			pushToast('That room is no longer available', 'error');
			setJoiningCode('');
			refreshRooms({ quiet: true });
		}
	}

	function announceComingSoon(label) {
		pushToast(`${label} is coming soon`, 'info');
	}

	return (
		<main className="app-page landing-page private-rooms-page">
			<PremiumHeader pushToast={pushToast} showLogo onLogoClick={() => nav('/')} />

			<div className="private-rooms-shell">
				<button className="browse-back-button" type="button" onClick={() => nav('/')}>
					<ArrowLeft aria-hidden="true" /> Back
				</button>

				<div className="browse-title-row private-title-row">
					<div>
						<h1>Private rooms</h1>
						<p>Join a private room with a code or create your own.</p>
					</div>
					<button
						className="browse-create-button"
						type="button"
						onClick={() => nav('/private-rooms/create')}
					>
						<Plus aria-hidden="true" />
						Create private room
					</button>
				</div>

				<div className="private-top-grid">
					<section className="private-join-card" aria-labelledby="private-join-title">
						<div className="private-card-heading">
							<UsersRound aria-hidden="true" />
							<div>
								<h2 id="private-join-title">Join private room</h2>
								<p>Enter a room code to join a private game.</p>
							</div>
						</div>
						<form
							className="private-join-form"
							onSubmit={(event) => {
								event.preventDefault();
								joinPrivateRoom();
							}}
						>
							<label>
								<span className="sr-only">Room code</span>
								<LockKeyhole aria-hidden="true" />
								<input
									autoComplete="off"
									maxLength={6}
									minLength={6}
									placeholder="Enter room code..."
									spellCheck={false}
									value={roomCode}
									onChange={(event) =>
										setRoomCode(event.target.value.toUpperCase())
									}
								/>
							</label>
							<button
								className="browse-join-button"
								type="submit"
								disabled={Boolean(joiningCode)}
								aria-busy={Boolean(joiningCode)}
							>
								{joiningCode ? 'Joining...' : 'Join room'}
							</button>
						</form>
					</section>

					<aside className="private-benefits" aria-label="Private room benefits">
						<PrivateBenefit
							icon={LockKeyhole}
							title="Private games"
							copy="Only people with the code can join"
						/>
						<PrivateBenefit
							icon={UsersRound}
							title="Invite friends"
							copy="Share the code and play with your friends"
						/>
						<PrivateBenefit
							icon={ShieldCheck}
							title="Secure & fair"
							copy="Fair gameplay in a private environment"
						/>
					</aside>
				</div>

				<section className="private-room-section" aria-labelledby="your-private-title">
					<h2 id="your-private-title">Your private rooms</h2>
					<div className="private-owned-empty">
						<Archive aria-hidden="true" />
						<strong>You don’t have any private rooms yet.</strong>
						<span>Create one and invite your friends!</span>
					</div>
				</section>

				<section className="private-room-section" aria-labelledby="available-private-title">
					<div className="private-section-heading">
						<h2 id="available-private-title">Available private rooms</h2>
						<button
							className={`private-refresh-button${refreshing ? ' is-refreshing' : ''}`}
							type="button"
							onClick={() => refreshRooms()}
							disabled={refreshing}
							aria-label={error || 'Refresh rooms'}
						>
							<RefreshCw aria-hidden="true" /> {error ? 'Retry' : 'Refresh'}
						</button>
					</div>

					<div
						className="private-available-list"
						aria-live="polite"
						aria-busy={loading || refreshing}
					>
						{loading && rooms.length === 0 && <PrivateRoomSkeletons />}
						{!loading && rooms.length === 0 && (
							<div className="private-available-empty">
								<LockKeyhole aria-hidden="true" />
								<strong>No shared rooms are available right now.</strong>
								<span>
									{error || 'Enter an invite code above or create a new room.'}
								</span>
							</div>
						)}
						{rooms.map((room) => (
							<PrivateRoomRow
								key={room.roomCode}
								room={room}
								onJoin={joinPrivateRoom}
								joining={joiningCode === room.roomCode}
							/>
						))}
					</div>
				</section>

				<footer className="private-footer">
					<span>© {new Date().getFullYear()} MONOPOLY. All rights reserved.</span>
					<nav aria-label="Legal and support links">
						<button type="button" onClick={() => announceComingSoon('Privacy Policy')}>
							Privacy Policy
						</button>
						<i aria-hidden="true" />
						<button
							type="button"
							onClick={() => announceComingSoon('Terms of Service')}
						>
							Terms of Service
						</button>
						<i aria-hidden="true" />
						<button type="button" onClick={() => announceComingSoon('Support')}>
							Support
						</button>
					</nav>
				</footer>
			</div>
		</main>
	);
}

function PrivateBenefit({ icon: Icon, title, copy }) {
	return (
		<div className="private-benefit">
			<Icon aria-hidden="true" />
			<strong>{title}</strong>
			<span>{copy}</span>
		</div>
	);
}

function PrivateRoomRow({ room, onJoin, joining }) {
	return (
		<div className="private-room-row">
			<div className="private-room-identity">
				<span className="private-room-lock" aria-hidden="true">
					<LockKeyhole />
				</span>
				<span>
					<strong>{room.host ? `${room.host}'s room` : `Room ${room.roomCode}`}</strong>
					<small>
						Hosted by {room.host || 'Guest'} <i aria-hidden="true" /> Available now
					</small>
				</span>
			</div>
			<div className="private-room-players" data-label="Players">
				<UsersRound aria-hidden="true" /> {room.players} / 8
			</div>
			<div className="private-room-board" data-label="Board">
				<MapPinned aria-hidden="true" /> {room.boardName || 'World Tour'}
			</div>
			<button
				className="browse-join-button"
				type="button"
				onClick={() => onJoin(room.roomCode)}
				disabled={joining}
				aria-busy={joining}
			>
				{joining ? 'Joining...' : 'Join'}
			</button>
		</div>
	);
}

function PrivateRoomSkeletons() {
	return Array.from({ length: 3 }, (_, index) => (
		<div className="private-room-skeleton" key={index} aria-hidden="true">
			<span />
			<span />
			<span />
		</div>
	));
}
