/**
 * One shape, one recipe.
 *
 * Everything on screen is this one flat object. Every preset in every panel is
 * a fragment of it, and the preview, the snippet, the PNG and the prompt are all
 * produced from it by the same engine. Keys are the engine's words and never
 * change; the labels people read live in PARAM_META below.
 */
export type Section = "shape" | "material" | "lighting" | "adjust" | "effect" | "backdrop" | "camera";

export type LightMode = "environment" | "directional";
export type BackdropMode = "solid" | "gradient" | "transparent";
export type EffectId =
  | "none"
  | "pixelate"
  | "dither"
  | "halftone"
  | "ascii"
  | "duotone"
  | "posterize"
  | "threshold"
  | "outline"
  | "blur"
  | "chromatic"
  | "chromablur";

export interface Spec {
  // --- shape ---
  /** A catalogue id, or "custom" when `svg` carries an upload. */
  shape: string;
  /** SVG path data (the `d` attribute, possibly several joined with spaces) for an uploaded shape. */
  svg: string;
  /** Extrusion depth for flat shapes, 0..1 of the shape's width. */
  thickness: number;
  /** Bevel: 0 = sharp edge, 1 = fully pillowed. */
  rounding: number;
  /** Degrees of twist along the extrusion axis. */
  twist: number;
  /** Three per-shape dials; the catalogue names them. */
  shapeA: number;
  shapeB: number;
  shapeC: number;

  // --- material ---
  /** The swatch the dials were last set from, or "custom". */
  material: string;
  color: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  transmission: number;
  /** World units of glass for refraction and absorption. */
  glassThickness: number;
  ior: number;
  glowColor: string;
  glow: number;
  iridescence: number;
  sheen: number;
  sheenColor: string;
  /** Faceted shading, for the low-poly look. */
  flat: boolean;
  /** The bumps and grooves: a surfaces.ts id. */
  surface: string;
  /** Tiles across the shape. */
  surfaceScale: number;
  /** How far the surface leans the light, 0..1. */
  surfaceDepth: number;

  // --- lighting ---
  environment: string;
  envIntensity: number;
  envBlur: number;
  envRotation: number;
  lightMode: LightMode;
  /** Light pad position, -1..1 each. x → azimuth, y → elevation. */
  keyX: number;
  keyY: number;
  keyIntensity: number;
  keyColor: string;

  // --- adjust ---
  exposure: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  temperature: number;
  tint: number;

  // --- effect ---
  effect: EffectId;
  /** Three per-effect dials; effects/index.ts names them. */
  effectA: number;
  effectB: number;
  effectC: number;
  effectColor1: string;
  effectColor2: string;
  /** The colour slot: a second pass after the texture one, in a fixed order. */
  tone: EffectId;
  toneA: number;
  toneB: number;
  toneColor1: string;
  toneColor2: string;
  /** The finish slot: blur and chromatic, run last, over whatever the other two left. */
  finish: EffectId;
  finishA: number;
  finishB: number;
  finishC: number;

  // --- backdrop ---
  backdrop: BackdropMode;
  backdropColor: string;
  backdropColor2: string;
  backdropAngle: number;
  floorShadow: boolean;
  shadowOpacity: number;
  shadowSoftness: number;

  // --- camera ---
  fov: number;
  /** Turns per minute. 0 = still. */
  autoSpin: number;
  azimuth: number;
  elevation: number;
  zoom: number;
}

export const DEFAULT_SPEC: Spec = {
  shape: "sphere",
  svg: "",
  thickness: 0.35,
  rounding: 0.5,
  twist: 0,
  shapeA: 0.5,
  shapeB: 0.5,
  shapeC: 0.5,
  material: "basic",
  color: "#f2f0eb",
  roughness: 0.45,
  metalness: 0,
  clearcoat: 0,
  clearcoatRoughness: 0.1,
  transmission: 0,
  glassThickness: 0.6,
  ior: 1.5,
  glowColor: "#ffffff",
  glow: 0,
  iridescence: 0,
  sheen: 0,
  sheenColor: "#ffffff",
  flat: false,
  surface: "none",
  surfaceScale: 1,
  surfaceDepth: 0.5,
  environment: "studio-soft",
  envIntensity: 1,
  envBlur: 0.35,
  envRotation: 0,
  lightMode: "environment",
  keyX: 0.35,
  keyY: 0.55,
  keyIntensity: 1.25,
  keyColor: "#ffffff",
  exposure: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  temperature: 0,
  tint: 0,
  effect: "none",
  effectA: 0.5,
  effectB: 0.5,
  effectC: 0.5,
  effectColor1: "#111111",
  effectColor2: "#f2f0eb",
  tone: "none",
  toneA: 0.5,
  toneB: 0.5,
  toneColor1: "#111111",
  toneColor2: "#f2f0eb",
  finish: "none",
  finishA: 0.5,
  finishB: 0.5,
  finishC: 0.5,
  backdrop: "solid",
  backdropColor: "#101114",
  backdropColor2: "#2a2c33",
  backdropAngle: 180,
  floorShadow: true,
  shadowOpacity: 0.35,
  shadowSoftness: 0.6,
  fov: 35,
  autoSpin: 1.5,
  azimuth: 30,
  elevation: 15,
  zoom: 1,
};

export interface Option {
  value: string;
  label: string;
}

export type Meta =
  | { kind: "number"; label: string; min: number; max: number; step: number; unit?: string; centred?: true; hint?: string; section: Section }
  | { kind: "boolean"; label: string; hint?: string; section: Section }
  | { kind: "enum"; label: string; options: Option[]; hint?: string; section: Section }
  | { kind: "color"; label: string; hint?: string; section: Section }
  /** Picked from a grid the section draws itself; no generic control. */
  | { kind: "picker"; label: string; section: Section }
  /** The two halves of the light pad. Drawn by the lighting section, not by Control. */
  | { kind: "pad"; label: string; section: Section }
  /** A per-shape or per-effect dial: range and label come from the catalogue entry. */
  | { kind: "dial"; label: string; section: Section }
  /** Carried data with no control at all. */
  | { kind: "hidden"; label: string; section: Section };

export const SECTIONS: { id: Section; title: string }[] = [
  { id: "shape", title: "Shape" },
  { id: "material", title: "Material" },
  { id: "lighting", title: "Lighting" },
  { id: "adjust", title: "Adjustments" },
  { id: "effect", title: "Effects" },
  { id: "backdrop", title: "Backdrop" },
  { id: "camera", title: "Camera" },
];

export const PARAM_META: Record<keyof Spec, Meta> = {
  shape: { kind: "picker", label: "Shape", section: "shape" },
  svg: { kind: "hidden", label: "Uploaded SVG", section: "shape" },
  thickness: { kind: "number", label: "Thickness", min: 0.02, max: 1, step: 0.01, hint: "How deep a flat shape is pulled out into 3D.", section: "shape" },
  rounding: { kind: "number", label: "Rounding", min: 0, max: 1, step: 0.01, hint: "Sharp edges at 0, a soft pillow at 1.", section: "shape" },
  twist: { kind: "number", label: "Twist", min: -180, max: 180, step: 1, unit: "°", centred: true, section: "shape" },
  shapeA: { kind: "dial", label: "Shape dial A", section: "shape" },
  shapeB: { kind: "dial", label: "Shape dial B", section: "shape" },
  shapeC: { kind: "dial", label: "Shape dial C", section: "shape" },

  material: { kind: "picker", label: "Material", section: "material" },
  // The surface first: on a textured material it is the dial that does the most, and it should not be the one at the bottom.
  surface: { kind: "picker", label: "Surface", section: "material" },
  surfaceScale: { kind: "number", label: "Surface scale", min: 0.25, max: 6, step: 0.05, section: "material" },
  surfaceDepth: { kind: "number", label: "Surface depth", min: 0, max: 1, step: 0.01, section: "material" },
  color: { kind: "color", label: "Colour", section: "material" },
  roughness: { kind: "number", label: "Roughness", min: 0, max: 1, step: 0.01, hint: "Mirror at 0, chalk at 1.", section: "material" },
  metalness: { kind: "number", label: "Metal", min: 0, max: 1, step: 0.01, section: "material" },
  clearcoat: { kind: "number", label: "Coat", min: 0, max: 1, step: 0.01, hint: "A clear glossy layer over the surface, like car paint.", section: "material" },
  clearcoatRoughness: { kind: "number", label: "Coat roughness", min: 0, max: 1, step: 0.01, section: "material" },
  transmission: { kind: "number", label: "Glass", min: 0, max: 1, step: 0.01, hint: "See-through. 1 is clear glass; add roughness for frosted.", section: "material" },
  glassThickness: { kind: "number", label: "Glass thickness", min: 0, max: 2, step: 0.01, section: "material" },
  ior: { kind: "number", label: "Refraction", min: 1, max: 2.33, step: 0.01, hint: "How much the glass bends what is behind it. Water 1.33, glass 1.5, diamond 2.4.", section: "material" },
  glowColor: { kind: "color", label: "Glow colour", section: "material" },
  glow: { kind: "number", label: "Glow", min: 0, max: 4, step: 0.05, hint: "Light the shape gives off itself — the neon look.", section: "material" },
  iridescence: { kind: "number", label: "Rainbow sheen", min: 0, max: 1, step: 0.01, hint: "A thin-film shimmer, like a soap bubble.", section: "material" },
  sheen: { kind: "number", label: "Velvet", min: 0, max: 1, step: 0.01, hint: "Soft light at the edges, like fabric.", section: "material" },
  sheenColor: { kind: "color", label: "Velvet colour", section: "material" },
  flat: { kind: "boolean", label: "Faceted", hint: "Shows every face as a flat plane — the low-poly look.", section: "material" },

  environment: { kind: "picker", label: "Environment", section: "lighting" },
  envIntensity: { kind: "number", label: "Environment strength", min: 0, max: 3, step: 0.05, section: "lighting" },
  envBlur: { kind: "number", label: "Environment blur", min: 0, max: 1, step: 0.01, hint: "Softens the reflections without changing the material.", section: "lighting" },
  envRotation: { kind: "number", label: "Environment rotation", min: 0, max: 360, step: 1, unit: "°", section: "lighting" },
  lightMode: {
    kind: "enum",
    label: "Lit by",
    options: [
      { value: "environment", label: "Environment" },
      { value: "directional", label: "Directional" },
    ],
    hint: "Environment lights from every side at once. Directional is one lamp you place on the pad.",
    section: "lighting",
  },
  keyX: { kind: "pad", label: "Light position", section: "lighting" },
  keyY: { kind: "pad", label: "Light height", section: "lighting" },
  keyIntensity: { kind: "number", label: "Intensity", min: 0, max: 5, step: 0.05, section: "lighting" },
  keyColor: { kind: "color", label: "Light colour", section: "lighting" },

  exposure: { kind: "number", label: "Exposure", min: -2, max: 2, step: 0.01, centred: true, section: "adjust" },
  brightness: { kind: "number", label: "Brightness", min: -1, max: 1, step: 0.01, centred: true, section: "adjust" },
  contrast: { kind: "number", label: "Contrast", min: -1, max: 1, step: 0.01, centred: true, section: "adjust" },
  saturation: { kind: "number", label: "Saturation", min: -1, max: 1, step: 0.01, centred: true, section: "adjust" },
  hue: { kind: "number", label: "Hue", min: -180, max: 180, step: 1, unit: "°", centred: true, section: "adjust" },
  temperature: { kind: "number", label: "Temperature", min: -1, max: 1, step: 0.01, centred: true, hint: "Cooler to the left, warmer to the right.", section: "adjust" },
  tint: { kind: "number", label: "Tint", min: -1, max: 1, step: 0.01, centred: true, hint: "Green to the left, magenta to the right.", section: "adjust" },

  effect: { kind: "picker", label: "Effect", section: "effect" },
  effectA: { kind: "dial", label: "Effect dial A", section: "effect" },
  effectB: { kind: "dial", label: "Effect dial B", section: "effect" },
  effectC: { kind: "dial", label: "Effect dial C", section: "effect" },
  effectColor1: { kind: "color", label: "Dark", section: "effect" },
  effectColor2: { kind: "color", label: "Light", section: "effect" },
  tone: { kind: "picker", label: "Colour effect", section: "effect" },
  toneA: { kind: "dial", label: "Colour effect dial A", section: "effect" },
  toneB: { kind: "dial", label: "Colour effect dial B", section: "effect" },
  toneColor1: { kind: "color", label: "Dark", section: "effect" },
  toneColor2: { kind: "color", label: "Light", section: "effect" },
  finish: { kind: "picker", label: "Finish effect", section: "effect" },
  finishA: { kind: "dial", label: "Finish dial A", section: "effect" },
  finishB: { kind: "dial", label: "Finish dial B", section: "effect" },
  finishC: { kind: "dial", label: "Finish dial C", section: "effect" },

  backdrop: {
    kind: "enum",
    label: "Backdrop",
    options: [
      { value: "solid", label: "Solid" },
      { value: "gradient", label: "Gradient" },
      { value: "transparent", label: "None" },
    ],
    section: "backdrop",
  },
  backdropColor: { kind: "color", label: "Colour", section: "backdrop" },
  backdropColor2: { kind: "color", label: "Second colour", section: "backdrop" },
  backdropAngle: { kind: "number", label: "Gradient angle", min: 0, max: 360, step: 1, unit: "°", section: "backdrop" },
  floorShadow: { kind: "boolean", label: "Floor shadow", section: "backdrop" },
  shadowOpacity: { kind: "number", label: "Shadow strength", min: 0, max: 1, step: 0.01, section: "backdrop" },
  shadowSoftness: { kind: "number", label: "Shadow softness", min: 0, max: 1, step: 0.01, section: "backdrop" },

  fov: { kind: "number", label: "Lens", min: 10, max: 90, step: 1, unit: "°", hint: "Narrow is a flat product shot, wide is dramatic.", section: "camera" },
  autoSpin: { kind: "number", label: "Auto-spin", min: 0, max: 10, step: 0.1, unit: " rpm", section: "camera" },
  azimuth: { kind: "number", label: "Turn", min: -180, max: 180, step: 1, unit: "°", centred: true, section: "camera" },
  elevation: { kind: "number", label: "Tilt", min: -89, max: 89, step: 1, unit: "°", centred: true, section: "camera" },
  zoom: { kind: "number", label: "Zoom", min: 0.4, max: 2.5, step: 0.01, unit: "×", section: "camera" },
};

/** Whether a value is legal for its key. Strings and booleans are always fine here; ids are checked by their catalogues. */
export function inRange<K extends keyof Spec>(key: K, value: Spec[K]): boolean {
  const meta = PARAM_META[key];
  if (meta.kind !== "number") return true;
  const n = value as number;
  return Number.isFinite(n) && n >= meta.min && n <= meta.max;
}

/** A spec from a partial, with anything unknown or out of range replaced by the default. Used for localStorage and URLs. */
/** The effects that live in the colour slot. Listed here so a spec saved before the slot existed can be moved across. */
export const TONE_IDS: readonly EffectId[] = ["duotone", "posterize", "threshold"];
/** The effects that live in the finish slot, for the same reason: blur and chromatic began life in the texture slot. */
export const FINISH_IDS: readonly EffectId[] = ["blur", "chromatic"];

export function coerceSpec(input: unknown): Spec {
  const spec = { ...DEFAULT_SPEC };
  if (!input || typeof input !== "object") return spec;
  let raw = input as Record<string, unknown>;
  // Before the colour slot, duotone and friends sat in the one effect slot.
  if (typeof raw.effect === "string" && (TONE_IDS as readonly string[]).includes(raw.effect) && raw.tone === undefined) {
    raw = { ...raw, tone: raw.effect, toneA: raw.effectA, toneB: raw.effectB, toneColor1: raw.effectColor1, toneColor2: raw.effectColor2, effect: "none", effectA: undefined, effectB: undefined, effectC: undefined, effectColor1: undefined, effectColor2: undefined };
  }
  // And before the finish slot, blur and chromatic sat there too.
  if (typeof raw.effect === "string" && (FINISH_IDS as readonly string[]).includes(raw.effect) && raw.finish === undefined) {
    raw = { ...raw, finish: raw.effect, finishA: raw.effectA, finishB: raw.effectB, finishC: raw.effectC, effect: "none", effectA: undefined, effectB: undefined, effectC: undefined };
  }
  for (const key of Object.keys(DEFAULT_SPEC) as (keyof Spec)[]) {
    const value = raw[key];
    if (value === undefined || typeof value !== typeof DEFAULT_SPEC[key]) continue;
    if (!inRange(key, value as Spec[typeof key])) continue;
    (spec as Record<string, unknown>)[key] = value;
  }
  return spec;
}
