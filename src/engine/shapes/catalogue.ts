import type { BufferGeometry } from "three";
import type { Spec } from "../spec";
import { extrudePath } from "./extrude";
import { FLAT_SHAPES, dynamicPath } from "./flat";
import { SOLID_SHAPES } from "./solids";
import type { Dial } from "./solids";

export type Family = "flat" | "solid" | "custom";

export interface ShapeEntry {
  id: string;
  name: string;
  family: Family;
  keywords: string[];
  dials: Dial[];
  note?: string;
  /** Flat shapes use thickness/rounding/twist; solids ignore them. */
  usesExtrude: boolean;
}

const DYNAMIC_DIALS: Dial[] = [
  { key: "shapeA", label: "Sides", min: 3, max: 64, step: 1, default: 4 },
  { key: "shapeB", label: "Corner", min: 0, max: 1, step: 0.01, default: 0.5 },
];

const flat: ShapeEntry[] = FLAT_SHAPES.map((s) => ({
  id: s.id,
  name: s.name,
  family: "flat",
  keywords: s.keywords ?? [],
  dials: s.id === "dynamic" ? DYNAMIC_DIALS : [],
  usesExtrude: true,
}));

const solid: ShapeEntry[] = SOLID_SHAPES.map((s) => ({
  id: s.id,
  name: s.name,
  family: "solid",
  keywords: s.keywords ?? [],
  dials: s.dials,
  note: s.note,
  usesExtrude: false,
}));

export const CUSTOM: ShapeEntry = { id: "custom", name: "Your shape", family: "custom", keywords: [], dials: [], usesExtrude: true };

/** Solids first: the first thing on screen is a sphere, and the grid should open on the 3D ones. */
export const SHAPES: ShapeEntry[] = [...solid, ...flat];

export function shapeById(id: string): ShapeEntry {
  if (id === "custom") return CUSTOM;
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0];
}

export const shapeDials = (entry: ShapeEntry): Dial[] => entry.dials;

/** The dial values a freshly picked shape should start on. */
export function shapeDialDefaults(entry: ShapeEntry): Pick<Spec, "shapeA" | "shapeB" | "shapeC"> {
  const out = { shapeA: 0.5, shapeB: 0.5, shapeC: 0.5 };
  for (const d of entry.dials) out[d.key] = d.default;
  return out;
}

export function buildShape(spec: Spec): BufferGeometry {
  const extrude = { thickness: spec.thickness, rounding: spec.rounding, twist: spec.twist };
  if (spec.shape === "custom" && spec.svg) return extrudePath(spec.svg, extrude);
  const entry = shapeById(spec.shape);
  // Dials are clamped into their own ranges and snapped to their step: a spec
  // from a URL or an old save can carry another shape's values, and a torus
  // with half a side is invisible while half a twist leaves a seam.
  const dial = (key: Dial["key"]) => {
    const d = entry.dials.find((x) => x.key === key);
    if (!d) return spec[key];
    const v = Math.min(Math.max(spec[key], d.min), d.max);
    return Math.round((v - d.min) / d.step) * d.step + d.min;
  };
  if (entry.family === "solid") return SOLID_SHAPES.find((s) => s.id === entry.id)!.build(dial("shapeA"), dial("shapeB"), dial("shapeC"));
  const flatEntry = FLAT_SHAPES.find((s) => s.id === entry.id)!;
  const path = entry.id === "dynamic" ? dynamicPath(Math.round(dial("shapeA")), dial("shapeB")) : flatEntry.path;
  return extrudePath(path, extrude);
}
