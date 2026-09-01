/**
 * The curated looks: named whole-picture presets for the showcase gallery.
 *
 * `surprise()` proves the rule these follow — never roll a raw dial, only
 * combine presets. A look is a shape swatch, a material swatch, a room and now
 * and then an effect, composed exactly the way surprise composes them, so every
 * one is a picture someone chose rather than a random mess. `patch` is the
 * diff-from-default: the same shape a share link carries, so a look art-directed
 * in the editor pastes straight in.
 *
 * The host site reads this list — a look added here lands in the gallery with no
 * site-side change, its slug becoming `?look=` and its name/one-liner the tile.
 *
 * NOTE (roster complete, 2026-08-25): Dan art-directed all twelve looks in the
 * running editor; each arrived as a share link whose hash diff is pasted
 * verbatim as the `patch` — camera, spin and all, exactly as he framed it, so
 * every entry uses literal dial values on purpose. No composed drafts remain.
 * The compose() helper below is kept as the documented recipe rule (never roll
 * a raw dial, only combine presets) for any future look, though nothing in the
 * list uses it today.
 */
import { NO_TONE, TONES, effectById, effectDialDefaults } from "../effects/index";
import type { EffectId } from "../spec";
import { materialPatch } from "../materials";
import { shapeById, shapeDialDefaults } from "../shapes/catalogue";
import { coerceSpec, DEFAULT_SPEC } from "../spec";
import type { Spec } from "../spec";

export type LookFamily = "chrome" | "glass" | "blob" | "neon" | "mineral" | "soft";

export interface Look {
  slug: string; // URL-safe; becomes ?look= on the host site
  name: string; // short display name
  oneLiner: string; // the tile caption — written once, read by the host page
  family: LookFamily; // groups the gallery's SEO sections
  patch: Partial<Spec>;
}

/** Compose a look's patch from presets, the way surprise() does — never raw dials. */
function compose(recipe: {
  shape: string;
  material: string;
  environment: string;
  /** Optional per-shape dial overrides (still preset-flavoured, e.g. more spikes). */
  dials?: Partial<Pick<Spec, "shapeA" | "shapeB" | "shapeC">>;
  /** Optional texture-slot effect. */
  effect?: EffectId;
  /** Optional colour-slot effect. */
  tone?: EffectId;
}): Partial<Spec> {
  const shape = shapeById(recipe.shape);
  const patch: Partial<Spec> = {
    shape: shape.id,
    ...shapeDialDefaults(shape),
    ...(recipe.dials ?? {}),
    material: recipe.material,
    ...materialPatch(recipe.material),
    environment: recipe.environment,
  };
  if (recipe.effect) {
    const effect = effectById(recipe.effect);
    patch.effect = effect.id;
    Object.assign(patch, effectDialDefaults(effect));
  }
  if (recipe.tone) {
    const tone = TONES.find((t) => t.id === recipe.tone) ?? NO_TONE;
    patch.tone = tone.id;
    Object.assign(patch, effectDialDefaults(tone));
  }
  return patch;
}

export const LOOKS: Look[] = [
  // --- blob ×3 (SEO: "3d blob", "abstract 3d shapes") ---
  // Dan's, 2026-08-24 (share-hash diff, verbatim). First in the roster, so it
  // is also the cold-open look until he flags a dedicated opener.
  {
    slug: "sunset-chrome-blob",
    name: "Sunset chrome blob",
    oneLiner: "A mirror blob drinking the sunset, floating on lilac.",
    family: "blob",
    patch: {
      shape: "blob-soft",
      shapeA: 0.69,
      shapeB: 13,
      material: "custom",
      color: "#ffffff",
      roughness: 0,
      metalness: 1,
      clearcoat: 0.53,
      clearcoatRoughness: 0.14,
      transmission: 0.07,
      glassThickness: 0.55,
      environment: "sunset",
      backdrop: "gradient",
      backdropColor: "#7a7cff",
      backdropColor2: "#c9a8ff",
      backdropAngle: 170,
      azimuth: -60.20137660894419,
      elevation: -1.072457727203156,
      zoom: 0.9999999999999928,
    },
  },
  // Dan's, 2026-08-25 (share-hash diff, verbatim). Rowed with the chrome
  // family — copper is metal, and the pixel effect is the point.
  {
    slug: "copper-pixel-cross",
    name: "Copper pixel cross",
    oneLiner: "A copper cross gone pixel — eight-bit metal on warm amber.",
    family: "chrome",
    patch: {
      shape: "cross",
      material: "copper",
      color: "#e0865a",
      roughness: 0.25,
      metalness: 1,
      clearcoat: 0.6,
      effect: "pixelate",
      effectA: 8,
      backdrop: "gradient",
      backdropColor: "#ffb46a",
      backdropColor2: "#ffe2b0",
      backdropAngle: 170,
      azimuth: -129.14999999998645,
      elevation: 14.999999999999982,
      zoom: 1.0000000000000009,
    },
  },
  // Dan's, 2026-08-25 (share-hash diff, verbatim). A metallic spiked blob on a
  // sunset gradient, edges fringed with a chromatic prism split.
  {
    slug: "gunmetal-spike-blob",
    name: "Gunmetal spike blob",
    oneLiner: "A dark gunmetal spike-blob, edges split into prism colour.",
    family: "blob",
    patch: {
      shape: "blob-spiky",
      shapeA: 0.32,
      shapeB: 3.73,
      shapeC: 6,
      material: "gunmetal",
      color: "#3a3d44",
      roughness: 0.3,
      metalness: 1,
      environment: "sunset",
      tone: "threshold",
      toneA: 0.29,
      toneColor1: "#2432d6",
      toneColor2: "#f2f5ff",
      finish: "chromatic",
      finishA: 56,
      finishB: 0.2,
      finishC: 0,
      backdrop: "gradient",
      backdropColor: "#6b5b95",
      backdropColor2: "#f4a6a6",
      floorShadow: false,
      shadowOpacity: 0.41,
      shadowSoftness: 0.66,
      azimuth: -60.23641660894417,
      elevation: -1.0724577272031561,
      zoom: 0.9999999999999926,
    },
  },
  // --- chrome ×3 (SEO: "chrome shapes") ---
  // Dan's, 2026-08-25 (share-hash diff, verbatim). A faceted metal gem, brushed
  // and iridescent underneath — but the dither pass flattens all of that to
  // two-tone dots, and the dots are what the card shows, so the words lead with
  // the dither (Dan, 2026-08-25). Slug kept: it names the card image and any
  // shared links.
  {
    slug: "oil-slick-gem",
    name: "Dithered gem",
    oneLiner: "A faceted gem screened down to two-tone dots, newsprint style.",
    family: "chrome",
    patch: {
      shape: "gem",
      shapeA: 8,
      shapeB: 0.45,
      material: "custom",
      color: "#7f78ff",
      roughness: 0.22,
      metalness: 1,
      clearcoat: 0.6,
      transmission: 0.19,
      ior: 1.69,
      iridescence: 1,
      surface: "brushed",
      surfaceScale: 1.6,
      surfaceDepth: 0.32,
      effect: "dither",
      effectA: 2,
      effectB: 2,
      effectC: 0,
      toneColor1: "#2432d6",
      toneColor2: "#f2f5ff",
      backdrop: "transparent",
      azimuth: 38.05795609683634,
      elevation: 14.917371250650637,
      zoom: 0.9667130459131447,
    },
  },
  // Dan's, 2026-08-25 (share-hash diff, verbatim). Flat-shaded silver with an
  // iridescent rim, held nearly face-on against a charcoal fade.
  {
    slug: "iridescent-heart",
    name: "Iridescent heart",
    oneLiner: "A flat silver heart with an oil-slick rim.",
    family: "chrome",
    patch: {
      shape: "heart",
      thickness: 0.54,
      rounding: 0.88,
      material: "custom",
      color: "#d8dade",
      roughness: 0.51,
      metalness: 1,
      transmission: 0.52,
      ior: 1.42,
      iridescence: 0.52,
      flat: true,
      envIntensity: 1.25,
      envBlur: 0.47,
      keyX: -0.55,
      keyY: -0.45,
      keyIntensity: 1.4,
      exposure: 0.06,
      brightness: 0.04,
      contrast: 0.24,
      temperature: 0.06,
      toneColor1: "#2432d6",
      toneColor2: "#f2f5ff",
      backdrop: "gradient",
      backdropColor: "#2b2c31",
      backdropColor2: "#141418",
      backdropAngle: 262,
      shadowOpacity: 0.08,
      shadowSoftness: 0.39,
      azimuth: 3.083731853040994,
      elevation: 10.13799599153335,
      zoom: 0.7700000000000098,
    },
  },
  // Dan's, 2026-08-25 (share-hash diff, verbatim). Rowed with glass: crazed
  // glass with a chromatic-fringe finish, moody on near-black.
  {
    slug: "cracked-glass-twist",
    name: "Cracked glass twist",
    oneLiner: "A twisted glass ring, crazed with cracks, its edges split into rainbow.",
    family: "glass",
    patch: {
      shape: "torus-twisted",
      shapeA: 5,
      shapeB: 3,
      shapeC: 0.4,
      material: "custom",
      color: "#ffffff",
      roughness: 0.58,
      transmission: 1,
      glassThickness: 0.8,
      surface: "cracks",
      surfaceScale: 0.95,
      surfaceDepth: 0.28,
      environment: "photo-studio",
      envIntensity: 1.1,
      keyX: -0.26,
      keyY: 0.38,
      contrast: 0.22,
      saturation: 0.27,
      hue: 1,
      finish: "chromatic",
      finishA: 12,
      finishB: 1.26,
      finishC: 0,
      backdropColor: "#0c0c0d",
      backdropColor2: "#141418",
      floorShadow: false,
      azimuth: 3.0078292128237396,
      elevation: 18.778459389142615,
      zoom: 1.3103780212457674,
    },
  },
  // --- glass ×2 ---
  // Dan's, 2026-08-25 (share-hash diff, verbatim). The card renders a milky
  // lilac glass jack on a lilac fade — no gold ever shows, and "dichroic" is a
  // word nobody knows (Dan, 2026-08-25) — so the name and line say what the
  // eye gets. Slug kept: it names the card image and any shared links.
  {
    slug: "dichroic-jack",
    name: "Lilac glass jack",
    oneLiner: "A milky glass jack, lilac on lilac.",
    family: "glass",
    patch: {
      shape: "pipe-star",
      shapeA: 7,
      shapeB: 0.27,
      material: "custom",
      color: "#c8b4ff",
      roughness: 0.09,
      metalness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      transmission: 1,
      glassThickness: 1.47,
      ior: 2.33,
      iridescence: 1,
      environment: "photo-studio",
      toneColor1: "#2432d6",
      toneColor2: "#f2f5ff",
      backdrop: "gradient",
      backdropColor: "#e6e0ff",
      backdropColor2: "#c3b5ff",
      floorShadow: false,
      autoSpin: 0,
      azimuth: -43.86933564656472,
      elevation: -3.8575764830783625,
      zoom: 1.4000000000000004,
    },
  },
  // Dan's, 2026-08-24 (share-hash diff, verbatim). Auto-spins in the live
  // editor; the still card is framed face-on so the blades read.
  {
    slug: "glass-pinwheel",
    name: "Glass pinwheel",
    oneLiner: "A white-glass pinwheel turning slowly on blush pink.",
    family: "glass",
    patch: {
      shape: "pinwheel",
      material: "custom",
      color: "#ffffff",
      roughness: 0,
      metalness: 0.15,
      clearcoat: 0.16,
      clearcoatRoughness: 0.46,
      transmission: 1,
      glassThickness: 0.57,
      keyX: -0.22,
      keyY: 0.56,
      backdrop: "gradient",
      backdropColor: "#ffe1e8",
      backdropColor2: "#f7b2c4",
      backdropAngle: 160,
      floorShadow: false,
      autoSpin: 5.4,
      azimuth: 0,
      elevation: 10,
      zoom: 1.19,
    },
  },
  // --- neon ---
  // Dan's, 2026-08-25 (share-hash diff, verbatim). A carbon-fibre capsule, its
  // weave under a clear coat, softly blurred on mint.
  {
    slug: "carbon-capsule",
    name: "Carbon capsule",
    oneLiner: "A carbon-fibre capsule, glossy and softly blurred.",
    family: "chrome",
    patch: {
      shape: "capsule",
      shapeA: 1,
      material: "carbon-fibre",
      color: "#17181b",
      roughness: 0.3,
      metalness: 0.6,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      surface: "weave",
      surfaceScale: 4,
      surfaceDepth: 0.45,
      environment: "grad-mint",
      toneColor1: "#2432d6",
      toneColor2: "#f2f5ff",
      finish: "blur",
      finishA: 48,
      finishB: -1,
      finishC: 1,
      backdrop: "gradient",
      backdropColor: "#e4fbf2",
      backdropColor2: "#a8e8cf",
      floorShadow: false,
      autoSpin: 0,
      azimuth: 115.50000000002115,
      elevation: 14.999999999999982,
      zoom: 1.1687462755706397,
    },
  },
  // --- mineral ×2 ---
  // Dan's, 2026-08-25 (share-hash diff, verbatim). A coiled ball of wound rope
  // cast in rough grey concrete.
  {
    slug: "concrete-coil-ball",
    name: "Concrete coil ball",
    oneLiner: "A wound coil cast in rough concrete.",
    family: "mineral",
    patch: {
      shape: "spiral-ball",
      shapeA: 5,
      shapeB: 0.13,
      material: "custom",
      color: "#9a9a96",
      roughness: 0.8,
      metalness: 0.29,
      sheen: 0.21,
      surface: "concrete",
      surfaceScale: 1.95,
      surfaceDepth: 1,
      environment: "photo-studio",
      envIntensity: 1.65,
      keyX: 0.55,
      keyY: 0.35,
      contrast: 0.14,
      saturation: -0.11,
      backdrop: "gradient",
      backdropColor: "#2b2c31",
      backdropColor2: "#141418",
      floorShadow: false,
      azimuth: 170.55686722406182,
      elevation: 7.462568641488515,
      zoom: 0.9984623845122307,
    },
  },
  // Dan's, 2026-08-25 (share-hash diff, verbatim). A deep-plum velvet flower
  // rendered as pink halftone dots.
  {
    slug: "halftone-bloom",
    name: "Halftone bloom",
    oneLiner: "A velvet flower under a pink halftone.",
    family: "soft",
    patch: {
      shape: "petals",
      shapeA: 12,
      shapeB: 0.6,
      shapeC: 0.3,
      material: "velvet",
      color: "#4a0f2a",
      roughness: 1,
      sheen: 1,
      sheenColor: "#ff7ab0",
      exposure: 0.65,
      brightness: 0.05,
      contrast: 0.03,
      saturation: -0.02,
      temperature: 0.01,
      tint: -0.16,
      effect: "halftone",
      effectA: 4,
      effectB: 39,
      effectC: 0.37,
      tone: "duotone",
      toneA: 0.48,
      toneB: 0.35,
      toneColor1: "#d62448",
      toneColor2: "#f2f5ff",
      floorShadow: false,
      autoSpin: 0,
      azimuth: -31.98900419569189,
      elevation: -3.288102826053696,
      zoom: 1.0700000000000371,
    },
  },
  // --- soft ---
  // Dan's, 2026-08-24 (share-hash diff, verbatim). Held still on purpose —
  // no spin, one raking key light off the left.
  {
    slug: "leather-bolt",
    name: "Leather bolt",
    oneLiner: "A lightning bolt upholstered in pebbled brown leather.",
    family: "soft",
    patch: {
      shape: "lightning",
      material: "leather",
      color: "#5a3422",
      roughness: 0.6,
      clearcoat: 0.25,
      clearcoatRoughness: 0.5,
      surface: "leather",
      surfaceScale: 2.5,
      surfaceDepth: 0.6,
      environment: "overcast",
      envIntensity: 1.9,
      envBlur: 0.41,
      lightMode: "directional",
      keyX: -0.7,
      keyY: 0.11,
      keyIntensity: 5,
      backdrop: "gradient",
      backdropColor: "#000000",
      backdropColor2: "#667aff",
      backdropAngle: 135,
      floorShadow: false,
      autoSpin: 0,
      azimuth: 30.671125954751044,
      elevation: 1.6213771415477278,
      zoom: 0.9999999999999696,
    },
  },
];

export const lookBySlug = (slug: string) => LOOKS.find((l) => l.slug === slug);
export const lookSpec = (slug: string): Spec =>
  coerceSpec({ ...DEFAULT_SPEC, ...(lookBySlug(slug)?.patch ?? {}) });
