// Full-page / inline logo loader. The weaveOS mark pulses in place — used as
// the visual during route transitions (via app/loading.tsx) and as an explicit
// inline loader when something is mid-flight.

import type { CSSProperties } from "react";

type LogoLoaderProps = {
  /** Fullscreen overlay with backdrop. Default: false (inline). */
  fullscreen?: boolean;
  /** Logo size in px. Default 48. */
  size?: number;
  /** Optional caption shown below the mark. */
  label?: string;
};

/** Just the X mark from logo.svg (paths extracted so it can be sized cleanly). */
function LogoMark({ size, style }: { size: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      aria-hidden
    >
      <path
        d="M18.2011 21.1145L16.9941 22.3206L12.8212 18.1477V25.594H11.1142V18.1477L6.94036 22.3206L5.73431 21.1145L11.9677 14.8811L18.2011 21.1145ZM10.7607 13.6741L4.52728 19.9075L3.32122 18.7014L7.49407 14.5276L0.000909805 14.5266V12.8215L7.49407 12.8206L3.32122 8.64673L4.52728 7.44067L10.7607 13.6741ZM20.6142 8.64673L16.4404 12.8206L23.8876 12.8215L23.8886 13.6741L23.8876 14.5266L16.4404 14.5276L20.6142 18.7014L19.4072 19.9075L13.1738 13.6741L19.4072 7.44067L20.6142 8.64673ZM12.8202 1.7063L12.8212 9.20044L16.9941 5.02661L18.2011 6.23364L11.9677 12.467L5.73431 6.23364L6.94036 5.02661L11.1142 9.20044V1.7063L11.9677 1.70532L12.8202 1.7063Z"
        fill="white"
      />
    </svg>
  );
}

export function LogoLoader({ fullscreen = false, size = 48, label }: LogoLoaderProps) {
  const mark = (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: `${size}px`, height: `${size}px` }}>
        {/* Outer rotating ring matching the X mark's blue accent. */}
        <div
          className="absolute inset-0 rounded-full logo-loader-rotate"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(48,100,255,0.55) 90deg, transparent 180deg)",
            mask: "radial-gradient(circle, transparent 60%, black 62%)",
            WebkitMask: "radial-gradient(circle, transparent 60%, black 62%)",
          }}
        />
        {/* Centred mark pulsing. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <LogoMark size={Math.floor(size * 0.62)} style={{}} />
        </div>
        {/* Subtle outer scale pulse via class. */}
        <div className="absolute inset-0 logo-loader" />
      </div>
      {label && (
        <span className="text-[12px] text-[#5a5a5a] font-medium tracking-wider uppercase">
          {label}
        </span>
      )}
    </div>
  );

  if (!fullscreen) return mark;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a]/85 backdrop-blur-sm fade-in">
      {mark}
    </div>
  );
}
