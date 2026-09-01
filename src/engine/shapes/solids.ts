/**
 * The solid shapes: each built from Three's primitives or our own sweeps and
 * lathes, with up to three dials of its own. Every builder returns a normalised
 * geometry — unit bounding sphere, centred — so the camera and the lights never
 * need per-shape tuning.
 */
import {
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  Curve,
  IcosahedronGeometry,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  Vector2,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { extrudePath } from "./extrude";
import { dynamicPath } from "./flat";
import { circleProfile, displace, lathe, normalise, polygonProfile, sweep } from "./geometry";
import { seededRandom, simplex3 } from "./noise";

export interface Dial {
  key: "shapeA" | "shapeB" | "shapeC";
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface SolidShape {
  id: string;
  name: string;
  keywords?: string[];
  dials: Dial[];
  /** A caveat shown under the tile, e.g. for the pipe shapes whose joins show through glass. */
  note?: string;
  build: (a: number, b: number, c: number) => BufferGeometry;
}

const A = (label: string, min: number, max: number, def: number, step = 0.01, unit?: string): Dial => ({ key: "shapeA", label, min, max, step, default: def, unit });
const B = (label: string, min: number, max: number, def: number, step = 0.01, unit?: string): Dial => ({ key: "shapeB", label, min, max, step, default: def, unit });
const C = (label: string, min: number, max: number, def: number, step = 0.01, unit?: string): Dial => ({ key: "shapeC", label, min, max, step, default: def, unit });

/** Flat facets: unshare every vertex so each face gets its own normal. */
function faceted(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  out.computeVertexNormals();
  return out;
}

/**
 * Merges parts into one geometry; everything is made non-indexed first because
 * mergeGeometries needs matching attribute sets. The parts keep their own
 * smooth normals — recomputing them on an unshared mesh gives every face its
 * own, which is a faceted tube — and their own texture maps, so a surface
 * wraps each arm or petal the way it would wrap that part on its own.
 */
function merge(parts: BufferGeometry[]): BufferGeometry {
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
}

// --- curves ------------------------------------------------------------------

class CircleCurve extends Curve<Vector3> {
  constructor(private radius: number) {
    super();
  }
  getPoint(t: number, target = new Vector3()): Vector3 {
    const a = t * Math.PI * 2;
    return target.set(Math.cos(a) * this.radius, Math.sin(a) * this.radius, 0);
  }
}

class HelixCurve extends Curve<Vector3> {
  constructor(private turns: number, private height: number, private radius = 1) {
    super();
  }
  getPoint(t: number, target = new Vector3()): Vector3 {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.radius, (t - 0.5) * this.height, Math.sin(a) * this.radius);
  }
}

/** A spiral wound around a sphere from pole to pole. */
class SphereSpiralCurve extends Curve<Vector3> {
  constructor(private turns: number) {
    super();
  }
  getPoint(t: number, target = new Vector3()): Vector3 {
    // Ease the poles so the tube does not bunch up where the spiral tightens.
    const theta = Math.acos(1 - 2 * t);
    const phi = t * this.turns * Math.PI * 2;
    return target.set(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
  }
}

// --- profiles ------------------------------------------------------------------

/** Rounds every interior corner of an open polyline (x = radius, y = height) so a lathe of it has soft edges. */
function roundCorners(points: Vector2[], radius: number, segments = 8): Vector2[] {
  if (radius <= 0) return points;
  const out: Vector2[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1], c = points[i], n = points[i + 1];
    const inLen = c.distanceTo(p), outLen = n.distanceTo(c);
    const r = Math.min(radius, inLen * 0.49, outLen * 0.49);
    const a = c.clone().lerp(p, r / inLen), b = c.clone().lerp(n, r / outLen);
    out.push(a);
    for (let k = 1; k < segments; k++) {
      const t = k / segments;
      out.push(a.clone().multiplyScalar((1 - t) ** 2).add(c.clone().multiplyScalar(2 * (1 - t) * t)).add(b.clone().multiplyScalar(t * t)));
    }
    out.push(b);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** A closed rounded-rectangle loop, counter-clockwise, for lathing rings. */
function roundedRectLoop(cx: number, cy: number, w: number, h: number, r: number, segments = 6): Vector2[] {
  r = Math.min(r, w / 2, h / 2);
  const corners: [number, number, number][] = [
    [cx + w / 2 - r, cy + h / 2 - r, 0],
    [cx - w / 2 + r, cy + h / 2 - r, Math.PI / 2],
    [cx - w / 2 + r, cy - h / 2 + r, Math.PI],
    [cx + w / 2 - r, cy - h / 2 + r, Math.PI * 1.5],
  ];
  const out: Vector2[] = [];
  for (const [x, y, start] of corners)
    for (let k = 0; k <= segments; k++) {
      const a = start + ((Math.PI / 2) * k) / segments;
      out.push(new Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r));
    }
  out.push(out[0].clone());
  return out;
}

function roundedRectPath(w: number, h: number, r: number): string {
  const x0 = (100 - w) / 2, y0 = (100 - h) / 2, x1 = x0 + w, y1 = y0 + h;
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
  return `M${x0 + r} ${y0}H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
}

// --- the catalogue -----------------------------------------------------------

export const SOLID_SHAPES: SolidShape[] = [
  { id: "sphere", name: "Sphere", keywords: ["ball", "orb"], dials: [], build: () => normalise(new SphereGeometry(1, 96, 64)) },
  {
    id: "cube",
    name: "Rounded cube",
    keywords: ["box", "dice"],
    dials: [A("Rounding", 0, 0.5, 0.18)],
    // Radius never exceeds half the side, which is where a rounded box turns itself inside out.
    build: (a) => normalise(new RoundedBoxGeometry(2, 2, 2, 8, Math.min(a * 2, 0.999))),
  },
  {
    id: "card",
    name: "Card",
    keywords: ["rectangle", "plate"],
    dials: [A("Corner", 0, 0.5, 0.2), B("Thickness", 0.02, 0.3, 0.08)],
    build: (a, b) => extrudePath(roundedRectPath(70, 100, a * 70), { thickness: b, rounding: 0.6, twist: 0 }),
  },
  {
    id: "coin",
    name: "Coin",
    keywords: ["disc", "puck"],
    dials: [A("Thickness", 0.05, 0.5, 0.15)],
    build: (a) => extrudePath(dynamicPath(64, 1), { thickness: a, rounding: 0.5, twist: 0 }),
  },
  {
    id: "cylinder",
    name: "Cylinder",
    keywords: ["tube", "can"],
    dials: [A("Height", 0.3, 3, 1.6), B("Rounding", 0, 0.5, 0.15)],
    build: (a, b) => {
      const h = a / 2;
      const profile = roundCorners([new Vector2(0, -h), new Vector2(1, -h), new Vector2(1, h), new Vector2(0, h)], b * 2 * Math.min(1, h), 10);
      return normalise(lathe(profile, 96));
    },
  },
  { id: "capsule", name: "Capsule", keywords: ["pill"], dials: [A("Length", 0, 2, 1)], build: (a) => normalise(new CapsuleGeometry(0.5, a, 16, 48)) },
  {
    id: "pill",
    name: "Pill",
    keywords: ["tablet", "capsule"],
    dials: [A("Length", 0, 2, 1.2), B("Squash", 0.3, 1, 0.55)],
    build: (a, b) => normalise(new CapsuleGeometry(0.5, a, 16, 48).rotateZ(Math.PI / 2).scale(1, b, 1)),
  },
  {
    id: "torus",
    name: "Torus",
    keywords: ["donut", "ring"],
    dials: [A("Tube", 0.05, 0.6, 0.3), B("Twist", 0, 6, 0, 1, " turns"), C("Sides", 3, 64, 64, 1)],
    build: (a, b, c) => normalise(sweep(new CircleCurve(1), polygonProfile(a, Math.round(c), 0.15), 128, b)),
  },
  { id: "torus-fat", name: "Fat torus", keywords: ["donut"], dials: [A("Tube", 0.3, 0.9, 0.7)], build: (a) => normalise(new TorusGeometry(1, a, 48, 96)) },
  {
    id: "ring-thin",
    name: "Thin ring",
    keywords: ["band", "hoop"],
    dials: [A("Tube", 0.02, 0.2, 0.08), B("Height", 0.1, 1, 0.4)],
    build: (a, b) => normalise(lathe(roundedRectLoop(1, 0, a, b, Math.min(a, b) / 2), 128)),
  },
  {
    id: "torus-twisted",
    name: "Twisted torus",
    keywords: ["donut", "spiral"],
    dials: [A("Twist", 1, 8, 3, 1, " turns"), B("Sides", 3, 6, 4, 1), C("Tube", 0.15, 0.5, 0.32)],
    build: (a, b, c) => normalise(sweep(new CircleCurve(1), polygonProfile(c, Math.round(b), 0.25), 160, a)),
  },
  {
    id: "spline-loop",
    name: "Spline loop",
    keywords: ["squiggle", "ribbon", "wire"],
    dials: [A("Tube", 0.03, 0.25, 0.1), B("Wobble", 0, 1, 0.5), C("Seed", 1, 20, 3, 1)],
    build: (a, b, c) => {
      const rng = seededRandom(Math.round(c) * 7919);
      const points = Array.from({ length: 8 }, (_, i) => {
        const t = (i / 8) * Math.PI * 2;
        const p = new Vector3(Math.cos(t), Math.sin(t), Math.sin(t * 2) * 0.5);
        p.x += (rng() - 0.5) * b * 1.2;
        p.y += (rng() - 0.5) * b * 1.2;
        p.z += (rng() - 0.5) * b * 1.2;
        return p.normalize();
      });
      return normalise(sweep(new CatmullRomCurve3(points, true, "centripetal"), circleProfile(a, 12), 240, 0));
    },
  },
  {
    id: "spiral",
    name: "Spiral coil",
    keywords: ["spring", "helix"],
    dials: [A("Turns", 2, 12, 6, 1), B("Tube", 0.05, 0.3, 0.14), C("Height", 0.5, 3, 2)],
    build: (a, b, c) => normalise(sweep(new HelixCurve(Math.round(a), c), circleProfile(b, 12), Math.round(a) * 32, 0, false)),
  },
  {
    id: "spiral-ball",
    name: "Spiral ball",
    keywords: ["wool", "helix", "globe"],
    dials: [A("Turns", 4, 16, 8, 1), B("Tube", 0.03, 0.2, 0.09)],
    build: (a, b) => normalise(sweep(new SphereSpiralCurve(Math.round(a)), circleProfile(b, 12), Math.round(a) * 28, 0, false)),
  },
  {
    id: "cone",
    name: "Cone",
    keywords: ["party hat"],
    dials: [A("Sharpness", 0, 1, 0.9), B("Rounding", 0, 1, 0.3)],
    build: (a, b) => {
      const tip = 0.02 + (1 - a) * 0.6;
      const profile = roundCorners([new Vector2(0, -0.8), new Vector2(1, -0.8), new Vector2(tip, 0.8), new Vector2(0, 0.8)], b * 0.45, 10);
      return normalise(lathe(profile, 96));
    },
  },
  {
    id: "pyramid",
    name: "Pyramid",
    keywords: ["triangle", "tetra"],
    dials: [A("Sides", 3, 8, 4, 1), B("Height", 0.5, 2, 1.2)],
    build: (a, b) => normalise(faceted(new ConeGeometry(1, b, Math.round(a), 2))),
  },
  {
    id: "diamond",
    name: "Diamond",
    keywords: ["octahedron", "crystal"],
    dials: [A("Stretch", 0.5, 2, 1.3), B("Width", 0.5, 1.5, 1)],
    build: (a, b) => normalise(faceted(new OctahedronGeometry(1).scale(b, a, b))),
  },
  {
    id: "gem",
    name: "Gem",
    keywords: ["jewel", "crystal", "diamond"],
    dials: [A("Facets", 5, 12, 8, 1), B("Crown", 0.2, 0.8, 0.45)],
    build: (a, b) => {
      const girdle = 0.9 - b * 1.8;
      const profile = [new Vector2(0, -0.9), new Vector2(1, girdle), new Vector2(0.55, 0.9), new Vector2(0, 0.9)];
      return normalise(faceted(lathe(profile, Math.round(a))));
    },
  },
  {
    id: "blob-spiky",
    name: "Spiky blob",
    keywords: ["virus", "spikes", "organic"],
    dials: [A("Spikes", 0, 1, 0.7), B("Detail", 1, 6, 2.5), C("Seed", 1, 20, 1, 1)],
    build: (a, b, c) => normalise(displace(new IcosahedronGeometry(1, 40), simplex3(Math.round(c)), b, a * 0.45)),
  },
  {
    id: "blob-soft",
    name: "Soft blob",
    keywords: ["pebble", "organic"],
    dials: [A("Amount", 0, 1, 0.5), B("Seed", 1, 20, 2, 1)],
    build: (a, b) => normalise(displace(new IcosahedronGeometry(1, 28), simplex3(Math.round(b)), 1.2, a * 0.35)),
  },
  {
    id: "pipe-star",
    name: "Pipe star",
    keywords: ["jack", "spokes"],
    dials: [A("Arms", 3, 8, 5, 1), B("Tube", 0.1, 0.4, 0.22)],
    note: "Looks best with solid materials",
    build: (a, b) => {
      const n = Math.round(a);
      const parts = Array.from({ length: n }, (_, i) => new CapsuleGeometry(b, 1.3, 8, 24).translate(0, 0.65, 0).rotateZ((i / n) * Math.PI * 2));
      return normalise(merge(parts));
    },
  },
  {
    id: "pipe-y",
    name: "Pipe Y",
    keywords: ["fork", "branch"],
    dials: [A("Tube", 0.1, 0.4, 0.22), B("Spread", 0.4, 1, 0.75)],
    note: "Looks best with solid materials",
    build: (a, b) => {
      const arm = () => new CapsuleGeometry(a, 1.2, 8, 24).translate(0, 0.6, 0);
      const spread = (b * 60 * Math.PI) / 180;
      return normalise(merge([arm().rotateZ(Math.PI), arm().rotateZ(spread), arm().rotateZ(-spread)]));
    },
  },
  {
    id: "petals",
    name: "Petal flower",
    keywords: ["daisy", "bloom"],
    dials: [A("Petals", 5, 16, 12, 1), B("Petal width", 0.3, 1, 0.6), C("Tilt", 0, 1, 0.3)],
    build: (a, b, c) => {
      const n = Math.round(a);
      const petals = Array.from({ length: n }, (_, i) =>
        new SphereGeometry(1, 32, 20)
          .scale(0.55, 0.22 * b, 0.12)
          .rotateX((c * Math.PI) / 4)
          .translate(0.7, 0, 0)
          .rotateZ((i / n) * Math.PI * 2),
      );
      const centre = new SphereGeometry(1, 32, 20).scale(0.32, 0.32, 0.18);
      return normalise(merge([...petals, centre]));
    },
  },
  {
    id: "lowpoly",
    name: "Low-poly ball",
    keywords: ["faceted", "icosahedron"],
    dials: [A("Detail", 0, 3, 1, 1)],
    build: (a) => normalise(faceted(new IcosahedronGeometry(1, Math.round(a)))),
  },
  {
    id: "knot",
    name: "Knot",
    keywords: ["torus knot", "pretzel"],
    dials: [A("Tube", 0.1, 0.4, 0.25), B("Twists", 2, 5, 3, 1)],
    build: (a, b) => normalise(new TorusKnotGeometry(1, a, 200, 24, 2, Math.round(b))),
  },
];
