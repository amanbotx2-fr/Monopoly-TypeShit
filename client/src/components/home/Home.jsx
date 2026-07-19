import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Map, Play, UserRound, UsersRound } from 'lucide-react';
import { api } from '../../api';
import PremiumHeader from '../common/PremiumHeader';
import './Home.css';

export default function Home({ pushToast }) {
	const nav = useNavigate();
	const [username, setUsername] = useState(() => localStorage.getItem('monopoly.username') || '');
	const [color] = useState(() => localStorage.getItem('monopoly.color') || '#EF4444');

	function persist() {
		localStorage.setItem('monopoly.username', username);
		localStorage.setItem('monopoly.color', color);
	}

	async function create() {
		if (!username.trim()) return pushToast('Enter your nickname to play', 'error');
		persist();
		try {
			const { roomCode } = await api.createRoom({
				username: username.trim(),
				color,
				boardId: 'world-tour',
			});
			nav(`/r/${roomCode}`);
		} catch (error) {
			pushToast(error.message || 'Failed to create room');
		}
	}

	return (
		<main className="app-page landing-page">
			<PremiumHeader pushToast={pushToast} />

			<section className="landing-hero" aria-labelledby="landing-title">
				<div className="landing-brand">
					<img className="landing-brand-mark" src="/brand-mark.png" alt="" />
					<h1 id="landing-title">MONOPOLY</h1>
					<div className="landing-tagline" aria-label="Play, trade, build, win">
						<span className="landing-tagline-line" aria-hidden="true" />
						<span>Play</span>
						<i aria-hidden="true" />
						<span>Trade</span>
						<i aria-hidden="true" />
						<span>Build</span>
						<i aria-hidden="true" />
						<span>Win</span>
						<span className="landing-tagline-line" aria-hidden="true" />
					</div>
				</div>

				<form
					className="landing-actions"
					onSubmit={(event) => {
						event.preventDefault();
						create();
					}}
				>
					<label className="landing-name-field">
						<span className="sr-only">Nickname</span>
						<UserRound aria-hidden="true" />
						<input
							autoComplete="nickname"
							maxLength={24}
							placeholder="Enter your nickname..."
							value={username}
							onBlur={persist}
							onChange={(event) => setUsername(event.target.value)}
						/>
					</label>

					<button className="landing-play-button" type="submit">
						<Play aria-hidden="true" fill="currentColor" />
						<span>Play now</span>
					</button>

					<div className="landing-secondary-actions">
						<button type="button" onClick={() => nav('/rooms')}>
							<UsersRound aria-hidden="true" />
							<span>Browse rooms</span>
						</button>
						<button type="button" onClick={() => nav('/private-rooms')}>
							<LockKeyhole aria-hidden="true" />
							<span>Private room</span>
						</button>
					</div>

					<button
						className="landing-map-button"
						type="button"
						onClick={() => nav('/create-map')}
					>
						<Map aria-hidden="true" />
						<span>Create your own map</span>
						<strong>New</strong>
					</button>
				</form>
			</section>
		</main>
	);
}
