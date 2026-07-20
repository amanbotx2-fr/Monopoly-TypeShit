import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	ArrowLeft,
	Bot,
	ChevronDown,
	Copy,
	Crown,
	Info,
	LockKeyhole,
	Map,
	Play,
	Scale,
	Settings,
	ShieldCheck,
	UserCheck,
	UserPlus,
	UserRound,
	Users,
	X,
	Zap,
} from 'lucide-react';
import { api } from '../../api';
import BrandLogo from '../common/BrandLogo';
import SoundToggle from '../game/SoundToggle';
import TokenPicker from '../home/TokenPicker';
import LobbyChat from './LobbyChat';
import './Lobby.css';

const allowSoloDevGame = import.meta.env.VITE_ALLOW_SOLO_DEV_GAME === '1' || import.meta.env.DEV;
const MAX_PLAYERS = 8;

export default function Lobby({ userId, pushToast, roomSession }) {
	const nav = useNavigate();
	const [tokens, setTokens] = useState([]);
	const { roomCode, room, chat, connected, act, sendChat } = roomSession;

	useEffect(() => {
		api.tokens()
			.then(setTokens)
			.catch(() => {});
	}, []);

	if (!room) {
		return <LobbyLoading connected={connected} />;
	}

	const me = room.players.find((player) => player.userId === userId);
	const isHost = me?.isHost;
	const takenColors = room.players.map((player) => player.color);
	const connectedPlayers = room.players.filter((player) => player.connected !== false);
	const canStartGame = room.players.length >= 2 || allowSoloDevGame;
	const shareUrl = `${window.location.origin}/r/${roomCode}`;
	const readinessCopy =
		room.players.length < 2 && !allowSoloDevGame
			? 'Invite one more player to unlock the table.'
			: room.players.length < 2 && allowSoloDevGame
				? 'Solo start is enabled in dev so you can test the full game loop.'
				: isHost
					? 'Room is ready. Start when everyone is set.'
					: 'You are in. Waiting for the host to start.';

	function copyLink() {
		navigator.clipboard.writeText(shareUrl).then(() => pushToast('Link copied', 'success'));
	}

	return (
		<main className="app-page grid-bg lobby-page">
			<div className="lobby-shell">
				<header className="lobby-header">
					<button className="lobby-leave-button" type="button" onClick={() => nav('/')}>
						<ArrowLeft aria-hidden="true" />
						<span>Leave lobby</span>
					</button>

					<BrandLogo className="lobby-brand" size={52} />

					<div className="lobby-room-actions">
						<span className="lobby-room-code">{roomCode}</span>
						<button className="lobby-copy-link-button" type="button" onClick={copyLink}>
							<Copy aria-hidden="true" />
							<span>Copy link</span>
						</button>
					</div>
				</header>

				<div className="lobby-layout">
					<aside className="lobby-left-column" aria-label="Lobby sharing and chat">
						<section className="lobby-panel lobby-share-card">
							<div className="lobby-section-heading">
								<span>Share this game</span>
								<Info aria-hidden="true" />
							</div>
							<div className="lobby-share-control">
								<input
									aria-label="Room invitation link"
									readOnly
									value={shareUrl}
									onFocus={(event) => event.currentTarget.select()}
								/>
								<button type="button" onClick={copyLink}>
									<Copy aria-hidden="true" />
									<span>Copy</span>
								</button>
							</div>
							<div className="lobby-share-meta">
								<span>Anyone with this link can join</span>
								<SoundToggle />
							</div>
						</section>

						<LobbyChat chat={chat} sendChat={sendChat} me={me} />
					</aside>

					<section
						className="lobby-center-column"
						aria-label="Lobby players and controls"
					>
						<section className="lobby-panel lobby-overview-card">
							<h1>Lobby</h1>
							<div className="lobby-status-line">
								<span className={connected ? 'is-online' : 'is-connecting'} />
								{isHost ? 'Host controls active' : 'Waiting for host'}
							</div>

							<div className="lobby-presence-summary">
								<div
									className="lobby-avatar-stack"
									aria-label={`${connectedPlayers.length} players online`}
								>
									{room.players.slice(0, 5).map((player) => (
										<span
											key={player.userId}
											className={`lobby-avatar ${player.connected === false ? 'is-offline' : ''}`}
											title={player.username}
											style={{ background: player.color }}
										>
											{String(player.username || 'P')
												.slice(0, 1)
												.toUpperCase()}
										</span>
									))}
									{room.players.length > 5 && (
										<span className="lobby-avatar lobby-avatar-more">
											+{room.players.length - 5}
										</span>
									)}
								</div>
								<div className="lobby-presence-copy">
									<strong>{connectedPlayers.length} online at the table</strong>
									<span>{readinessCopy}</span>
								</div>
								<button
									className="lobby-invite-button"
									type="button"
									onClick={copyLink}
								>
									<UserPlus aria-hidden="true" />
									<span>Invite</span>
								</button>
							</div>
						</section>

						<section className="lobby-panel lobby-players-card">
							<SectionHead
								icon={Users}
								label="Players"
								count={`${room.players.length} / ${MAX_PLAYERS}`}
							/>
							<div className="lobby-player-list">
								{room.players.map((player) => (
									<PlayerRow
										key={player.userId}
										player={player}
										isMe={player.userId === userId}
										viewerIsHost={isHost}
										onKick={() => act('kick', { userId: player.userId })}
										onRename={(username) => act('set-username', { username })}
									/>
								))}
							</div>

							{me && (
								<div className="lobby-token-section">
									<div className="lobby-token-heading">Choose token color</div>
									<TokenPicker
										tokens={tokens}
										value={me.color}
										onChange={(color) => act('set-color', { color })}
										disabledHexes={takenColors}
									/>
								</div>
							)}
						</section>

						<section className="lobby-start-bar" aria-label="Start game controls">
							{isHost ? (
								<button
									className="lobby-start-button"
									type="button"
									disabled={!canStartGame}
									onClick={() => act('start-game')}
								>
									<Play aria-hidden="true" fill="currentColor" />
									<span>Start game</span>
								</button>
							) : (
								<div className="lobby-waiting-state">
									Waiting for the host to start
								</div>
							)}
							<label className="lobby-mode-control">
								<Info aria-hidden="true" />
								<span>Game mode:</span>
								<select aria-label="Game mode" value="classic" disabled>
									<option value="classic">Classic</option>
								</select>
								<ChevronDown aria-hidden="true" />
							</label>
						</section>
					</section>

					<aside className="lobby-right-column" aria-label="Lobby settings">
						<div className="lobby-summary-grid">
							<SummaryMetric
								label="Players"
								value={`${room.players.length}/${MAX_PLAYERS}`}
							/>
							<SummaryMetric label="Board" value={room.board?.name || 'Board'} />
							<SummaryMetric label="Role" value={isHost ? 'Host' : 'Player'} />
						</div>

						<SettingsCard room={room} isHost={isHost} act={act} />
					</aside>
				</div>

				<LobbyFooterStrip isHost={isHost} />
			</div>
		</main>
	);
}

function LobbyLoading({ connected }) {
	return (
		<main className="app-page grid-bg lobby-page lobby-loading-page">
			<section className="lobby-panel lobby-loading-card" aria-live="polite">
				<BrandLogo size={44} />
				<div className="lobby-status-line">
					<span className={connected ? 'is-online' : 'is-connecting'} />
					{connected ? 'Loading room...' : 'Connecting...'}
				</div>
			</section>
		</main>
	);
}

function SectionHead({ icon: Icon, label, count }) {
	return (
		<div className="lobby-section-head">
			<Icon aria-hidden="true" />
			<h2>{label}</h2>
			{count && <span>{count}</span>}
		</div>
	);
}

function PlayerRow({ player, isMe, viewerIsHost, onKick, onRename }) {
	function commitRename(event) {
		const username = event.currentTarget.value.trim();
		if (username && username !== player.username) onRename(username);
	}

	return (
		<div className={`lobby-player-row ${isMe ? 'is-me' : ''}`}>
			<span
				className={`lobby-player-presence ${player.connected === false ? 'is-offline' : ''}`}
				style={{ background: player.color }}
			/>
			<div className="lobby-player-identity">
				{isMe ? (
					<input
						aria-label="Your username"
						defaultValue={player.username}
						maxLength={24}
						onBlur={commitRename}
						onKeyDown={(event) => {
							if (event.key === 'Enter') event.currentTarget.blur();
						}}
					/>
				) : (
					<strong>{player.username}</strong>
				)}
				{player.isHost && <span className="lobby-player-badge is-host">Host</span>}
				{isMe && <span className="lobby-player-badge is-you">You</span>}
				{player.connected === false && (
					<span className="lobby-player-badge is-offline">Disconnected</span>
				)}
			</div>
			<span className="lobby-player-state">
				{player.connected === false ? 'Offline' : 'Online'}
			</span>
			{viewerIsHost && !player.isHost && !isMe && (
				<button
					className="lobby-kick-button"
					type="button"
					onClick={onKick}
					aria-label={`Remove ${player.username}`}
				>
					<X aria-hidden="true" />
				</button>
			)}
		</div>
	);
}

function SummaryMetric({ label, value }) {
	return (
		<div className="lobby-summary-metric">
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}

function SettingsCard({ room, isHost, act }) {
	const rules = room.rules;
	const setRule = (key, value) => isHost && act('update-rules', { rules: { [key]: value } });

	return (
		<section className="lobby-panel lobby-settings-card">
			<div className="lobby-settings-group">
				<SectionHead icon={Settings} label="Game settings" />
				<div className="lobby-static-settings">
					<StaticSettingRow icon={Users} label="Maximum players" value={MAX_PLAYERS} />
					<StaticSettingRow
						icon={LockKeyhole}
						label="Room access"
						value="Code required"
					/>
					<StaticSettingRow
						icon={Bot}
						label="Allow bots to join"
						value="Off"
						badge="Unavailable"
						muted
					/>
					<StaticSettingRow icon={UserCheck} label="Login required" value="Off" muted />
					<StaticSettingRow
						icon={Map}
						label="Board map"
						value={room.board?.name || 'Board'}
					/>
				</div>
			</div>

			<div className="lobby-settings-divider" />
			<div className="lobby-settings-group">
				<SectionHead icon={Scale} label="Game rules" />
				<div className="lobby-rule-list">
					<NumRow
						label="Starting cash"
						value={rules.startingCash}
						step={100}
						disabled={!isHost}
						onChange={(value) => setRule('startingCash', value)}
					/>
					<NumRow
						label="GO salary"
						value={rules.salary}
						step={50}
						disabled={!isHost}
						onChange={(value) => setRule('salary', value)}
					/>
					<ToggleRow
						label="Double on GO"
						value={rules.doubleOnGo}
						disabled={!isHost}
						onChange={(value) => setRule('doubleOnGo', value)}
					/>
					<ToggleRow
						label="Free parking pot"
						value={rules.freeParkingPot}
						disabled={!isHost}
						onChange={(value) => setRule('freeParkingPot', value)}
					/>
					<ToggleRow
						label="Auction on declined buy"
						value={rules.auctionUnbought}
						disabled={!isHost}
						onChange={(value) => setRule('auctionUnbought', value)}
					/>
					<ToggleRow
						label="No rent while owner in jail"
						value={rules.noRentInJail}
						disabled={!isHost}
						onChange={(value) => setRule('noRentInJail', value)}
					/>
					<ToggleRow
						label="Even building within group"
						value={rules.evenBuild}
						disabled={!isHost}
						onChange={(value) => setRule('evenBuild', value)}
					/>
					<ToggleRow
						label="Random turn order"
						value={rules.randomTurnOrder}
						disabled={!isHost}
						onChange={(value) => setRule('randomTurnOrder', value)}
					/>
					<NumRow
						label="Jail fine"
						value={rules.jailFine}
						step={10}
						disabled={!isHost}
						onChange={(value) => setRule('jailFine', value)}
					/>
				</div>
			</div>
		</section>
	);
}

function StaticSettingRow({ icon: Icon, label, value, badge, muted = false }) {
	return (
		<div className={`lobby-static-setting ${muted ? 'is-muted' : ''}`}>
			<Icon aria-hidden="true" />
			<span>{label}</span>
			{badge && <small>{badge}</small>}
			<strong>{value}</strong>
		</div>
	);
}

function ToggleRow({ label, value, onChange, disabled }) {
	return (
		<div className={`lobby-rule-row ${disabled ? 'is-disabled' : ''}`}>
			<span>{label}</span>
			<button
				className="lobby-toggle"
				type="button"
				onClick={() => onChange(!value)}
				disabled={disabled}
				aria-label={`${label}: ${value ? 'on' : 'off'}`}
				aria-pressed={value}
			>
				<span />
			</button>
		</div>
	);
}

function NumRow({ label, value, step = 1, disabled, onChange }) {
	return (
		<div className={`lobby-rule-row lobby-number-rule ${disabled ? 'is-disabled' : ''}`}>
			<span>{label}</span>
			<div>
				<button
					type="button"
					disabled={disabled}
					onClick={() => onChange(Math.max(0, value - step))}
					aria-label={`Decrease ${label}`}
				>
					−
				</button>
				<strong>${value}</strong>
				<button
					type="button"
					disabled={disabled}
					onClick={() => onChange(value + step)}
					aria-label={`Increase ${label}`}
				>
					+
				</button>
			</div>
		</div>
	);
}

function LobbyFooterStrip({ isHost }) {
	const items = [
		{
			icon: Crown,
			title: 'Customize your experience',
			copy: 'Set rules that make your game unique',
		},
		{ icon: ShieldCheck, title: 'Fair play', copy: 'Anti-cheat active' },
		{ icon: LockKeyhole, title: 'Secure game', copy: 'Room code protected' },
		{ icon: Zap, title: 'Smooth play', copy: 'Real-time multiplayer' },
		{
			icon: UserRound,
			title: isHost ? 'Active host' : 'Connected player',
			copy: isHost ? "You're in control" : "You're at the table",
		},
	];

	return (
		<footer className="lobby-footer-strip">
			{items.map(({ icon: Icon, title, copy }) => (
				<div key={title} className="lobby-footer-item">
					<span>
						<Icon aria-hidden="true" />
					</span>
					<div>
						<strong>{title}</strong>
						<small>{copy}</small>
					</div>
				</div>
			))}
		</footer>
	);
}
