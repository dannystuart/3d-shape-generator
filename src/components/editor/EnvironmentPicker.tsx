"use client";

import { thumbUrl } from "@/data/thumbs";
import { ENVIRONMENTS } from "@/engine/environments";
import { Tile } from "./Tiles";

export interface EnvironmentPickerProps {
  value: string;
  query?: string;
  disabled?: boolean;
  /** Environments that failed to load this session, for a quiet note on the tile. */
  failed?: Set<string>;
  onPick: (id: string) => void;
}

export function EnvironmentPicker({ value, query = "", disabled, failed, onPick }: EnvironmentPickerProps) {
  const q = query.trim().toLowerCase();
  const shown = ENVIRONMENTS.filter((e) => !q || e.name.toLowerCase().includes(q));
  return (
    <div className="sg-grid px-3.5" data-cols="6">
      {shown.map((e) => (
        <Tile key={e.id} name={failed?.has(e.id) ? `${e.name} (couldn't load)` : e.name} pressed={value === e.id} src={thumbUrl("environments", e.id)} onPick={() => onPick(e.id)} disabled={disabled} round />
      ))}
    </div>
  );
}
