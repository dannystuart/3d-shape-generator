"use client";

import { thumbUrl } from "@/data/thumbs";
import { FINISHES, TEXTURES, TONES } from "@/engine/effects/index";
import type { EffectSlot } from "@/engine/effects/index";
import { Tile } from "./Tiles";

export interface EffectPickerProps {
  value: string;
  /** Which of the two slots this picks for. */
  slot?: EffectSlot;
  query?: string;
  disabled?: boolean;
  /** Effects whose shader would not compile here this session. */
  failed?: Set<string>;
  onPick: (id: string) => void;
}

export function EffectPicker({ value, slot = "texture", query = "", disabled, failed, onPick }: EffectPickerProps) {
  const q = query.trim().toLowerCase();
  const list = slot === "tone" ? TONES : slot === "finish" ? FINISHES : TEXTURES;
  const shown = list.filter((e) => !q || e.name.toLowerCase().includes(q));
  return (
    <div className="sg-grid px-3.5" data-cols={slot === "texture" ? "6" : "4"}>
      {shown.map((e) => (
        <Tile key={e.id} name={failed?.has(e.id) ? `${e.name} (not supported here)` : e.name} pressed={value === e.id} src={thumbUrl("effects", e.id)} onPick={() => onPick(e.id)} disabled={disabled || failed?.has(e.id)} />
      ))}
    </div>
  );
}
