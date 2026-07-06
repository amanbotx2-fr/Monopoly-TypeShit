import React from 'react';

export default function BrandLogo({
    size = 34,
    showText = true,
    showSubtitle = true,
    className = '',
    style,
}) {
    return (
        <div className={`brand-logo ${className}`.trim()} style={style}>
            <img
                className="brand-logo-mark"
                src="/brand-mark.png"
                alt="MONOPOLY logo"
                style={{ width: size, height: size }}
            />
            {showText && (
                <div className="brand-logo-copy">
                    <div className="brand-logo-title">MONOPOLY</div>
                    {showSubtitle && (
                        <div className="brand-logo-subtitle">Multiplayer Strategy Platform</div>
                    )}
                </div>
            )}
        </div>
    );
}
