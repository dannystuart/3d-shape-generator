"use client";

import { BACKDROPS, backdropMatching } from "@/engine/backdrops";
import type { Spec } from "@/engine/spec";
import { Tile } from "./Tiles";

export interface BackdropPickerProps {
  spec: Pick<Spec, "backdrop" | "backdropColor" | "backdropColor2" | "backdropAngle">;
  onPick: (patch: Pick<Spec, "backdrop" | "backdropColor" | "backdropColor2" | "backdropAngle">) => void;
  disabled?: boolean;
}

/** A row of gradient swatches; picking one sets the backdrop's three dials at once. Drawn in CSS — the same two colours the engine paints. */
export function BackdropPicker({ spec, onPick, disabled }: BackdropPickerProps) {
  const current = backdropMatching(spec);
  return (
    <div className="sg-grid px-3.5" data-cols="8">
      {BACKDROPS.map((b) => (
        <Tile key={b.id} name={b.name} pressed={current === b.id} disabled={disabled} round onPick={() => onPick({ backdrop: "gradient", backdropColor: b.color, backdropColor2: b.color2, backdropAngle: b.angle })}>
          <span aria-hidden className="block h-full w-full" style={{ background: `linear-gradient(${b.angle}deg, ${b.color}, ${b.color2})` }} />
        </Tile>
      ))}
    </div>
  );
}
