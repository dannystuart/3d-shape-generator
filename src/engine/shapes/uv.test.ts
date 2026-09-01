/**
 * A surface texture should be the same size everywhere on a shape: on the
 * front, on the extruded edge, round the roll between them, and round a
 * tube however thin. These measure that off the triangles.
 */
import { Vector2, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC } from "../spec";
import { SHAPES, buildShape } from "./catalogue";
import type { Spec } from "../spec";

interface Sample {
  /** Texture tiles per world unit, as the geometric mean of both axes. */
  density: number;
  /** How much longer the texture runs one way than the other; 1 is square. */
  stretch: number;
  /** |normal.z| averaged over the triangle: 1 is a cap, 0 a wall. */
  facing: number;
  area: number;
}

function samples(spec: Partial<Spec>): Sample[] {
  const g = buildShape({ ...DEFAULT_SPEC, ...spec });
  const pos = g.getAttribute("position"), uv = g.getAttribute("uv"), nor = g.getAttribute("normal"), index = g.index;
  const [ru, rv] = (g.userData.uvRepeat as [number, number] | undefined) ?? [1, 1];
  const count = index ? index.count : pos.count;
  const at = (t: number) => (index ? index.getX(t) : t);
  const P = [new Vector3(), new Vector3(), new Vector3()], U = [new Vector2(), new Vector2(), new Vector2()];
  const out: Sample[] = [];
  for (let t = 0; t < count; t += 3) {
    let facing = 0;
    for (let k = 0; k < 3; k++) {
      const i = at(t + k);
      P[k].fromBufferAttribute(pos, i);
      U[k].set(uv.getX(i) * ru, uv.getY(i) * rv);
      facing += Math.abs(nor.getZ(i)) / 3;
    }
    const a1 = U[1].x - U[0].x, b1 = U[1].y - U[0].y, a2 = U[2].x - U[0].x, b2 = U[2].y - U[0].y;
    const det = a1 * b2 - b1 * a2;
    const e1 = new Vector3().subVectors(P[1], P[0]), e2 = new Vector3().subVectors(P[2], P[0]);
    const area = e1.clone().cross(e2).length() / 2;
    if (Math.abs(det) < 1e-12 || area < 1e-9) continue;
    const du = e1.clone().multiplyScalar(b2 / det).addScaledVector(e2, -b1 / det).length();
    const dv = e2.clone().multiplyScalar(a1 / det).addScaledVector(e1, -a2 / det).length();
    out.push({ density: 1 / Math.sqrt(du * dv), stretch: Math.max(du / dv, dv / du), facing, area });
  }
  return out;
}

/** Area-weighted median of one measure. */
function median(list: Sample[], key: "density" | "stretch"): number {
  const sorted = [...list].sort((a, b) => a[key] - b[key]);
  const half = sorted.reduce((s, x) => s + x.area, 0) / 2;
  let acc = 0;
  for (const s of sorted) {
    acc += s.area;
    if (acc >= half) return s[key];
  }
  return sorted[sorted.length - 1][key];
}

describe("extruded shapes", () => {
  it.each(["gear", "star-5", "heart", "card", "lightning"])("%s: the edge carries the texture at the same size as the face", (shape) => {
    const all = samples({ shape, rounding: 0.6 });
    const caps = all.filter((s) => s.facing > 0.95), walls = all.filter((s) => s.facing < 0.05), bevel = all.filter((s) => s.facing >= 0.05 && s.facing <= 0.95);
    expect(walls.length).toBeGreaterThan(0);
    expect(median(walls, "density") / median(caps, "density")).toBeCloseTo(1, 0.7);
    expect(median(bevel, "density") / median(caps, "density")).toBeCloseTo(1, 0.7);
    expect(median(walls, "stretch")).toBeLessThan(1.1);
  });
});

describe("every shape", () => {
  // A cone has to narrow its texture towards the tip and a petal is a squashed sphere; everything else should be close to square.
  const allowed = (id: string) => (["cone", "pyramid", "petals"].includes(id) ? 3 : 2);
  it.each(SHAPES.map((s) => s.id))("%s: the texture is not stretched", (shape) => {
    expect(median(samples({ shape }), "stretch")).toBeLessThan(allowed(shape));
  });
});
