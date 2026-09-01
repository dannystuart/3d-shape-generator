/**
 * Gradient backdrops to pick from: soft, current palettes — the pastel pairs
 * a product shot sits on — plus a few deep ones. Each is two colours and an
 * angle, so picking one is just the Backdrop dials set at once.
 */
export interface BackdropPreset {
  id: string;
  name: string;
  color: string;
  color2: string;
  angle: number;
}

export const BACKDROPS: BackdropPreset[] = [
  { id: "peach", name: "Peach", color: "#ffd6c2", color2: "#ffb38a", angle: 180 },
  { id: "blush", name: "Blush", color: "#ffe1e8", color2: "#f7b2c4", angle: 160 },
  { id: "lavender", name: "Lavender", color: "#e6e0ff", color2: "#c3b5ff", angle: 180 },
  { id: "sky", name: "Sky", color: "#d9efff", color2: "#a9ccff", angle: 180 },
  { id: "mint", name: "Mint", color: "#e4fbf2", color2: "#a8e8cf", angle: 180 },
  { id: "butter", name: "Butter", color: "#fff5cc", color2: "#ffd98a", angle: 180 },
  { id: "sand", name: "Sand", color: "#f5ece0", color2: "#dcc7ab", angle: 180 },
  { id: "sorbet", name: "Sorbet", color: "#ffd1dc", color2: "#ffe6b8", angle: 135 },
  { id: "lilac-sky", name: "Lilac sky", color: "#c9d7ff", color2: "#f0c8f5", angle: 150 },
  { id: "seafoam", name: "Seafoam", color: "#c4f0ea", color2: "#d8ddff", angle: 135 },
  { id: "coral", name: "Coral", color: "#ff8a80", color2: "#ffb7a3", angle: 160 },
  { id: "iris", name: "Iris", color: "#7a7cff", color2: "#c9a8ff", angle: 170 },
  { id: "tangerine", name: "Tangerine", color: "#ffb46a", color2: "#ffe2b0", angle: 170 },
  { id: "rose-gold", name: "Rose gold", color: "#f3c6b6", color2: "#e9a28f", angle: 180 },
  { id: "dusk", name: "Dusk", color: "#6b5b95", color2: "#f4a6a6", angle: 180 },
  { id: "ink", name: "Ink", color: "#1d2140", color2: "#3d4a8a", angle: 180 },
  { id: "charcoal", name: "Charcoal", color: "#2b2c31", color2: "#141418", angle: 180 },
  { id: "cream", name: "Cream", color: "#fbf8f2", color2: "#ece4d6", angle: 180 },
];

export function backdropById(id: string): BackdropPreset | undefined {
  return BACKDROPS.find((b) => b.id === id);
}

/** The preset a spec currently matches, if any — so the picker can show it as chosen. */
export function backdropMatching(spec: { backdrop: string; backdropColor: string; backdropColor2: string; backdropAngle: number }): string | undefined {
  if (spec.backdrop !== "gradient") return undefined;
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return BACKDROPS.find((b) => same(b.color, spec.backdropColor) && same(b.color2, spec.backdropColor2) && b.angle === spec.backdropAngle)?.id;
}
