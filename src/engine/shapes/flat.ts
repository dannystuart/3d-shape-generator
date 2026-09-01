/**
 * The flat shapes: SVG path data in a 100×100 box, each extruded by
 * `extrudePath`. Regular shapes are generated so the data is exact; organic
 * ones are hand-drawn and kept to a few curves — the bevel does the prettiness.
 *
 * Every path is a clean outline with no overlapping subpaths. Overlaps look
 * fine as a 2D fill but extrude into coincident faces that flicker, so shapes
 * that are really a union of simpler pieces (flowers, asterisks, clouds) are
 * traced as one outline by sampling their silhouette around a centre.
 */

export interface FlatShape {
  id: string;
  name: string;
  path: string;
  keywords?: string[];
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const pt = (a: number, r: number, cx = 50, cy = 50) => `${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`;

/** Closes a list of "x y" strings into one subpath. */
const poly = (points: string[]) => `M${points.join("L")}Z`;

/** A star with `n` points, outer radius 50, inner radius `inner`, one point straight up. */
export function starPath(n: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
    points.push(pt(a, i % 2 === 0 ? 50 : inner));
  }
  return poly(points);
}

type Inside = (x: number, y: number) => boolean;

/**
 * Traces the silhouette of a union of convex pieces that all contain the
 * centre, by walking a ray out from the centre at every angle until it leaves
 * the last piece. Exact enough at 256 samples that the bevel hides the rest.
 */
function silhouette(pieces: Inside[], cx = 50, cy = 50, samples = 256): string {
  const points: string[] = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    let lo = 0, hi = 80;
    for (let k = 0; k < 28; k++) {
      const mid = (lo + hi) / 2;
      const x = cx + dx * mid, y = cy + dy * mid;
      if (pieces.some((inside) => inside(x, y))) lo = mid;
      else hi = mid;
    }
    points.push(`${f(cx + dx * lo)} ${f(cy + dy * lo)}`);
  }
  return poly(points);
}

const disc = (x0: number, y0: number, r: number): Inside => (x, y) => (x - x0) ** 2 + (y - y0) ** 2 <= r * r;

/** A rounded bar through the centre: total `length`, `width`, turned by `angle`. */
const bar = (length: number, width: number, angle: number, cx = 50, cy = 50): Inside => {
  const h = Math.max(length / 2 - width / 2, 0), w = width / 2;
  const c = Math.cos(angle), s = Math.sin(angle);
  return (x, y) => {
    const px = (x - cx) * c + (y - cy) * s, py = -(x - cx) * s + (y - cy) * c;
    const qx = Math.max(-h, Math.min(h, px));
    return (px - qx) ** 2 + py * py <= w * w;
  };
};

/** A flower of `n` round petals of radius `r` on a ring of radius `d`, with a centre disc filling the middle. */
export function flowerPath(n: number, r: number, d: number): string {
  const petals = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return disc(50 + Math.cos(a) * d, 50 + Math.sin(a) * d, r);
  });
  return silhouette([...petals, disc(50, 50, d)]);
}

/** A gear: `n` teeth as a polygon alternating between `outer` and `inner` radii; `tooth` is the share of each pitch that is tooth. */
export function gearPath(n: number, outer: number, inner: number, tooth: number): string {
  const points: string[] = [];
  const pitch = (Math.PI * 2) / n;
  const t = pitch * tooth, g = pitch - t, lean = Math.min(t, g) * 0.18;
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 - t / 2 + i * pitch;
    points.push(pt(a0 - lean, inner), pt(a0 + lean, outer), pt(a0 + t - lean, outer), pt(a0 + t + lean, inner));
    // the gap between teeth sits on the inner radius, so no points are needed there
  }
  return poly(points);
}

/** `n` rounded bars of `length` and `width` crossing at the centre. */
export function asteriskPath(n: number, length: number, width: number): string {
  return silhouette(Array.from({ length: n }, (_, i) => bar(length, width, -Math.PI / 2 + (i / n) * Math.PI)));
}

/**
 * A rounded regular polygon: `sides` corners, `corner` 0..1 of rounding. Used
 * by the Dynamic shape, so sides=4 runs from a square to a squircle and
 * sides=64 is a circle. Even-sided shapes sit on a flat edge; odd ones point up.
 */
export function dynamicPath(sides: number, corner: number): string {
  sides = Math.max(3, Math.round(sides));
  const r = 50;
  const start = sides % 2 === 0 ? -Math.PI / 2 + Math.PI / sides : -Math.PI / 2;
  const vertex = (i: number) => {
    const a = start + (i / sides) * Math.PI * 2;
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r] as const;
  };
  const edgeLen = 2 * r * Math.sin(Math.PI / sides);
  const rc = Math.min(Math.max(corner, 0), 1) * (edgeLen / 2);
  let d = "";
  for (let i = 0; i < sides; i++) {
    const [x0, y0] = vertex(i), [x1, y1] = vertex(i + 1), [x2, y2] = vertex(i + 2);
    const ex = (x1 - x0) / edgeLen, ey = (y1 - y0) / edgeLen;
    const nx = (x2 - x1) / edgeLen, ny = (y2 - y1) / edgeLen;
    const sx = x0 + ex * rc, sy = y0 + ey * rc;
    const tx = x1 - ex * rc, ty = y1 - ey * rc;
    const ux = x1 + nx * rc, uy = y1 + ny * rc;
    d += (i === 0 ? `M${f(sx)} ${f(sy)}` : `L${f(sx)} ${f(sy)}`) + `L${f(tx)} ${f(ty)}`;
    if (rc > 0) d += `Q${f(x1)} ${f(y1)} ${f(ux)} ${f(uy)}`;
  }
  return d + "Z";
}

/** A circle subpath. Clockwise in screen coordinates when `cw`; holes go the other way. */
const circle = (cx: number, cy: number, r: number, cw = true) =>
  `M${f(cx - r)} ${f(cy)}A${r} ${r} 0 1 ${cw ? 1 : 0} ${f(cx + r)} ${f(cy)}A${r} ${r} 0 1 ${cw ? 1 : 0} ${f(cx - r)} ${f(cy)}Z`;

const annulus = (cx: number, cy: number, outer: number, inner: number) => circle(cx, cy, outer) + circle(cx, cy, inner, false);

function ringsPath(): string {
  return annulus(50, 50, 50, 42) + annulus(50, 50, 34, 26) + annulus(50, 50, 18, 10);
}

function dotsPath(): string {
  let d = "";
  for (const y of [16, 50, 84]) for (const x of [16, 50, 84]) d += circle(x, y, 12);
  return d;
}

/** An arc-shaped arrow: an annular sector from `a0` over `span`, with an arrowhead on the end. */
function arcArrow(a0: number, span: number, inner: number, outer: number, head: number): string {
  const steps = 24;
  const points: string[] = [];
  const aEnd = a0 + span;
  for (let i = 0; i <= steps; i++) points.push(pt(a0 + (span * i) / steps, outer));
  const mid = (inner + outer) / 2, half = (outer - inner) / 2;
  points.push(pt(aEnd, outer + half * 0.9), pt(aEnd + head, mid), pt(aEnd, inner - half * 0.9));
  for (let i = steps; i >= 0; i--) points.push(pt(a0 + (span * i) / steps, inner));
  return poly(points);
}

function recyclePath(): string {
  let d = "";
  for (let i = 0; i < 3; i++) d += arcArrow(-Math.PI / 2 + (i * Math.PI * 2) / 3, 1.45, 30, 50, 0.32);
  return d;
}

function hexpiePath(): string {
  let d = "";
  const gap = 0.12;
  for (let i = 0; i < 6; i++) {
    const a0 = -Math.PI / 2 + (i * Math.PI) / 3 + gap, a1 = a0 + Math.PI / 3 - gap * 2;
    const steps = 10;
    const points: string[] = [];
    for (let k = 0; k <= steps; k++) points.push(pt(a0 + ((a1 - a0) * k) / steps, 50));
    points.push(pt(a1, 12), pt(a0, 12));
    d += poly(points);
  }
  return d;
}

/** Four curved blades, as a sawtooth in polar coordinates with a soft curve on each blade. */
function pinwheelPath(): string {
  const samples = 320;
  const points: string[] = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const k = ((a / (Math.PI * 2)) * 4) % 1;
    const r = 14 + 36 * Math.pow(Math.sin((k * Math.PI) / 2), 0.8);
    points.push(pt(a, r));
  }
  return poly(points);
}

/** Three lobes on a flat, rounded base. */
function cloudPath(): string {
  return silhouette([bar(72, 30, 0, 50, 66), disc(33, 55, 19), disc(67, 55, 19), disc(50, 38, 24)], 50, 60);
}

/** A tilted ellipse subpath, wound the opposite way so it cuts a hole. */
const ellipseHole = (cx: number, cy: number, rx: number, ry: number, tilt: number) => {
  const c = Math.cos((tilt * Math.PI) / 180), s = Math.sin((tilt * Math.PI) / 180);
  const x0 = cx - rx * c, y0 = cy - rx * s, x1 = cx + rx * c, y1 = cy + rx * s;
  return `M${f(x0)} ${f(y0)}A${rx} ${ry} ${tilt} 1 0 ${f(x1)} ${f(y1)}A${rx} ${ry} ${tilt} 1 0 ${f(x0)} ${f(y0)}Z`;
};

const alienPath = () =>
  "M50 8C74 8 88 30 88 52C88 78 66 94 50 94C34 94 12 78 12 52C12 30 26 8 50 8Z" +
  ellipseHole(34, 56, 11, 6, 35) +
  ellipseHole(66, 56, 11, 6, -35);

export const FLAT_SHAPES: FlatShape[] = [
  { id: "dynamic", name: "Dynamic shape", path: dynamicPath(4, 0.5), keywords: ["square", "circle", "rounded", "polygon"] },
  { id: "star-4", name: "Sparkle", path: starPath(4, 18), keywords: ["star", "twinkle"] },
  { id: "star-5", name: "Star", path: starPath(5, 22) },
  { id: "star-6", name: "Star 6", path: starPath(6, 30) },
  { id: "star-8", name: "Star 8", path: starPath(8, 34) },
  { id: "flower-5", name: "Flower", path: flowerPath(5, 19, 27) },
  { id: "flower-6", name: "Flower 6", path: flowerPath(6, 17, 28) },
  { id: "flower-8", name: "Flower 8", path: flowerPath(8, 14, 31) },
  { id: "flower-12", name: "Daisy", path: flowerPath(12, 10, 36), keywords: ["flower"] },
  { id: "gear", name: "Gear", path: gearPath(8, 50, 38, 0.5), keywords: ["cog", "settings"] },
  { id: "asterisk", name: "Asterisk", path: asteriskPath(3, 100, 18), keywords: ["star"] },
  { id: "star-wheel", name: "Star wheel", path: asteriskPath(4, 100, 14), keywords: ["asterisk"] },
  { id: "heart", name: "Heart", path: "M50 88C20 65 5 48 5 30A20 20 0 0 1 50 22A20 20 0 0 1 95 30C95 48 80 65 50 88Z", keywords: ["love"] },
  { id: "cloud", name: "Cloud", path: cloudPath(), keywords: ["weather"] },
  { id: "raindrop", name: "Raindrop", path: "M50 5C60 28 80 40 80 62A30 30 0 0 1 20 62C20 40 40 28 50 5Z", keywords: ["drop", "water"] },
  { id: "eye", name: "Eye", path: "M5 50C25 20 75 20 95 50C75 80 25 80 5 50ZM50 32A18 18 0 1 0 50 68A18 18 0 1 0 50 32Z" },
  { id: "cross", name: "Rounded cross", path: asteriskPath(2, 100, 28), keywords: ["plus", "health"] },
  { id: "hourglass", name: "Hourglass", path: "M20 10H80Q80 35 55 50Q80 65 80 90H20Q20 65 45 50Q20 35 20 10Z", keywords: ["time"] },
  { id: "ring", name: "Ring", path: annulus(50, 50, 50, 22), keywords: ["donut", "circle"] },
  { id: "rings", name: "Rings", path: ringsPath(), keywords: ["target", "concentric"] },
  { id: "hexagon", name: "Hexagon", path: dynamicPath(6, 0.15) },
  { id: "triangle", name: "Triangle", path: dynamicPath(3, 0.3) },
  { id: "squircle", name: "Squircle", path: dynamicPath(4, 0.8), keywords: ["app icon", "rounded square"] },
  { id: "moon", name: "Moon", path: "M71 10.2A45 45 0 1 0 71 89.8A40 40 0 0 1 71 10.2Z", keywords: ["crescent", "night"] },
  { id: "lightning", name: "Lightning", path: "M58 5L22 55H45L40 95L78 40H55Z", keywords: ["bolt", "flash"] },
  { id: "arrow", name: "Arrow", path: "M10 40H55V20L92 50L55 80V60H10Z" },
  { id: "pinwheel", name: "Pinwheel", path: pinwheelPath(), keywords: ["shuriken", "blades"] },
  { id: "blob", name: "Blob", path: "M30 12C50 2 78 8 88 30C98 52 86 80 62 90C38 100 12 86 8 62C4 38 12 20 30 12Z", keywords: ["organic"] },
  { id: "alien", name: "Alien", path: alienPath(), keywords: ["ufo", "face"] },
  { id: "recycle", name: "Recycle", path: recyclePath(), keywords: ["arrows", "loop"] },
  { id: "wheel", name: "Wheel", path: gearPath(12, 50, 20, 0.35), keywords: ["sun", "spokes"] },
  { id: "dots", name: "Dot grid", path: dotsPath(), keywords: ["grid", "circles"] },
  { id: "hexpie", name: "Hex pie", path: hexpiePath(), keywords: ["wedges", "segments"] },
];
