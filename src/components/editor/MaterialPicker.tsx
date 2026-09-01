"use client";

import { useState } from "react";
import { thumbUrl } from "@/data/thumbs";
import { MATERIALS } from "@/engine/materials";
import { Chips, Tile } from "./Tiles";

export interface MaterialPickerProps {
  value: string;
  query?: string;
  disabled?: boolean;
  onPick: (id: string) => void;
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "solid", label: "Solid" },
  { value: "metal", label: "Metal" },
  { value: "glass", label: "Glass" },
  { value: "neon", label: "Neon" },
  { value: "special", label: "Special" },
  { value: "texture", label: "Texture" },
];

export function MaterialPicker({ value, query = "", disabled, onPick }: MaterialPickerProps) {
  const [category, setCategory] = useState("all");
  const q = query.trim().toLowerCase();
  const shown = MATERIALS.filter((m) => (category === "all" || m.category === category) && (!q || m.name.toLowerCase().includes(q)));
  return (
    <div>
      <Chips chips={CATEGORIES} value={category} onChange={setCategory} />
      <div className="sg-grid px-3.5" data-cols="6">
        {shown.map((m) => (
          <Tile key={m.id} name={m.name} pressed={value === m.id} src={thumbUrl("materials", m.id)} onPick={() => onPick(m.id)} disabled={disabled} round />
        ))}
      </div>
    </div>
  );
}
