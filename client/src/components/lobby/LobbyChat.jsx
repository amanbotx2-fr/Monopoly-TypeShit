import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';

export default function LobbyChat({ chat, sendChat, me }) {
	const [text, setText] = useState('');
	const scrollRef = useRef(null);

	useEffect(() => {
		const chatLog = scrollRef.current;
		if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
	}, [chat]);

	function submit(event) {
		event.preventDefault();
		const message = text.trim();
		if (!message || !me) return;
		sendChat(message);
		setText('');
	}

	return (
		<section className="lobby-panel lobby-chat-card">
			<div className="lobby-section-heading lobby-chat-heading">
				<span>Chat</span>
				<span>{chat.length}</span>
			</div>

			<div className="lobby-chat-log" ref={scrollRef} aria-live="polite">
				{chat.length === 0 ? (
					<div className="lobby-chat-empty">
						<MessageSquare aria-hidden="true" />
						<strong>No messages yet</strong>
						<span>Start the conversation!</span>
					</div>
				) : (
					chat.map((message) => (
						<div
							key={message.id}
							className={`lobby-chat-message ${message.system ? 'is-system' : ''}`}
						>
							{!message.system && <strong>{message.username}</strong>}
							<span>{message.text}</span>
						</div>
					))
				)}
			</div>

			<form className="lobby-chat-form" onSubmit={submit}>
				<div>
					<input
						aria-label="Chat message"
						disabled={!me}
						placeholder="Type a message..."
						value={text}
						onChange={(event) => setText(event.target.value.slice(0, 500))}
					/>
					<button type="submit" disabled={!me || !text.trim()} aria-label="Send message">
						<Send aria-hidden="true" />
					</button>
				</div>
				<small>
					{me ? 'Only game players can send messages' : 'Spectators cannot send messages'}
				</small>
			</form>
		</section>
	);
}
