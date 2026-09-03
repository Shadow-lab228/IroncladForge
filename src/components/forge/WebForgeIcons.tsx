import React from 'react';

type IconProps = {
  size?: number;
  color?: string;
  className?: string;
};

export function AnvilIcon({ size = 40, color = '#9aa3ab', className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      {/* Anvil body */}
      <path d="M10 44h44v6H10z" fill={color} />
      {/* Top plate (working face) */}
      <path d="M12 44V38h40v6H12z" fill={color} opacity="0.85" />
      {/* Horn */}
      <path d="M52 40L58 34l3 5-6 5z" fill={color} opacity="0.7" />
      {/* Front taper */}
      <path d="M12 40V36l5 3z" fill={color} opacity="0.6" />
      {/* Spike/step */}
      <rect x="18" y="35" width="6" height="9" fill={color} opacity="0.55" />
      {/* Base block */}
      <rect x="20" y="50" width="24" height="4" rx="1" fill={color} opacity="0.5" />
    </svg>
  );
}

export function HammerIcon({ size = 40, color = '#b8a98a', className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      {/* Head */}
      <rect x="10" y="18" width="34" height="14" rx="2" fill={color} />
      <path d="M42 20h5v0l3 3-3 3h-5z" fill={color} opacity="0.8" />
      {/* Eye / striking face highlight */}
      <rect x="18" y="21" width="12" height="8" rx="1" fill="#2a2320" opacity="0.6" />
      {/* Handle */}
      <path d="M34 32h6l-8 26h-1z" fill="#6b4f2a" />
      <path d="M33.5 32h2l-2 26h-1z" fill="#52381c" />
    </svg>
  );
}

export function EmberIcon({ size = 16, color = '#ff7a1a', className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="3.4" fill={color} />
      <circle cx="8" cy="8" r="1.4" fill="#ffb347" />
    </svg>
  );
}

export function SparkIcon({ size = 12, color = '#ffd89b', className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" fill="none" className={className}>
      <path
        d="M4 0c.4 1.6.6 2 2 2-1.4.4-1.8.8-2 2-.2-1.2-.6-1.6-2-2 1.4-.4 1.8-.8 2-2z"
        fill={color}
      />
    </svg>
  );
}

export function FlameIcon({ size = 20, color = '#ff7a1a', className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2c1.2 2.6 5 5 5 9a5 5 0 0 1-10 0c0-1.8.8-3.4 2-4.6.2 1 .6 1.6 1.4 2.2C10.2 7 10.6 4.6 12 2z"
        fill={color}
      />
      <path
        d="M12 22a4 4 0 0 1-4-4c0-1.6 1-2.8 2-3.6.3.9.8 1.4 1.6 1.8-.4-.7-.3-1.4.2-2.2.4 1 .8 1.5 1.6 1.9.9.7 1.6 1.5 1.6 2.6a4 4 0 0 1-4 3.5z"
        fill={color}
        opacity="0.85"
      />
    </svg>
  );
}
