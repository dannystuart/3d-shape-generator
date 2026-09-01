/**
 * Surfaces: the bumps and grooves a material wears.
 *
 * Each one is a tileable height field drawn in code — no image files, so the
 * snippet people copy carries its leather and its scales inside the engine
 * bundle. The height field becomes a normal map (which way the surface leans
 * at every point) and a roughness map (how the shine breaks up over it).
 *
 * Drawn once per surface and cached; the dials that scale and deepen it are
 * material settings, not re-draws.
 */
import { simplex3, seededRandom } from "./shapes/noise";

export type SurfaceId = "none" | "leather" | "scales" | "concrete" | "cracks" | "frost" | "hammered" | "brushed" | "weave" | "rock";

export interface Surface {
  id: SurfaceId;
  name: string;
  /** Height in 0..1 at a point in tile space (0..1 each way, wrapping). */
  height: (x: number, y: number) => number;
  /** How much of the height shows up in the roughness map: 0 keeps the dial's roughness flat across the surface. */
  roughnessVariation: number;
  /** Roughness map is inverted for these — the hollows are the rough part. */
  roughInHollows?: boolean;
  /**
   * Brightness of the material's colour at a point, 0..1, given the height
   * there. This is what makes a surface read as real rather than embossed:
   * dirt in the creases, specks in the concrete, mottling across the stone.
   * Absent means one flat colour.
   */
  tint?: (x: number, y: number, h: number) => number;
}

// 384 is tiled two to six times across a shape; at that repeat the step up to 512 is invisible and costs near double.
export const SURFACE_SIZE = 384;

// --- building blocks ---------------------------------------------------------

const TAU = Math.PI * 2;

/**
 * Noise that wraps at the tile edge without a seam: the 2D tile is mapped onto
 * a torus in 3D, so x=0 and x=1 land on the same point.
 */
function tileable(seed: number, octaves = 4, gain = 0.5, lacunarity = 2): (x: number, y: number, scale: number) => number {
  const noise = simplex3(seed);
  const R = 1.2;
  return (x, y, scale) => {
    let sum = 0,
      amp = 1,
      f = scale,
      norm = 0;
    const a = x * TAU,
      b = y * TAU;
    for (let o = 0; o < octaves; o++) {
      // The tile wrapped onto a torus in 3D: x goes round the ring, y round
      // the tube. Both directions are true circles, so neither streaks.
      const ring = R * f,
        tube = R * f * 0.6;
      const w = ring + Math.cos(b) * tube;
      const nx = Math.cos(a) * w,
        ny = Math.sin(a) * w,
        nz = Math.sin(b) * tube;
      sum += noise(nx, ny + o * 11.7, nz + o * 17.3) * amp;
      norm += amp;
      amp *= gain;
      f *= lacunarity;
    }
    return sum / norm;
  };
}

/** Seeded cell points on a wrapping grid, for Voronoi-style patterns. */
function cells(seed: number, n: number): (x: number, y: number) => { f1: number; f2: number; id: number; r: number; dx: number; dy: number } {
  const rng = seededRandom(seed);
  /** Each cell: its point, and a random number of its own for whatever a pattern wants to vary per cell. */
  const pts: [number, number, number][] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pts.push([(i + 0.2 + rng() * 0.6) / n, (j + 0.2 + rng() * 0.6) / n, rng()]);
  return (x, y) => {
    const ci = Math.floor(x * n),
      cj = Math.floor(y * n);
    let f1 = 9,
      f2 = 9,
      id = 0,
      r = 0,
      dx = 0,
      dy = 0;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const gi = (((ci + i) % n) + n) % n,
          gj = (((cj + j) % n) + n) % n;
        const [px, py, pr] = pts[gj * n + gi];
        // Shortest way round the tile, however many tiles away the sample is.
        const ox = px - x - Math.round(px - x),
          oy = py - y - Math.round(py - y);
        const d = Math.sqrt(ox * ox + oy * oy) * n;
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = gj * n + gi;
          r = pr;
          dx = ox;
          dy = oy;
        } else if (d < f2) f2 = d;
      }
    return { f1, f2, id, r, dx, dy };
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, t: number) => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};

// --- the surfaces ------------------------------------------------------------

function leather(): Pick<Surface, "height" | "tint"> {
  const grain = cells(3, 22);
  const fineGrain = cells(6, 64);
  const fine = tileable(4, 2, 0.5);
  const warp = tileable(5, 1, 0.5);
  const mottle = tileable(8, 2, 0.5);
  const height: Surface["height"] = (x, y) => {
    const w = warp(x, y, 2) * 0.015;
    const c = grain(x + w, y - w);
    const f = fineGrain(x - w, y + w);
    // Pebbles at two sizes: the big ones set the grain, the small ones sit on
    // top of them. A real hide's creases are the narrow gaps between both.
    const pebble = smooth(0.04, 0.5, c.f2 - c.f1);
    const small = smooth(0.06, 0.45, f.f2 - f.f1);
    return clamp01(0.3 + pebble * 0.4 + small * 0.18 + fine(x, y, 10) * 0.06);
  };
  return {
    height,
    // Dark in the creases, a little lighter on the pebble tops, and a slow drift of tone across the hide.
    tint: (x, y, h) => clamp01(0.72 + h * 0.3 + mottle(x, y, 1.5) * 0.08),
  };
}

function scales(): Surface["height"] {
  const fine = tileable(7, 2, 0.5);
  const rows = 8; // even, so the half-shift pattern meets itself at the tile edge
  return (x, y) => {
    // Rows of overlapping arcs, each row shifted half a scale. The scale
    // nearest the viewer (the lower one) wins, so they lap like roof tiles.
    let h = 0;
    for (let r = 0; r <= 1; r++) {
      const row = Math.floor(y * rows) + r;
      const cy = (row + 0.35) / rows;
      const shift = (((row % 2) + 2) % 2) * 0.5;
      const u = x * rows + shift;
      const cx = (Math.round(u) - shift) / rows;
      let dx = x - cx;
      if (dx > 0.5) dx -= 1;
      if (dx < -0.5) dx += 1;
      const dy = y - cy;
      const rad = Math.sqrt(dx * dx * 0.9 + dy * dy) * rows;
      // Inside the scale: a dome that rises to a lip at the bottom edge.
      if (dy <= 0.55 / rows && rad < 0.72) {
        const dome = 1 - (rad / 0.72) ** 2;
        const lip = smooth(0.72, 0.6, rad);
        h = Math.max(h, 0.25 + dome * 0.6 + lip * 0.05 + (0.55 / rows - Math.max(dy, -0.2 / rows)) * rows * 0.12);
      }
    }
    return clamp01(h + fine(x, y, 20) * 0.015);
  };
}

function concrete(): Pick<Surface, "height" | "tint"> {
  const base = tileable(11, 4, 0.55);
  const pits = cells(12, 48);
  const speck = tileable(13, 1, 0.5);
  const stain = tileable(14, 5, 0.6);
  const grit = cells(15, 120);
  const height: Surface["height"] = (x, y) => {
    // A third of the cells are pits, each its own size, with a sharp lip:
    // it is the pits, small and many, that make concrete read as concrete.
    const p = pits(x, y);
    const pit = p.r < 0.35 ? smooth(0.2 + p.r * 0.8, 0.04, p.f1) * 0.4 : 0;
    return clamp01(0.6 + base(x, y, 3) * 0.15 + speck(x, y, 40) * 0.03 - pit);
  };
  return {
    height,
    // Dark at the bottom of every pit, fine light and dark grit, broad stains across the pour.
    tint: (x, y, h) => {
      const g = grit(x, y);
      const fleck = g.r < 0.12 ? -0.16 : g.r > 0.9 ? 0.1 : 0;
      const dot = smooth(0.6, 0.2, g.f1) * fleck;
      return clamp01(0.8 + stain(x, y, 1.2) * 0.14 + (h - 0.6) * 0.9 + dot);
    },
  };
}

function cracks(): Pick<Surface, "height" | "tint"> {
  const web = cells(21, 9);
  const sub = cells(22, 26);
  const wobble = tileable(23, 1, 0.5);
  const mottle = tileable(24, 2, 0.5);
  const height: Surface["height"] = (x, y) => {
    const w = wobble(x, y, 4) * 0.01;
    const a = web(x + w, y - w);
    const b = sub(x - w, y + w);
    // Flat shards with a thin groove along every edge; a finer web of hairlines between.
    const groove = smooth(0.12, 0.0, a.f2 - a.f1) * 0.9;
    const hair = smooth(0.05, 0.0, b.f2 - b.f1) * 0.35;
    return clamp01(0.85 - groove - hair);
  };
  // Dirt settles in the cracks; each shard is a slightly different shade.
  return { height, tint: (x, y, h) => clamp01(0.6 + h * 0.4 + mottle(x, y, 5) * 0.06) };
}

function frost(): Pick<Surface, "height" | "tint"> {
  const plates = cells(31, 6);
  const shards = cells(35, 16);
  const wobble = tileable(33, 2, 0.5);
  const swell = tileable(32, 2, 0.5);
  const rime = tileable(34, 4, 0.55);
  const sparkle = cells(36, 90);
  const height: Surface["height"] = (x, y) => {
    // A sheet of ice: broad plates, each one tilted its own way so they catch
    // the light as flat facets, split by fine cracks with finer fractures
    // between, over slow swells. Frost sits in the cracks, not across the face.
    const w = wobble(x, y, 2) * 0.025;
    const p = plates(x + w, y - w);
    const tilt = (p.dx * Math.cos(p.r * TAU) + p.dy * Math.sin(p.r * TAU)) * 6 * 0.12;
    const crack = smooth(0.05, 0.0, p.f2 - p.f1) * 0.35;
    const sh = shards(x - w, y + w);
    const fracture = smooth(0.025, 0.0, sh.f2 - sh.f1) * 0.12;
    return clamp01(0.62 + tilt + swell(x, y, 1.5) * 0.12 - crack - fracture);
  };
  return {
    height,
    // Bright frost blooms along every crack, rime drifts across in patches, and a scatter of bright crystals.
    tint: (x, y, h) => {
      const bloom = (0.62 - h) * 1.6;
      const patch = smooth(0.1, 0.45, rime(x, y, 2)) * 0.12;
      const sp = sparkle(x, y);
      const crystal = sp.r > 0.85 ? smooth(0.35, 0.1, sp.f1) * 0.18 : 0;
      return clamp01(0.86 + Math.max(0, bloom) + patch + crystal);
    },
  };
}

function hammered(): Surface["height"] {
  const dents = cells(41, 10);
  const fine = tileable(42, 2, 0.5);
  return (x, y) => {
    const c = dents(x, y);
    // Every cell a shallow round dent: deepest at its centre, flat at the rim.
    const bowl = 1 - smooth(0.0, 0.9, c.f1) ** 2;
    return clamp01(0.3 + (1 - bowl) * 0.55 + fine(x, y, 30) * 0.01);
  };
}

function brushed(): Surface["height"] {
  const streak = tileable(51, 4, 0.6);
  // Lines along x: a function of y alone wraps perfectly; a little low-frequency x breaks the monotony.
  return (x, y) => clamp01(0.5 + streak(0, y, 40) * 0.32 + streak(x, y, 3) * 0.1);
}

function weave(): Surface["height"] {
  const n = 24;
  const fine = tileable(61, 2, 0.5);
  return (x, y) => {
    // Over-and-under: a thread is a half-cylinder, and alternate cells swap which way it runs.
    const u = x * n,
      v = y * n;
    const over = (Math.floor(u) + Math.floor(v)) % 2 === 0;
    const t = over ? v - Math.floor(v) : u - Math.floor(u);
    const thread = Math.sin(t * Math.PI);
    return clamp01(0.2 + thread * 0.65 + (over ? 0.05 : 0) + fine(x, y, 50) * 0.015);
  };
}

function rock(): Pick<Surface, "height" | "tint"> {
  const chunks = cells(70, 6);
  const big = tileable(71, 4, 0.55);
  const ridged = tileable(72, 3, 0.5);
  const warp = tileable(73, 1, 0.5);
  const mottle = tileable(74, 5, 0.55);
  const height: Surface["height"] = (x, y) => {
    const w = warp(x, y, 3) * 0.03;
    const c = chunks(x + w, y - w);
    // Broken ground: big facets that drop off at their edges, with ridges and grit across each.
    const facet = smooth(0.0, 0.35, c.f2 - c.f1) * 0.35 + c.r * 0.15;
    const r = 1 - Math.abs(ridged(x, y, 3));
    return clamp01(0.2 + facet + big(x, y, 2) * 0.2 + r * 0.15);
  };
  return {
    height,
    // Mineral mottling, light on the worn tops and dark in the seams.
    tint: (x, y, h) => clamp01(0.68 + h * 0.3 + mottle(x, y, 2) * 0.14),
  };
}

export const SURFACES: Surface[] = [
  { id: "none", name: "Smooth", height: () => 0.5, roughnessVariation: 0 },
  { id: "leather", name: "Leather", ...leather(), roughnessVariation: 0.5, roughInHollows: true },
  { id: "scales", name: "Scales", height: scales(), roughnessVariation: 0.3, roughInHollows: true },
  { id: "concrete", name: "Concrete", ...concrete(), roughnessVariation: 0.45, roughInHollows: true },
  { id: "cracks", name: "Cracks", ...cracks(), roughnessVariation: 0.8, roughInHollows: true },
  { id: "frost", name: "Ice", ...frost(), roughnessVariation: 0.7, roughInHollows: true },
  { id: "hammered", name: "Hammered", height: hammered(), roughnessVariation: 0.2 },
  { id: "brushed", name: "Brushed", height: brushed(), roughnessVariation: 0.5 },
  { id: "weave", name: "Weave", height: weave(), roughnessVariation: 0.3, roughInHollows: true },
  { id: "rock", name: "Rock", ...rock(), roughnessVariation: 0.4 },
];

export function surfaceById(id: string): Surface {
  return SURFACES.find((s) => s.id === id) ?? SURFACES[0];
}

/** The height field sampled onto a grid, wrapping, as 0..1 floats. */
export function heightField(surface: Surface, size = SURFACE_SIZE): Float32Array {
  const out = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) out[j * size + i] = surface.height(i / size, j / size);
  return out;
}

/**
 * Normal and roughness maps as RGBA bytes, ready for a canvas.
 *
 * The normal is the slope of the height field, wrapping at the edges so the
 * tile joins itself. Roughness is the height (or its inverse), pulled towards
 * 0.5 by the surface's own variation, so the material's roughness dial stays
 * the centre of what you see.
 */
export function surfaceMaps(surface: Surface, size = SURFACE_SIZE): { normal: Uint8ClampedArray; roughness: Uint8ClampedArray; color: Uint8ClampedArray | null } {
  const h = heightField(surface, size);
  const normal = new Uint8ClampedArray(size * size * 4);
  const roughness = new Uint8ClampedArray(size * size * 4);
  const color = surface.tint ? new Uint8ClampedArray(size * size * 4) : null;
  // Slope per pixel of height. The height fields are 0..1 across a feature a
  // tenth of a tile wide, so this lands a full feature at about 45°.
  const strength = size / 96;
  for (let j = 0; j < size; j++) {
    const up = ((j - 1 + size) % size) * size,
      down = ((j + 1) % size) * size,
      row = j * size;
    for (let i = 0; i < size; i++) {
      const l = h[row + ((i - 1 + size) % size)],
        r = h[row + ((i + 1) % size)],
        u = h[up + i],
        d = h[down + i];
      let nx = (l - r) * strength,
        ny = (d - u) * strength,
        nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const o = (row + i) * 4;
      normal[o] = (nx * 0.5 + 0.5) * 255;
      normal[o + 1] = (ny * 0.5 + 0.5) * 255;
      normal[o + 2] = (nz * 0.5 + 0.5) * 255;
      normal[o + 3] = 255;
      const height = h[row + i];
      const v = surface.roughInHollows ? 1 - height : height;
      // A map can only take roughness away, so it runs from 1 − variation up to 1; applyMaterial lifts the dial to match.
      const rough = 1 - surface.roughnessVariation * (1 - v);
      // Three reads roughness from the green channel; the rest is left neutral.
      roughness[o] = 255;
      roughness[o + 1] = rough * 255;
      roughness[o + 2] = 255;
      roughness[o + 3] = 255;
      if (color && surface.tint) {
        const t = surface.tint(i / size, j / size, height) * 255;
        color[o] = t;
        color[o + 1] = t;
        color[o + 2] = t;
        color[o + 3] = 255;
      }
    }
  }
  return { normal, roughness, color };
}

// --- textures ----------------------------------------------------------------
// Kept out of the surface definitions so the maths above runs anywhere —
// tests, the prompt, a server — and only a renderer pulls in Three's textures.
