import type { MeshPhysicalMaterial } from "three";
import type { Spec } from "./spec";
import { surfaceById } from "./surfaces";

export type MaterialCategory = "solid" | "metal" | "glass" | "neon" | "special" | "texture";
type MaterialKeys =
  | "color"
  | "roughness"
  | "metalness"
  | "clearcoat"
  | "clearcoatRoughness"
  | "transmission"
  | "glassThickness"
  | "ior"
  | "glowColor"
  | "glow"
  | "iridescence"
  | "sheen"
  | "sheenColor"
  | "flat"
  | "surface"
  | "surfaceScale"
  | "surfaceDepth";
export type MaterialPatch = Partial<Pick<Spec, MaterialKeys>>;
export interface MaterialPreset {
  id: string;
  name: string;
  category: MaterialCategory;
  patch: MaterialPatch;
}

/** Every preset starts from this and states only what it changes — so a swatch is a readable list of what makes it what it is. */
const BASE: Required<MaterialPatch> = {
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
};

const gloss = (color: string): MaterialPatch => ({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });

export const MATERIALS: MaterialPreset[] = [
  { id: "basic", name: "Basic", category: "solid", patch: {} },
  { id: "matte", name: "Matte", category: "solid", patch: { roughness: 0.9 } },
  { id: "clay", name: "Clay", category: "solid", patch: { color: "#c9b8a8", roughness: 0.85 } },
  { id: "plastic-white", name: "Plastic white", category: "solid", patch: gloss("#f4f4f2") },
  { id: "plastic-black", name: "Plastic black", category: "solid", patch: gloss("#16171a") },
  { id: "plastic-red", name: "Plastic red", category: "solid", patch: gloss("#ff4a2e") },
  { id: "plastic-orange", name: "Plastic orange", category: "solid", patch: gloss("#ff8a1f") },
  { id: "plastic-yellow", name: "Plastic yellow", category: "solid", patch: gloss("#ffc93c") },
  { id: "plastic-green", name: "Plastic green", category: "solid", patch: gloss("#5ad34c") },
  { id: "plastic-blue", name: "Plastic blue", category: "solid", patch: gloss("#2f7dff") },
  { id: "plastic-purple", name: "Plastic purple", category: "solid", patch: gloss("#8a5cff") },
  { id: "plastic-pink", name: "Plastic pink", category: "solid", patch: gloss("#ff5fb8") },
  { id: "chrome", name: "Chrome", category: "metal", patch: { color: "#ffffff", metalness: 1, roughness: 0.05 } },
  { id: "brushed", name: "Brushed steel", category: "metal", patch: { color: "#d8dade", metalness: 1, roughness: 0.38 } },
  { id: "gold", name: "Gold", category: "metal", patch: { color: "#ffc65c", metalness: 1, roughness: 0.2 } },
  { id: "copper", name: "Copper", category: "metal", patch: { color: "#e0865a", metalness: 1, roughness: 0.25, clearcoat: 0.6 } },
  { id: "gunmetal", name: "Gunmetal", category: "metal", patch: { color: "#3a3d44", metalness: 1, roughness: 0.3 } },
  { id: "glass-clear", name: "Clear glass", category: "glass", patch: { color: "#ffffff", roughness: 0.02, transmission: 1, glassThickness: 0.8, ior: 1.5 } },
  { id: "glass-frosted", name: "Frosted glass", category: "glass", patch: { color: "#ffffff", roughness: 0.45, transmission: 1, glassThickness: 0.6, ior: 1.45 } },
  { id: "glass-tinted", name: "Tinted glass", category: "glass", patch: { color: "#7fd0ff", roughness: 0.05, transmission: 0.95, glassThickness: 1.2, ior: 1.5 } },
  { id: "neon-blue", name: "Neon blue", category: "neon", patch: { color: "#1a6dff", roughness: 0.3, glowColor: "#1a6dff", glow: 1.6 } },
  { id: "neon-pink", name: "Neon pink", category: "neon", patch: { color: "#ff2fa3", roughness: 0.3, glowColor: "#ff2fa3", glow: 1.6 } },
  { id: "neon-green", name: "Neon green", category: "neon", patch: { color: "#3dff7a", roughness: 0.3, glowColor: "#3dff7a", glow: 1.6 } },
  { id: "clearcoat", name: "Clearcoat", category: "special", patch: { color: "#6b2a12", roughness: 0.5, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.03 } },
  { id: "satin", name: "Satin", category: "special", patch: { color: "#c79ab5", roughness: 0.55, sheen: 0.6, sheenColor: "#ffffff" } },
  { id: "silk", name: "Silk", category: "special", patch: { color: "#e8dcc8", roughness: 0.4, sheen: 1, sheenColor: "#fff4e0" } },
  { id: "velvet", name: "Velvet", category: "special", patch: { color: "#4a0f2a", roughness: 1, sheen: 1, sheenColor: "#ff7ab0" } },
  { id: "iridescent", name: "Iridescent", category: "special", patch: { color: "#d9d9e0", roughness: 0.15, metalness: 0.3, iridescence: 1 } },
  { id: "lowpoly", name: "Faceted", category: "special", patch: { roughness: 0.5, flat: true } },
  // --- more to pick from ---
  { id: "black-chrome", name: "Black chrome", category: "metal", patch: { color: "#2a2b30", metalness: 1, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 } },
  { id: "rose-gold", name: "Rose gold", category: "metal", patch: { color: "#f0b8a0", metalness: 1, roughness: 0.22 } },
  { id: "titanium", name: "Titanium", category: "metal", patch: { color: "#8f949c", metalness: 1, roughness: 0.32, surface: "brushed", surfaceScale: 1.5, surfaceDepth: 0.35 } },
  { id: "hammered-gold", name: "Hammered gold", category: "metal", patch: { color: "#ffc65c", metalness: 1, roughness: 0.25, surface: "hammered", surfaceScale: 2, surfaceDepth: 0.7 } },
  { id: "rust", name: "Rust", category: "metal", patch: { color: "#8a4a2a", metalness: 0.55, roughness: 0.85, surface: "concrete", surfaceScale: 2, surfaceDepth: 0.8 } },
  { id: "ceramic", name: "Ceramic", category: "solid", patch: { color: "#f6f3ee", roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 } },
  { id: "rubber", name: "Rubber", category: "solid", patch: { color: "#1c1d20", roughness: 0.95 } },
  { id: "jelly", name: "Jelly", category: "glass", patch: { color: "#ff5a7a", roughness: 0.25, transmission: 0.9, glassThickness: 1.4, ior: 1.35 } },
  { id: "pearl", name: "Pearl", category: "special", patch: { color: "#f3eee8", roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: 0.7, sheen: 0.5, sheenColor: "#ffe0f0" } },
  { id: "holographic", name: "Holographic", category: "special", patch: { color: "#c8c8d8", metalness: 1, roughness: 0.12, iridescence: 1 } },
  // Ice: a frosted block — milky through the body, a wet sheen on top, frost in the cracks.
  { id: "ice", name: "Ice", category: "texture", patch: { color: "#eef8ff", roughness: 0.42, transmission: 0.6, glassThickness: 2, ior: 1.31, clearcoat: 0.7, clearcoatRoughness: 0.22, sheen: 0.35, sheenColor: "#e6f4ff", surface: "frost", surfaceScale: 1, surfaceDepth: 0.6 } },
  // Ice glass: the same cracked sheet, but clear — you look through it and the plates bend what is behind.
  { id: "ice-glass", name: "Ice glass", category: "glass", patch: { color: "#f4fbff", roughness: 0.14, transmission: 1, glassThickness: 1.2, ior: 1.31, clearcoat: 1, clearcoatRoughness: 0.06, surface: "frost", surfaceScale: 1, surfaceDepth: 0.7 } },
  { id: "cracked-glass", name: "Cracked glass", category: "glass", patch: { color: "#ffffff", roughness: 0.04, transmission: 1, glassThickness: 0.8, ior: 1.5, surface: "cracks", surfaceScale: 1.5, surfaceDepth: 0.9 } },
  { id: "leather", name: "Leather", category: "texture", patch: { color: "#5a3422", roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.5, surface: "leather", surfaceScale: 2.5, surfaceDepth: 0.6 } },
  { id: "black-leather", name: "Black leather", category: "texture", patch: { color: "#1a1a1c", roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.45, surface: "leather", surfaceScale: 2.5, surfaceDepth: 0.6 } },
  { id: "dragonscale", name: "Dragonscale", category: "texture", patch: { color: "#1f4a33", roughness: 0.3, metalness: 0.5, clearcoat: 0.8, clearcoatRoughness: 0.15, iridescence: 0.4, surface: "scales", surfaceScale: 2, surfaceDepth: 1 } },
  { id: "concrete", name: "Concrete", category: "texture", patch: { color: "#9a9a96", roughness: 0.9, surface: "concrete", surfaceScale: 2.5, surfaceDepth: 0.85 } },
  { id: "stone", name: "Stone", category: "texture", patch: { color: "#6e6a66", roughness: 0.9, surface: "rock", surfaceScale: 1.5, surfaceDepth: 0.8 } },
  { id: "cracked-clay", name: "Cracked clay", category: "texture", patch: { color: "#b07a55", roughness: 0.9, surface: "cracks", surfaceScale: 2, surfaceDepth: 1 } },
  { id: "carbon-fibre", name: "Carbon fibre", category: "texture", patch: { color: "#17181b", metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, surface: "weave", surfaceScale: 4, surfaceDepth: 0.45 } },
  { id: "denim", name: "Denim", category: "texture", patch: { color: "#3b5a8a", roughness: 0.95, sheen: 0.3, sheenColor: "#c8d4ea", surface: "weave", surfaceScale: 6, surfaceDepth: 0.5 } },
  { id: "brushed-copper", name: "Brushed copper", category: "texture", patch: { color: "#e0865a", metalness: 1, roughness: 0.35, surface: "brushed", surfaceScale: 1.5, surfaceDepth: 0.4 } },
  // --- the soft, foil and dichroic looks ---
  // Silicone: the soft-touch coral of a phone case — matte body, a whisper of sheen at the rim.
  { id: "silicone", name: "Silicone", category: "solid", patch: { color: "#ff8f86", roughness: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.5, sheen: 0.45, sheenColor: "#ffd9d4" } },
  { id: "soft-lilac", name: "Soft lilac", category: "solid", patch: { color: "#c9b8ff", roughness: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.5, sheen: 0.45, sheenColor: "#f0e8ff" } },
  { id: "soft-mint", name: "Soft mint", category: "solid", patch: { color: "#9fe3c8", roughness: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.5, sheen: 0.45, sheenColor: "#e4fff4" } },
  { id: "soft-butter", name: "Soft butter", category: "solid", patch: { color: "#ffe08a", roughness: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.5, sheen: 0.45, sheenColor: "#fff6d6" } },
  // Champagne: a pale gold foil, satin rather than mirror.
  { id: "champagne", name: "Champagne", category: "metal", patch: { color: "#ead2a6", metalness: 1, roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.2 } },
  { id: "silver-foil", name: "Silver foil", category: "metal", patch: { color: "#e8e9ee", metalness: 1, roughness: 0.18, surface: "hammered", surfaceScale: 3, surfaceDepth: 0.15 } },
  // Oil slick: a dichroic chrome — blue and violet in the body, pink and gold where it turns — with fine scratches that stretch the highlight.
  { id: "oil-slick", name: "Oil slick", category: "special", patch: { color: "#7f78ff", metalness: 1, roughness: 0.14, iridescence: 1, clearcoat: 0.6, clearcoatRoughness: 0.1, surface: "brushed", surfaceScale: 2, surfaceDepth: 0.18 } },
  { id: "dichroic", name: "Dichroic glass", category: "glass", patch: { color: "#c8b4ff", roughness: 0.03, transmission: 0.9, glassThickness: 1, ior: 1.6, iridescence: 1, clearcoat: 1, clearcoatRoughness: 0.03 } },
  { id: "bubble", name: "Bubble", category: "glass", patch: { color: "#ffffff", roughness: 0, transmission: 1, glassThickness: 0.1, ior: 1.2, iridescence: 1 } },
  // Frosted acrylic: the milky pastel slab — half its light is its own colour, so it stays pale on a dark backdrop.
  { id: "acrylic-peach", name: "Peach acrylic", category: "glass", patch: { color: "#ffc2aa", roughness: 0.6, transmission: 0.45, glassThickness: 1.5, ior: 1.49, clearcoat: 0.4, clearcoatRoughness: 0.15 } },
  { id: "acrylic-sky", name: "Sky acrylic", category: "glass", patch: { color: "#aedaff", roughness: 0.6, transmission: 0.45, glassThickness: 1.5, ior: 1.49, clearcoat: 0.4, clearcoatRoughness: 0.15 } },
  { id: "candy", name: "Candy", category: "glass", patch: { color: "#ff3d6e", roughness: 0.08, transmission: 0.7, glassThickness: 2, ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.04 } },
];

export function materialById(id: string): MaterialPreset {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}

export function materialPatch(id: string): Required<MaterialPatch> {
  return { ...BASE, ...materialById(id).patch };
}

/** Writes the material half of a spec onto a MeshPhysicalMaterial. Returns true if something changed that needs a recompile (flat shading). */
export function applyMaterial(mat: MeshPhysicalMaterial, spec: Spec): boolean {
  mat.color.set(spec.color);
  mat.roughness = spec.roughness;
  mat.metalness = spec.metalness;
  mat.clearcoat = spec.clearcoat;
  mat.clearcoatRoughness = spec.clearcoatRoughness;
  mat.transmission = spec.transmission;
  mat.thickness = spec.glassThickness;
  mat.ior = spec.ior;
  mat.emissive.set(spec.glowColor);
  mat.emissiveIntensity = spec.glow;
  mat.iridescence = spec.iridescence;
  mat.sheen = spec.sheen;
  mat.sheenColor.set(spec.sheenColor);
  const recompile = mat.flatShading !== spec.flat;
  mat.flatShading = spec.flat;
  if (recompile) mat.needsUpdate = true;
  // A roughness map can only darken. Its tile averages 1 − variation/2, so the
  // dial is lifted by the same amount and what you see centres on what you set.
  const variation = spec.surface === "none" ? 0 : surfaceById(spec.surface).roughnessVariation;
  mat.roughness = Math.min(1, spec.roughness / (1 - variation * 0.5));
  return recompile;
}
