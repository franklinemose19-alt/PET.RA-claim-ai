// src/components/SplashScreen.jsx
//
// PET.RA Claims AI — Splash Screen
//
// Shows briefly on first app load: logo, animated shield icon, tagline,
// subtle glow. Auto-dismisses after a fixed delay (or sooner if auth
// state resolves first), then hands off to the normal app routing.

import { useState, useEffect } from 'react';

const MIN_DISPLAY_MS = 1400;

export default function SplashScreen({ onFinish }) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), MIN_DISPLAY_MS);
    const finishTimer = setTimeout(() => onFinish(), MIN_DISPLAY_MS + 400);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#0B0E13] transition-opacity duration-400 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center">
        <ShieldMark />
        <h1 className="font-mono text-2xl tracking-wide text-white mt-6">
          PET<span className="text-[#E8A33D]">.</span>RA
        </h1>
        <p className="text-[#8B93A1] text-sm mt-2 tracking-wide">
          AI-Powered Claims Infrastructure
        </p>
      </div>
    </div>
  );
}

function ShieldMark() {
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-[#E8A33D]/20 blur-2xl animate-pulse" />
      <svg width="64" height="72" viewBox="0 0 64 72" fill="none" className="relative">
        <path
          d="M32 2 L60 14 V36 C60 54 48 64 32 70 C16 64 4 54 4 36 V14 Z"
          stroke="url(#shieldGradient)"
          strokeWidth="2.5"
          fill="rgba(232,163,61,0.05)"
        />
        <path
          d="M20 34 L28 42 L44 24"
          stroke="#E8A33D"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <defs>
          <linearGradient id="shieldGradient" x1="0" y1="0" x2="64" y2="72">
            <stop offset="0%" stopColor="#5B8DEF" />
            <stop offset="100%" stopColor="#E8A33D" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
