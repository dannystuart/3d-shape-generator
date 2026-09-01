"use client";

import { useState } from "react";
import { thumbUrl } from "@/data/thumbs";
import { SHAPES } from "@/engine/shapes/catalogue";
import { SvgUpload } from "./SvgUpload";
import { Chips, Tile } from "./Tiles";

export interface ShapePickerProps {
  value: string;
  /** The current upload's path data, for the Yours tile. */
  svg: string;
  query?: string;
  disabled?: boolean;
  onPick: (id: string) => void;
  onUpload: (pathData: string, name: string) => void;
  onError: (message: string) => void;
}

const FAMILIES = [
  { value: "all", label: "All" },
  { value: "solid", label: "Solid" },
  { value: "flat", label: "Flat" },
  { value: "custom", label: "Yours" },
];

export function ShapePicker({ value, svg, query = "", disabled, onPick, onUpload, onError }: ShapePickerProps) {
  const [family, setFamily] = useState("all");
  const q = query.trim().toLowerCase();
  const shown = SHAPES.filter((s) => (family === "all" || s.family === family) && (!q || s.name.toLowerCase().includes(q) || s.keywords.some((k) => k.includes(q))));

  return (
    <div>
      <Chips chips={FAMILIES} value={family} onChange={setFamily} />
      {family === "custom" ? (
        // Yours is where an upload lives, so it is where the upload happens:
        // one place, not an upload chip in one row and its result in another.
        <>
          <div className="sg-grid px-3.5" data-cols="4">
            {svg ? (
              <Tile name="Your shape" pressed={value === "custom"} onPick={() => onPick("custom")} disabled={disabled}>
                <svg viewBox="-5 -5 110 110" className="h-full w-full p-2" aria-hidden>
                  <path d={svg} fill="#e8e6e1" fillRule="nonzero" vectorEffect="non-scaling-stroke" />
                </svg>
              </Tile>
            ) : null}
            <SvgUpload onUpload={onUpload} onError={onError} disabled={disabled} className="sg-tile sg-tile--upload">
              <span className="text-[18px] leading-none" aria-hidden>
                ⬆
              </span>
              <span className="text-[9.5px] leading-tight">{svg ? "Replace SVG" : "Upload SVG"}</span>
            </SvgUpload>
          </div>
          <p className="px-3.5 pt-2 text-[10.5px] leading-snug text-sg-faint">
            {svg ? "Your upload, with the same thickness, rounding and twist dials as every flat shape." : "Upload an SVG — or drop one on the shape — and it lands here with the same thickness, rounding and twist dials as every flat shape. Filled shapes only; outline any strokes first."}
          </p>
        </>
      ) : (
        <div className="sg-grid px-3.5" data-cols="4">
          {shown.map((s) => (
            <Tile key={s.id} name={s.name} pressed={value === s.id} src={thumbUrl("shapes", s.id)} onPick={() => onPick(s.id)} disabled={disabled} />
          ))}
        </div>
      )}
    </div>
  );
}
