import React from 'react';
import './TokenPicker.css';

export default function TokenPicker({ tokens, value, onChange, disabledHexes = [] }) {
	return (
		<div className="token-picker" role="group" aria-label="Token color">
			{tokens.map((t) => {
				const disabled = disabledHexes.includes(t.hex) && t.hex !== value;
				const selected = value === t.hex;
				return (
					<button
						key={t.id}
						type="button"
						onClick={() => !disabled && onChange(t.hex)}
						disabled={disabled}
						title={disabled ? `${t.name} (taken)` : t.name}
						aria-label={`${t.name}${disabled ? ', taken' : ''}`}
						aria-pressed={selected}
						className={`token-picker-option ${selected ? 'is-selected' : ''}`}
						style={{ '--token-color': t.hex }}
					/>
				);
			})}
		</div>
	);
}
