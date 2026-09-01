"use client";

import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Spec } from "@/engine/spec";

export interface LightPadProps {
  x: number;
  y: number;
  disabled?: boolean;
  onChange: (patch: Pick<Spec, "keyX" | "keyY">) => void;
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const snap = (v: number) => Math.round(v * 100) / 100;

/**
 * A square you drag a dot around to place the key light: left-right sweeps it
 * around the shape, up-down lifts it from the floor to overhead.
 */
export function LightPad({ x, y, disabled, onChange }: LightPadProps) {
  const fromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1);
    const py = clamp(1 - ((event.clientY - rect.top) / rect.height) * 2);
    onChange({ keyX: snap(px), keyY: snap(py) });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    fromPointer(event);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    fromPointer(event);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = event.shiftKey ? 0.2 : 0.05;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onChange({ keyX: snap(clamp(x + move[0])), keyY: snap(clamp(y + move[1])) });
  };

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Light position"
      aria-valuetext={`${Math.round(x * 100)} across, ${Math.round(y * 100)} up`}
      aria-valuenow={Math.round(x * 100)}
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-disabled={disabled || undefined}
      className="sg-pad"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <span className="sg-pad__dot" style={{ left: `${((x + 1) / 2) * 100}%`, top: `${((1 - y) / 2) * 100}%` }} aria-hidden />
    </div>
  );
}
