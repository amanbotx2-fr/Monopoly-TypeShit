import React, { useEffect } from 'react';
import { HelpCircle, Package } from 'lucide-react';
import './CardModal.css';

// Ephemeral card draw reveal. Shows for 3s unless clicked away.
export default function CardModal({ deck, text, onClose }) {
	useEffect(() => {
		const t = setTimeout(onClose, 3500);
		return () => clearTimeout(t);
	}, [onClose]);

	const isChance = deck === 'chance';
	const Icon = isChance ? HelpCircle : Package;

	return (
		<Overlay onClose={onClose}>
			<div
				className="modal-panel fade-in"
				style={{
					width: 320,
					padding: 24,
					borderRadius: 'var(--radius-lg)',
					border: `1px solid ${isChance ? 'var(--warning)' : 'var(--accent-2)'}`,
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
					<Icon size={22} color={isChance ? 'var(--warning)' : 'var(--accent-2)'} />
					<div style={{ fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>
						{isChance ? 'Surprise' : 'Treasure'}
					</div>
				</div>
				<div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)', minHeight: 50 }}>
					{text}
				</div>
				<div className="card-modal-actions">
					<button
						className="btn auction card-modal-continue"
						type="button"
						onClick={onClose}
					>
						Continue
					</button>
				</div>
			</div>
		</Overlay>
	);
}

function Overlay({ children, onClose }) {
	return (
		<div
			onClick={onClose}
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 100,
				background: 'rgba(0,0,0,0.6)',
				display: 'grid',
				placeItems: 'center',
				animation: 'fadeIn 0.15s ease-out',
			}}
		>
			<div onClick={(e) => e.stopPropagation()}>{children}</div>
		</div>
	);
}
