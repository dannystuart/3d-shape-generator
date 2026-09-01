/**
 * The screen effects: one fullscreen pass each, after the colour grade. Every
 * shader takes the same uniforms (three dials, two colours, the resolution)
 * and writes `texel.a` back out, so a transparent backdrop stays transparent.
 *
 * Dials are quoted raw — the shader does its own scaling — so the prompt can
 * say "dot size 12" and mean the number on the slider.
 */
import type { EffectId, Spec } from "../spec";
import { HEADER } from "./shaders";

export interface EffectDial {
  key: "effectA" | "effectB" | "effectC";
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

/**
 * Three slots, in a fixed order. Texture effects restructure the picture —
 * cells, dots, glyphs, edges — colour effects remap what is left, and finish
 * effects (blur, chromatic) soften and smear the finished picture, so they can
 * lie over any of the others. One of each; two textures fight each other, so
 * they cannot be chosen together.
 */
export type EffectSlot = "texture" | "tone" | "finish";

export interface Effect {
  id: EffectId;
  name: string;
  slot: EffectSlot;
  dials: EffectDial[];
  /** Whether the two effect colours mean anything here. */
  usesColors: boolean;
  /** Colours a fresh pick starts on, for an effect whose defaults deserve better than ink and cream. */
  seedColors?: [string, string];
  fragment: string;
}

const A = (label: string, min: number, max: number, def: number, step = 0.01, unit?: string): EffectDial => ({ key: "effectA", label, min, max, step, default: def, unit });
const B = (label: string, min: number, max: number, def: number, step = 0.01, unit?: string): EffectDial => ({ key: "effectB", label, min, max, step, default: def, unit });
const C = (label: string, min: number, max: number, def: number, step = 0.01, unit?: string): EffectDial => ({ key: "effectC", label, min, max, step, default: def, unit });

const PIXELATE = /* glsl */ `${HEADER}
void main() {
  vec2 cell = vec2(uA) / uResolution;
  vec2 q = (floor(vUv / cell) + 0.5) * cell;
  vec4 texel = texture2D(tDiffuse, q);
  gl_FragColor = vec4(texel.rgb, texel.a);
}`;

const DITHER = /* glsl */ `${HEADER}
// A 2x2 Bayer cell, then the 4x4 built from it: 0..15, in the usual order.
float bayer2(vec2 p) { return 2.0 * p.x + 3.0 * p.y - 4.0 * p.x * p.y; }
float bayer4(vec2 p) { return 4.0 * bayer2(mod(p, 2.0)) + bayer2(mod(floor(p / 2.0), 2.0)); }
void main() {
  vec2 cell = floor(px / uA);
  vec4 texel = texture2D(tDiffuse, (cell + 0.5) * uA / uResolution);
  float t = (bayer4(cell) + 0.5) / 16.0 - 0.5;
  float steps = max(uB, 2.0) - 1.0;
  vec3 colour = floor(texel.rgb * steps + t + 0.5) / steps;
  float l = floor(luma(texel.rgb) * steps + t + 0.5) / steps;
  vec3 mono = mix(uColor1, uColor2, l);
  gl_FragColor = vec4(mix(mono, colour, uC), texel.a);
}`;

const HALFTONE = /* glsl */ `${HEADER}
void main() {
  vec4 texel = texture2D(tDiffuse, vUv);
  float a = radians(uB);
  float cs = cos(a), sn = sin(a);
  mat2 R = mat2(cs, -sn, sn, cs);
  mat2 Rt = mat2(cs, sn, -sn, cs);
  vec2 p = R * px;
  vec2 cell = floor(p / uA) * uA + uA * 0.5;
  vec4 s = texture2D(tDiffuse, (Rt * cell) / uResolution);
  float dark = 1.0 - luma(s.rgb) * s.a;
  float r = sqrt(dark) * uA * 0.62;
  float soft = max(uC * uA * 0.5, 0.6);
  float ink = 1.0 - smoothstep(r - soft, r + soft, length(p - cell));
  gl_FragColor = vec4(mix(uColor2, uColor1, ink), texel.a);
}`;

const ASCII = /* glsl */ `${HEADER}
// Five glyphs on a 3x3 grid, packed as bitmasks: nothing, a dot, a plus, a ring, a block.
float bit(float mask, float b) { return floor(mod(mask / exp2(b), 2.0)); }
void main() {
  vec2 cell = floor(px / uA);
  vec4 s = texture2D(tDiffuse, (cell + 0.5) * uA / uResolution);
  vec4 texel = texture2D(tDiffuse, vUv);
  // Contrast lifts the mid-tones so a coloured shape fills with glyphs rather than vanishing.
  float l = clamp(pow(luma(s.rgb), 1.0 / (1.0 + uB * 2.0)), 0.0, 1.0);
  float level = floor(l * 4.999);
  float mask = level < 0.5 ? 0.0 : level < 1.5 ? 16.0 : level < 2.5 ? 186.0 : level < 3.5 ? 495.0 : 511.0;
  vec2 f = fract(px / uA) * 3.0;
  vec2 sub = floor(f);
  vec2 g = fract(f) - 0.5;
  float inSquare = step(max(abs(g.x), abs(g.y)), 0.36);
  float on = bit(mask, sub.x + sub.y * 3.0) * inSquare;
  vec3 fg = mix(uColor2, s.rgb, uC);
  gl_FragColor = vec4(mix(uColor1, fg, on), texel.a);
}`;

const DUOTONE = /* glsl */ `${HEADER}
void main() {
  vec4 texel = texture2D(tDiffuse, vUv);
  float l = clamp((luma(texel.rgb) - 0.5) * (1.0 + uA * 2.0) + 0.5 + uB * 0.3, 0.0, 1.0);
  gl_FragColor = vec4(mix(uColor1, uColor2, l), texel.a);
}`;

const POSTERIZE = /* glsl */ `${HEADER}
void main() {
  vec4 texel = texture2D(tDiffuse, vUv);
  float n = max(uA, 2.0);
  vec3 g = pow(max(texel.rgb, 0.0), vec3(1.0 / uB));
  g = floor(g * (n - 0.001)) / (n - 1.0);
  gl_FragColor = vec4(pow(g, vec3(uB)), texel.a);
}`;

const THRESHOLD = /* glsl */ `${HEADER}
void main() {
  vec4 texel = texture2D(tDiffuse, vUv);
  float soft = max(uB, 0.001);
  float k = smoothstep(uA - soft, uA + soft, luma(texel.rgb));
  gl_FragColor = vec4(mix(uColor1, uColor2, k), texel.a);
}`;

const OUTLINE = /* glsl */ `${HEADER}
// Sobel on brightness plus alpha, so the silhouette against a transparent backdrop counts as an edge too.
float sig(vec2 uv) { vec4 t = texture2D(tDiffuse, uv); return luma(t.rgb) * t.a + t.a; }
void main() {
  vec4 texel = texture2D(tDiffuse, vUv);
  vec2 d = vec2(uA) / uResolution;
  float tl = sig(vUv + vec2(-d.x, d.y)), t = sig(vUv + vec2(0.0, d.y)), tr = sig(vUv + d);
  float l = sig(vUv + vec2(-d.x, 0.0)), r = sig(vUv + vec2(d.x, 0.0));
  float bl = sig(vUv - d), b = sig(vUv - vec2(0.0, d.y)), br = sig(vUv + vec2(d.x, -d.y));
  float gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
  float gy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
  float edge = clamp(length(vec2(gx, gy)) * uB * 1.2, 0.0, 1.0);
  vec3 base = mix(texel.rgb, uColor2, uC);
  gl_FragColor = vec4(mix(base, uColor1, edge), max(texel.a, edge));
}`;

const BLUR = /* glsl */ `${HEADER}
// One-pass disc blur: taps on a golden-angle spiral, so no axis shows.
// Fade tilts it — dialled up, the top of the picture stays sharp and the
// blur grows on the way down, so the shape melts towards the floor (minus
// runs the other way). Stretch pulls the taps into a vertical line, turning
// the melt into long downward smears.
void main() {
  float down = uB >= 0.0 ? 1.0 - vUv.y : vUv.y;
  float reach = mix(1.0, down, abs(uB));
  float radius = uA * reach;
  vec4 texel = vec4(0.0);
  for (int i = 0; i < 32; i++) {
    float t = (float(i) + 0.5) / 32.0;
    float a = float(i) * 2.39996;
    vec2 disc = vec2(cos(a), sin(a)) * sqrt(t) * radius;
    vec2 streak = vec2(0.0, (t - 0.5) * 2.0 * radius);
    texel += texture2D(tDiffuse, vUv + mix(disc, streak, uC) / uResolution);
  }
  texel /= 32.0;
  gl_FragColor = vec4(texel.rgb, texel.a);
}`;

const CHROMATIC = /* glsl */ `${HEADER}
// A prism smear: the picture is dragged outward from the centre and each
// step of the drag is weighted towards one end of the spectrum, so edges
// fray into red on one side and blue on the other.
void main() {
  vec2 dir = vUv - 0.5;
  float reach = pow(clamp(length(dir) * 2.0, 0.0, 1.0), max(uB, 0.01));
  vec2 span = normalize(dir + 1e-6) * uA * reach / uResolution;
  vec3 colour = vec3(0.0);
  vec3 norm = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < 32; i++) {
    float t = (float(i) + 0.5) / 32.0;
    vec3 w = max(vec3(0.0), 1.0 - 2.0 * abs(vec3(t, t - 0.5, t - 1.0)));
    // Each tap also wanders out on a spiral, so the soften dial melts the smear into a glow.
    float sa = float(i) * 2.39996;
    vec2 soft = vec2(cos(sa), sin(sa)) * sqrt(t) * uC / uResolution;
    vec4 texel = texture2D(tDiffuse, vUv + span * (t - 0.5) + soft);
    colour += texel.rgb * w;
    norm += w;
    alpha += texel.a;
  }
  colour /= max(norm, vec3(1e-4));
  alpha /= 32.0;
  gl_FragColor = vec4(colour, alpha);
}`;

const CHROMABLUR = /* glsl */ `${HEADER}
// Blur and chromatic in one pass: every spectral tap of the prism smear is
// also scattered on a blur disc, and one falloff grades both from the centre.
void main() {
  float reach = uC <= 0.0 ? 1.0 : pow(clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0), uC);
  vec2 dir = vUv - 0.5;
  vec2 span = normalize(dir + vec2(1e-6)) * uB * reach / uResolution;
  float radius = uA * reach;
  vec3 colour = vec3(0.0);
  vec3 norm = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < 32; i++) {
    float t = (float(i) + 0.5) / 32.0;
    vec3 w = max(vec3(0.0), 1.0 - 2.0 * abs(vec3(t, t - 0.5, t - 1.0)));
    float a = float(i) * 2.39996;
    vec2 disc = vec2(cos(a), sin(a)) * sqrt(t) * radius / uResolution;
    vec4 texel = texture2D(tDiffuse, vUv + span * (t - 0.5) + disc);
    colour += texel.rgb * w;
    norm += w;
    alpha += texel.a;
  }
  colour /= max(norm, vec3(1e-4));
  alpha /= 32.0;
  gl_FragColor = vec4(colour, alpha);
}`;

export const EFFECTS: Effect[] = [
  { id: "none", name: "None", slot: "texture", dials: [], usesColors: false, fragment: "" },
  { id: "pixelate", name: "Pixelate", slot: "texture", dials: [A("Size", 2, 64, 10, 1, " px")], usesColors: false, fragment: PIXELATE },
  { id: "dither", name: "Dither", slot: "texture", dials: [A("Scale", 1, 8, 2, 1), B("Levels", 2, 8, 2, 1), C("Colour", 0, 1, 0)], usesColors: true, fragment: DITHER },
  { id: "halftone", name: "Halftone", slot: "texture", dials: [A("Dot size", 3, 30, 10, 1, " px"), B("Angle", 0, 90, 22, 1, "°"), C("Softness", 0, 1, 0.3)], usesColors: true, fragment: HALFTONE },
  { id: "ascii", name: "ASCII", slot: "texture", dials: [A("Cell", 6, 24, 12, 1, " px"), B("Contrast", 0, 1, 0.5), C("Colour", 0, 1, 0)], usesColors: true, fragment: ASCII },
  { id: "outline", name: "Outline", slot: "texture", dials: [A("Width", 1, 6, 2, 1, " px"), B("Strength", 0, 1, 1), C("Fill", 0, 1, 0)], usesColors: true, fragment: OUTLINE },
  { id: "blur", name: "Blur", slot: "finish", dials: [A("Radius", 0, 120, 24, 1, " px"), B("Fade", -1, 1, 0), C("Stretch", 0, 1, 0)], usesColors: false, fragment: BLUR },
  { id: "chromatic", name: "Chromatic", slot: "finish", dials: [A("Split", 0, 80, 30, 1, " px"), B("Falloff", 0.2, 3, 1), C("Soften", 0, 60, 0, 1, " px")], usesColors: false, fragment: CHROMATIC },
  { id: "chromablur", name: "Blur + chromatic", slot: "finish", dials: [A("Radius", 0, 120, 30, 1, " px"), B("Split", 0, 80, 25, 1, " px"), C("Falloff", 0, 4, 1)], usesColors: false, fragment: CHROMABLUR },
  { id: "duotone", name: "Duotone", slot: "tone", dials: [A("Contrast", 0, 1, 0.5), B("Balance", -1, 1, 0)], usesColors: true, seedColors: ["#2432d6", "#f2f5ff"], fragment: DUOTONE },
  { id: "posterize", name: "Posterize", slot: "tone", dials: [A("Levels", 2, 16, 4, 1), B("Gamma", 0.5, 2, 1)], usesColors: false, fragment: POSTERIZE },
  { id: "threshold", name: "Threshold", slot: "tone", dials: [A("Cut-off", 0, 1, 0.5), B("Softness", 0, 0.5, 0.02)], usesColors: true, fragment: THRESHOLD },
];

/** "None" for the colour and finish slots: the same empty entry, under its own slot, so a picker can show it. */
export const NO_TONE: Effect = { ...EFFECTS[0], slot: "tone" };
export const NO_FINISH: Effect = { ...EFFECTS[0], slot: "finish" };
export const TEXTURES: Effect[] = EFFECTS.filter((e) => e.slot === "texture");
export const TONES: Effect[] = [NO_TONE, ...EFFECTS.filter((e) => e.slot === "tone")];
export const FINISHES: Effect[] = [NO_FINISH, ...EFFECTS.filter((e) => e.slot === "finish")];

export function effectById(id: string): Effect {
  return EFFECTS.find((e) => e.id === id) ?? EFFECTS[0];
}

/** The effect in a slot of the spec. */
export function effectIn(spec: Spec, slot: EffectSlot): Effect {
  const e = effectById(slot === "texture" ? spec.effect : slot === "tone" ? spec.tone : spec.finish);
  if (e.slot === slot) return e;
  return slot === "tone" ? NO_TONE : slot === "finish" ? NO_FINISH : EFFECTS[0];
}

/** Where a slot's id, dials and colours live in the spec. */
export const SLOT_KEYS = {
  texture: { id: "effect", a: "effectA", b: "effectB", c: "effectC", color1: "effectColor1", color2: "effectColor2" },
  tone: { id: "tone", a: "toneA", b: "toneB", c: "toneB", color1: "toneColor1", color2: "toneColor2" },
  // Neither finish effect reads the colours; the texture slot's pair stands in.
  finish: { id: "finish", a: "finishA", b: "finishB", c: "finishC", color1: "effectColor1", color2: "effectColor2" },
} as const satisfies Record<EffectSlot, Record<string, keyof Spec>>;

/** The spec key a catalogue dial writes to, in the slot its effect lives in. */
export function dialKey(effect: Effect, dial: EffectDial): keyof Spec {
  const keys = SLOT_KEYS[effect.slot];
  return dial.key === "effectA" ? keys.a : dial.key === "effectB" ? keys.b : keys.c;
}

/** The dial values (and any seed colours) a freshly picked effect should start on, keyed for its slot. */
export function effectDialDefaults(effect: Effect): Partial<Spec> {
  const keys = SLOT_KEYS[effect.slot];
  const out: Partial<Spec> = { [keys.a]: 0.5, [keys.b]: 0.5 };
  if (effect.slot !== "tone") (out as Record<string, unknown>)[keys.c] = 0.5;
  for (const d of effect.dials) (out as Record<string, unknown>)[dialKey(effect, d)] = d.default;
  if (effect.seedColors) {
    (out as Record<string, unknown>)[keys.color1] = effect.seedColors[0];
    (out as Record<string, unknown>)[keys.color2] = effect.seedColors[1];
  }
  return out;
}

/** The dial uniforms for a slot, raw. The shader does its own scaling. */
export function effectUniforms(spec: Spec, slot: EffectSlot = "texture"): { uA: number; uB: number; uC: number } {
  const keys = SLOT_KEYS[slot];
  return { uA: spec[keys.a], uB: spec[keys.b], uC: spec[keys.c] };
}
