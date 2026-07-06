import React from 'react';

const KIND_COLORS = {
    error:   'var(--danger)',
    success: 'var(--success)',
    info:    'var(--accent)',
};

export default function Toasts({ toasts }) {
    return (
        <div style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
            display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
        }}>
            {toasts.map(t => (
                <div key={t.id} className="slide-up" style={{
                    padding: '11px 14px',
                    background: 'var(--surface-2)',
                    border: `1px solid ${KIND_COLORS[t.kind] || 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontWeight: 500,
                    boxShadow: 'var(--shadow-lg)',
                    maxWidth: 360,
                    outline: `1px solid color-mix(in oklch, ${KIND_COLORS[t.kind] || 'var(--border)'} 24%, transparent)`,
                }}>{t.text}</div>
            ))}
        </div>
    );
}
