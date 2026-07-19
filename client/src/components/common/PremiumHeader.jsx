import React from 'react';
import { LogIn, ShoppingCart } from 'lucide-react';
import SoundToggle from '../game/SoundToggle';
import './PremiumHeader.css';

export default function PremiumHeader({ pushToast, showLogo = false, onLogoClick }) {
	function announceComingSoon(label) {
		pushToast(`${label} is coming soon`, 'info');
	}

	return (
		<header className="landing-header premium-header">
			<SoundToggle />
			{showLogo && (
				<button
					className="premium-header-logo"
					type="button"
					onClick={onLogoClick}
					aria-label="Go to home page"
				>
					<img src="/brand-mark.png" alt="" />
				</button>
			)}
			<nav className="landing-nav" aria-label="Account navigation">
				<button
					type="button"
					aria-label="Store"
					onClick={() => announceComingSoon('Store')}
				>
					<ShoppingCart aria-hidden="true" />
					<span>Store</span>
				</button>
				<button
					type="button"
					aria-label="Login"
					onClick={() => announceComingSoon('Login')}
				>
					<LogIn aria-hidden="true" />
					<span>Login</span>
				</button>
			</nav>
		</header>
	);
}
