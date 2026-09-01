export type EnvironmentKind = "hdr" | "gradient";

export interface Lamp {
  x: number;
  y: number;
  size: number;
  color: string;
  strength: number;
}

export interface Environment {
  id: string;
  name: string;
  kind: EnvironmentKind;
  /** For hdr: the file name under /env/. */
  file?: string;
  /** For gradient: sky, horizon, ground — and optional hot spots (a "lamp" in the map) for studio-like highlights. */
  stops?: { top: string; middle: string; bottom: string; lamps?: Lamp[] };
  /** Poly Haven id, for the credit line in the README. */
  source?: string;
}

export const ENVIRONMENTS: Environment[] = [
  { id: "studio-soft", name: "Studio soft", kind: "hdr", file: "studio-soft.hdr", source: "studio_small_09" },
  { id: "studio-hard", name: "Studio hard", kind: "hdr", file: "studio-hard.hdr", source: "studio_small_03" },
  { id: "photo-studio", name: "Photo studio", kind: "hdr", file: "photo-studio.hdr", source: "brown_photostudio_02" },
  { id: "warehouse", name: "Warehouse", kind: "hdr", file: "warehouse.hdr", source: "empty_warehouse_01" },
  { id: "overcast", name: "Overcast sky", kind: "hdr", file: "overcast.hdr", source: "kloofendal_48d_partly_cloudy_puresky" },
  { id: "sunset", name: "Sunset", kind: "hdr", file: "sunset.hdr", source: "venice_sunset" },
  { id: "city", name: "City", kind: "hdr", file: "city.hdr", source: "potsdamer_platz" },
  { id: "night", name: "Night", kind: "hdr", file: "night.hdr", source: "moonless_golf" },
  { id: "grad-dawn", name: "Dawn", kind: "gradient", stops: { top: "#1b2a6b", middle: "#ff9a7a", bottom: "#3a2b4a" } },
  { id: "grad-ocean", name: "Ocean", kind: "gradient", stops: { top: "#0a1f5c", middle: "#2fb4ff", bottom: "#06213a" } },
  { id: "grad-candy", name: "Candy", kind: "gradient", stops: { top: "#ff7ad9", middle: "#ffe3f3", bottom: "#7a4dff" } },
  { id: "grad-ember", name: "Ember", kind: "gradient", stops: { top: "#1a0b0b", middle: "#ff6a2a", bottom: "#2b0f05" } },
  { id: "grad-mint", name: "Mint", kind: "gradient", stops: { top: "#e8fff4", middle: "#5ee8b0", bottom: "#0d3b2e" } },
  { id: "grad-mono", name: "Mono", kind: "gradient", stops: { top: "#ffffff", middle: "#9a9a9a", bottom: "#101010" } },
  // Holo: the pink-over-blue room a dichroic chrome wants — it is the
  // environment, not the metal, that puts the colour in a reflection.
  {
    id: "grad-holo",
    name: "Holo",
    kind: "gradient",
    stops: {
      top: "#ff8fd2",
      middle: "#b9b4ff",
      bottom: "#5fd0ff",
      lamps: [
        { x: 0.25, y: 0.35, size: 0.2, color: "#ffffff", strength: 3 },
        { x: 0.7, y: 0.6, size: 0.16, color: "#fff0c8", strength: 2 },
      ],
    },
  },
  // Pastel studio: bright and soft all round, so a matte shape looks lit from a white room and a chrome one stays pale.
  {
    id: "grad-pastel",
    name: "Pastel studio",
    kind: "gradient",
    stops: {
      top: "#ffe4ef",
      middle: "#fbfbff",
      bottom: "#d9e6ff",
      lamps: [{ x: 0.3, y: 0.3, size: 0.22, color: "#ffffff", strength: 1.5 }],
    },
  },
  {
    id: "grad-lamp",
    name: "Softbox",
    kind: "gradient",
    stops: {
      top: "#2a2a2e",
      middle: "#3a3a40",
      bottom: "#141416",
      lamps: [
        { x: 0.3, y: 0.3, size: 0.18, color: "#ffffff", strength: 4 },
        { x: 0.75, y: 0.4, size: 0.1, color: "#ffe9d0", strength: 2.5 },
      ],
    },
  },
  {
    id: "grad-neon",
    name: "Neon room",
    kind: "gradient",
    stops: {
      top: "#12002a",
      middle: "#3b0a6b",
      bottom: "#050010",
      lamps: [
        { x: 0.2, y: 0.5, size: 0.12, color: "#ff2fa3", strength: 5 },
        { x: 0.8, y: 0.5, size: 0.12, color: "#1aa3ff", strength: 5 },
      ],
    },
  },
];

export function environmentById(id: string): Environment {
  return ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0];
}

/** The gradient an HDRI falls back to when it cannot be loaded. */
export const FALLBACK_ENVIRONMENT = "grad-mono";

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/** Float RGBA pixels of an equirect gradient, linear light, top row = zenith. Lamps are added on top so a gradient can still throw a highlight. */
export function gradientPixels(env: Environment, width: number, height: number): { data: Float32Array; width: number; height: number } {
  const s = env.stops!;
  const top = hex(s.top), mid = hex(s.middle), bot = hex(s.bottom);
  const lamps = (s.lamps ?? []).map((l) => ({ ...l, rgb: hex(l.color) }));
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const base = v < 0.5 ? mix(top, mid, v * 2) : mix(mid, bot, (v - 0.5) * 2);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      let [r, g, b] = base;
      for (const lamp of lamps) {
        // The map wraps horizontally, so measure the shorter way round.
        const dx = Math.min(Math.abs(u - lamp.x), 1 - Math.abs(u - lamp.x)) * 2, dy = v - lamp.y;
        const d = Math.sqrt(dx * dx + dy * dy) / lamp.size;
        const k = Math.max(0, 1 - d * d) * lamp.strength;
        r += lamp.rgb[0] * k;
        g += lamp.rgb[1] * k;
        b += lamp.rgb[2] * k;
      }
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }
  return { data, width, height };
}
