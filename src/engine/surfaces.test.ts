import { describe, expect, it } from "vitest";
import { SURFACES, surfaceById, surfaceMaps } from "./surfaces";

describe("surfaces", () => {
  it("lists smooth plus nine, each with a height in 0..1", () => {
    expect(SURFACES.map((s) => s.id)).toEqual(["none", "leather", "scales", "concrete", "cracks", "frost", "hammered", "brushed", "weave", "rock"]);
    for (const s of SURFACES)
      for (let i = 0; i < 50; i++) {
        const h = s.height((i * 0.37) % 1, (i * 0.61) % 1);
        expect(h, s.id).toBeGreaterThanOrEqual(0);
        expect(h, s.id).toBeLessThanOrEqual(1);
      }
  });

  it("tiles: a point one tile over is the same point", () => {
    for (const s of SURFACES) {
      if (s.id === "none") continue;
      for (let i = 0; i < 40; i++) {
        const x = (i * 0.37 + 0.013) % 1, y = (i * 0.61 + 0.027) % 1;
        expect(Math.abs(s.height(x, y) - s.height(x + 1, y)), `${s.id} x`).toBeLessThan(1e-6);
        expect(Math.abs(s.height(x, y) - s.height(x, y + 1)), `${s.id} y`).toBeLessThan(1e-6);
      }
    }
  });

  it("makes a normal map that leans, and a roughness map that never exceeds one", () => {
    const { normal, roughness } = surfaceMaps(surfaceById("leather"), 64);
    expect(normal.length).toBe(64 * 64 * 4);
    let leaning = 0;
    for (let i = 0; i < normal.length; i += 4) {
      if (Math.abs(normal[i] - 128) > 6) leaning++;
      expect(roughness[i + 1]).toBeLessThanOrEqual(255);
    }
    expect(leaning).toBeGreaterThan(64 * 64 * 0.1);
    // The flat "none" surface is straight up everywhere.
    const flat = surfaceMaps(surfaceById("none"), 8).normal;
    for (let i = 0; i < flat.length; i += 4) expect(flat[i + 2]).toBe(255);
  });

  it("falls back to smooth for an unknown id", () => {
    expect(surfaceById("velcro").id).toBe("none");
  });
});
