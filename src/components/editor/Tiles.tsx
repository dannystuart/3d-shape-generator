"use client";

import type { ReactNode } from "react";

export interface Chip {
  value: string;
  label: string;
}

/** The filter chips above a grid. */
export function Chips({ chips, value, onChange, trailing }: { chips: Chip[]; value: string; onChange: (v: string) => void; trailing?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-2">
      {chips.map((chip) => (
        <button key={chip.value} type="button" className="sg-chip" data-on={chip.value === value ? "" : undefined} onClick={() => onChange(chip.value)}>
          {chip.label}
        </button>
      ))}
      {trailing}
    </div>
  );
}

export interface TileProps {
  name: string;
  pressed: boolean;
  onPick: () => void;
  src?: string;
  round?: boolean;
  children?: ReactNode;
  disabled?: boolean;
}

/** One picture in a picker grid. */
export function Tile({ name, pressed, onPick, src, round, children, disabled }: TileProps) {
  return (
    <button type="button" className="sg-tile" aria-pressed={pressed} aria-label={name} title={name} disabled={disabled} onClick={onPick} style={round ? { borderRadius: "50%" } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element -- plain pictures from /public, no optimisation wanted */}
      {src ? <img src={src} alt="" loading="lazy" draggable={false} /> : children}
      {!round ? <span className="sg-tile__name">{name}</span> : null}
    </button>
  );
}
