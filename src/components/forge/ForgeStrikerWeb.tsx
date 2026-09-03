import React, { useEffect, useState } from 'react';
import { AnvilIcon, HammerIcon, EmberIcon } from './WebForgeIcons';

interface ForgeStrikerProps {
  active: boolean;
  size?: number;
  strikeCount?: number;
}

export function ForgeStrikerWeb({ active, size = 180, strikeCount = 0 }: ForgeStrikerProps) {
  const [sparks, setSparks] = useState<Array<{ id: number; dx: number; dy: number; color: string }>>([]);

  useEffect(() => {
    if (!active) {
      setSparks([]);
      return;
    }

    const interval = setInterval(() => {
      const newSparks = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        dx: (Math.random() - 0.5) * 120,
        dy: -(Math.random() * 60 + 20),
        color: ['#ffd89b', '#ff7a1a', '#ffb347', '#ff3300', '#ffffff'][Math.floor(Math.random() * 5)],
      }));
      setSparks(newSparks);
    }, 900);

    return () => clearInterval(interval);
  }, [active]);

  return (
    <div
      className="relative flex flex-col items-center justify-center p-6 rounded-xl border border-[#352d28] bg-[#161210] overflow-hidden"
      style={{ width: size * 1.6, height: size * 1.3 }}
    >
      {/* Background forge glow */}
      <div
        className={`absolute inset-0 bg-radial from-[#ff7a1a]/20 via-[#d43c12]/5 to-transparent transition-opacity duration-700 pointer-events-none ${
          active ? 'opacity-100 animate-ember-glow' : 'opacity-20'
        }`}
      />

      {/* Sparks layer */}
      {sparks.map((spark) => (
        <div
          key={spark.id}
          className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
          style={
            {
              backgroundColor: spark.color,
              boxShadow: `0 0 6px ${spark.color}`,
              top: '52%',
              left: '48%',
              '--dx': `${spark.dx}px`,
              '--dy': `${spark.dy}px`,
              animation: 'sparkFly 0.8s ease-out forwards',
            } as React.CSSProperties
          }
        />
      ))}

      {/* Striking hammer */}
      <div className={`relative z-10 transition-transform ${active ? 'animate-hammer' : ''}`}>
        <HammerIcon size={size * 0.45} color={active ? '#ffd89b' : '#b8a98a'} />
      </div>

      {/* Anvil */}
      <div className="relative z-10 -mt-2">
        <AnvilIcon size={size * 0.55} color={active ? '#b0bac4' : '#9aa3ab'} />
      </div>

      {/* Strike Counter Badge */}
      {active && (
        <div className="absolute bottom-2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1f1a17] border border-[#ff7a1a]/40 text-xs font-mono text-[#ffb347]">
          <EmberIcon size={10} color="#ff7a1a" />
          <span>STRIKE #{strikeCount > 0 ? strikeCount : 1}</span>
        </div>
      )}
    </div>
  );
}
